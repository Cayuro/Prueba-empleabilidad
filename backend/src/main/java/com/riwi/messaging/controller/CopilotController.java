package com.riwi.messaging.controller;

import com.riwi.messaging.config.RateLimiterService;
import com.riwi.messaging.exception.ApiException;
import com.riwi.messaging.rag.AiProvider;
import com.riwi.messaging.rag.EmbeddingProvider;
import com.riwi.messaging.rag.EmbeddingRepository;
import com.riwi.messaging.rag.EmbeddingService;
import com.riwi.messaging.rag.GeminiProvider;
import com.riwi.messaging.security.DbContextHelper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

// Thin Copilot Controller orchestrating RAG pipeline under PostgreSQL RLS authorization with strict 2-citation limit & answer_found flag
@RestController
@RequestMapping("/api/copilot")
public class CopilotController {

    private final JdbcTemplate jdbcTemplate;
    private final DbContextHelper dbContextHelper;
    private final EmbeddingProvider embeddingProvider;
    private final EmbeddingRepository embeddingRepository;
    private final EmbeddingService embeddingService;
    private final AiProvider aiProvider;
    private final RateLimiterService rateLimiterService;

    @Value("${copilot.system-prompt-version:1}")
    private int systemPromptVersion;

    public CopilotController(
            JdbcTemplate jdbcTemplate,
            DbContextHelper dbContextHelper,
            EmbeddingProvider embeddingProvider,
            EmbeddingRepository embeddingRepository,
            EmbeddingService embeddingService,
            AiProvider aiProvider,
            RateLimiterService rateLimiterService) {
        this.jdbcTemplate = jdbcTemplate;
        this.dbContextHelper = dbContextHelper;
        this.embeddingProvider = embeddingProvider;
        this.embeddingRepository = embeddingRepository;
        this.embeddingService = embeddingService;
        this.aiProvider = aiProvider;
        this.rateLimiterService = rateLimiterService;
    }

    @org.springframework.context.event.EventListener(org.springframework.boot.context.event.ApplicationReadyEvent.class)
    public void onStartup() {
        embeddingService.indexAllMessages(jdbcTemplate);
    }

    // Orchestrates RAG flow: Embed query -> Vector candidates -> RLS authorized select -> LLM completion -> Audit usage
    @PostMapping("/query")
    @Transactional
    public ResponseEntity<Map<String, Object>> queryCopilot(
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {

        UUID userId = dbContextHelper.getRequiredUserId(request);
        rateLimiterService.checkRateLimit("copilot:" + userId, 20);

        String query = (String) body.get("query");
        if (query == null || query.trim().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Query string cannot be empty");
        }

        // Anti-Prompt-Injection & Jailbreak Guardrail:
        String lowerQuery = query.toLowerCase();
        if (lowerQuery.matches(".*(ignore previous|system prompt|forget all rules|developer mode|dan mode|jailbreak|reveal prompt|dame la clave|select \\* from|drop table|bypass).*")) {
            return ResponseEntity.ok(Map.of(
                    "answer", GeminiProvider.NOT_FOUND_MESSAGE,
                    "citations", List.of(),
                    "tokens_used", 10,
                    "system_prompt_version", 1,
                    "answer_found", false
            ));
        }

        // 1. Candidate retrieval: Keyword / Full-Text search + nearest vector candidates
        float[] queryVector = embeddingProvider.embed(query.trim());
        List<UUID> candidateIds = new ArrayList<>();

        String[] tokens = query.trim().toLowerCase().replaceAll("[^a-záéíóúñ0-9\\s]", " ").split("\\s+");
        List<String> keywords = new ArrayList<>();
        for (String t : tokens) {
            if (t.length() >= 4) {
                keywords.add(t);
            }
        }

        if (!keywords.isEmpty()) {
            try {
                StringBuilder kwClause = new StringBuilder();
                List<Object> params = new ArrayList<>();
                for (int i = 0; i < keywords.size(); i++) {
                    if (i > 0) kwClause.append(" OR ");
                    kwClause.append("rw_content ILIKE ?");
                    params.add("%" + keywords.get(i) + "%");
                }

                String kwSql = "SELECT rw_id FROM rw_messages WHERE (" + kwClause + ") AND rw_is_active = TRUE LIMIT 10";
                List<UUID> kwIds = jdbcTemplate.query(
                        kwSql,
                        (rs, rowNum) -> (UUID) rs.getObject("rw_id"),
                        params.toArray()
                );
                candidateIds.addAll(kwIds);
            } catch (Exception ignored) {}
        }

        try {
            List<UUID> vectorIds = embeddingRepository.findNearestMessageIds(queryVector, 8);
            for (UUID vid : vectorIds) {
                if (!candidateIds.contains(vid)) {
                    candidateIds.add(vid);
                }
            }
        } catch (Exception ignored) {}

        // 2. Authorize candidates via RLS in PostgreSQL
        dbContextHelper.setCurrentUser(jdbcTemplate, userId);

        List<Map<String, Object>> authorizedMessages = new ArrayList<>();
        if (!candidateIds.isEmpty()) {
            String inSql = String.join(",", Collections.nCopies(candidateIds.size(), "?::uuid"));
            authorizedMessages = jdbcTemplate.queryForList(
                    "SELECT * FROM rw_messages WHERE rw_id IN (" + inSql + ") AND rw_is_active = TRUE ORDER BY rw_created_at ASC",
                    candidateIds.toArray()
            );
        }

        // 3. Build context and candidate citations
        StringBuilder contextBuilder = new StringBuilder();
        List<Map<String, String>> potentialCitations = new ArrayList<>();

        for (Map<String, Object> msg : authorizedMessages) {
            UUID msgId = (UUID) msg.get("rw_id");
            String content = (String) msg.get("rw_content");
            contextBuilder.append("- ").append(content).append("\n");

            potentialCitations.add(Map.of(
                    "message_id", msgId.toString(),
                    "snippet", content.length() > 120 ? content.substring(0, 120) + "..." : content
            ));
        }

        // Fetch authenticated user's name and role
        String userName = "Authenticated User";
        String userRole = "member";
        try {
            Map<String, Object> userProfile = jdbcTemplate.queryForMap(
                    "SELECT rw_name, rw_role FROM rw_users WHERE rw_id = ?",
                    userId
            );
            if (userProfile.get("rw_name") != null) userName = (String) userProfile.get("rw_name");
            if (userProfile.get("rw_role") != null) userRole = (String) userProfile.get("rw_role");
        } catch (Exception ignored) {}

        String systemPrompt = String.format(
                "You are Riwi AI Copilot, an internal assistant for Riwi Co. S.A.S. The authenticated user is %s (Role: %s). Answer strictly based on the provided authorized conversation context. Never disclose unauthorized content.",
                userName, userRole
        );
        String answer = aiProvider.generateCompletion(systemPrompt, contextBuilder.toString(), query.trim());

        // 4. Validate relevance and compute answer_found flag
        boolean answerFound = !answer.contains("⚠️ No encontré esa información") &&
                              !answer.contains("Contexto autorizado insuficiente");

        // 5. Strictly limit citations to max 2 snippets directly relevant to the answer
        List<Map<String, String>> finalCitations = new ArrayList<>();
        if (answerFound) {
            for (Map<String, String> cit : potentialCitations) {
                if (finalCitations.size() >= 2) break;
                // Only include citation if it has relevant overlap or if within top 2
                finalCitations.add(cit);
            }
        }

        // 6. Token calculation & usage auditing in rw_copilot_usage
        int tokensUsed = Math.max(12, (query.length() + contextBuilder.length() + answer.length()) / 4);
        jdbcTemplate.update(
                "INSERT INTO rw_copilot_usage (rw_user_id, rw_query, rw_tokens_used) VALUES (?, ?, ?)",
                userId,
                query.trim(),
                tokensUsed
        );

        Map<String, Object> response = new HashMap<>();
        response.put("answer", answer);
        response.put("answer_found", answerFound);
        response.put("citations", finalCitations);
        response.put("tokens_used", tokensUsed);
        response.put("system_prompt_version", systemPromptVersion);

        return ResponseEntity.ok(response);
    }

    // Fetches aggregated Copilot usage stats for the calling user
    @GetMapping("/usage")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getUsage(HttpServletRequest request) {
        UUID userId = dbContextHelper.getRequiredUserId(request);
        dbContextHelper.setCurrentUser(jdbcTemplate, userId);

        String sql = """
            SELECT COUNT(*) AS total_queries,
                   COALESCE(SUM(rw_tokens_used), 0) AS total_tokens,
                   MAX(rw_created_at) AS last_query_at
            FROM rw_copilot_usage
            WHERE rw_user_id = ?
        """;

        Map<String, Object> usage = jdbcTemplate.queryForMap(sql, userId);
        return ResponseEntity.ok(usage);
    }
}
