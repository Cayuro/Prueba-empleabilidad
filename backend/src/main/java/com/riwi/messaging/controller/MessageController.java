package com.riwi.messaging.controller;

import com.riwi.messaging.exception.ApiException;
import com.riwi.messaging.rag.EmbeddingService;
import com.riwi.messaging.security.DbContextHelper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.bind.annotation.*;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// Thin Message Controller handling Keyset pagination, messaging CRUD, reads and WebSocket broadcast (D-06, D-14)
@RestController
@RequestMapping("/api/channels/{channelId}/messages")
public class MessageController {

    private final JdbcTemplate jdbcTemplate;
    private final DbContextHelper dbContextHelper;
    private final SimpMessagingTemplate messagingTemplate;
    private final EmbeddingService embeddingService;

    public MessageController(
            JdbcTemplate jdbcTemplate,
            DbContextHelper dbContextHelper,
            SimpMessagingTemplate messagingTemplate,
            EmbeddingService embeddingService) {
        this.jdbcTemplate = jdbcTemplate;
        this.dbContextHelper = dbContextHelper;
        this.messagingTemplate = messagingTemplate;
        this.embeddingService = embeddingService;
    }

    // Fetches keyset paginated messages using (rw_created_at, rw_id) without OFFSET (D-06)
    @GetMapping
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getMessages(
            @PathVariable UUID channelId,
            @RequestParam(required = false) String cursor_created_at,
            @RequestParam(required = false) UUID cursor_id,
            @RequestParam(defaultValue = "20") int limit,
            HttpServletRequest request) {

        if (limit > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Limit cannot exceed 100");
        }

        UUID userId = dbContextHelper.getRequiredUserId(request);
        dbContextHelper.setCurrentUser(jdbcTemplate, userId);

        String sql;
        List<Map<String, Object>> messages;

        if (cursor_created_at != null && !cursor_created_at.isBlank() && cursor_id != null) {
            sql = """
                SELECT m.*,
                       u.rw_name AS author_name,
                       (SELECT COUNT(*) FROM rw_message_reads mr WHERE mr.rw_message_id = m.rw_id) AS reads_count
                FROM rw_messages m
                JOIN rw_users u ON m.rw_author_id = u.rw_id
                WHERE m.rw_channel_id = ?
                  AND m.rw_is_active = TRUE
                  AND (m.rw_created_at, m.rw_id) < (?::timestamptz, ?::uuid)
                ORDER BY m.rw_created_at DESC, m.rw_id DESC
                LIMIT ?
            """;
            messages = jdbcTemplate.queryForList(sql, channelId, cursor_created_at, cursor_id, limit);
        } else {
            sql = """
                SELECT m.*,
                       u.rw_name AS author_name,
                       (SELECT COUNT(*) FROM rw_message_reads mr WHERE mr.rw_message_id = m.rw_id) AS reads_count
                FROM rw_messages m
                JOIN rw_users u ON m.rw_author_id = u.rw_id
                WHERE m.rw_channel_id = ?
                  AND m.rw_is_active = TRUE
                ORDER BY m.rw_created_at DESC, m.rw_id DESC
                LIMIT ?
            """;
            messages = jdbcTemplate.queryForList(sql, channelId, limit);
        }

        return messages;
    }

    // Inserts message under RLS, registers post-commit WebSocket broadcast and vector embedding (D-14, D-15)
    @PostMapping
    @Transactional
    public ResponseEntity<Map<String, Object>> sendMessage(
            @PathVariable UUID channelId,
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {

        UUID userId = dbContextHelper.getRequiredUserId(request);
        dbContextHelper.setCurrentUser(jdbcTemplate, userId);

        String content = (String) body.get("content");
        if (content == null || content.trim().isEmpty()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_CONTENT", "Message content cannot be empty");
        }

        String insertSql = """
            INSERT INTO rw_messages (rw_channel_id, rw_author_id, rw_content)
            VALUES (?, ?, ?)
            RETURNING rw_id, rw_channel_id, rw_author_id, rw_content, rw_metadata, rw_is_active, rw_created_at, rw_updated_at
        """;

        Map<String, Object> createdMessage = jdbcTemplate.queryForMap(insertSql, channelId, userId, content.trim());
        UUID messageId = (UUID) createdMessage.get("rw_id");

        // Fetch author name
        String authorName = jdbcTemplate.queryForObject(
                "SELECT rw_name FROM rw_users WHERE rw_id = ?",
                String.class,
                userId
        );

        Map<String, Object> payload = new HashMap<>(createdMessage);
        payload.put("author_name", authorName != null ? authorName : "Unknown");
        payload.put("reads_count", 0);
        payload.put("status", "sent");

        // Register WebSocket broadcast and embedding generation after transaction successfully commits
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                messagingTemplate.convertAndSend("/topic/channels/" + channelId, payload);
                embeddingService.generateAndStoreEmbedding(messageId, content.trim());
            }
        });

        return ResponseEntity.status(HttpStatus.CREATED).body(payload);
    }

    // Updates message content and regenerates embedding vector
    @PutMapping("/{messageId}")
    @Transactional
    public ResponseEntity<Map<String, Object>> updateMessage(
            @PathVariable UUID channelId,
            @PathVariable UUID messageId,
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {

        UUID userId = dbContextHelper.getRequiredUserId(request);
        dbContextHelper.setCurrentUser(jdbcTemplate, userId);

        String content = (String) body.get("content");
        if (content == null || content.trim().isEmpty()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_CONTENT", "Message content cannot be empty");
        }

        String updateSql = """
            UPDATE rw_messages
            SET rw_content = ?, rw_updated_at = NOW()
            WHERE rw_id = ? AND rw_channel_id = ? AND rw_author_id = ? AND rw_is_active = TRUE
            RETURNING rw_id, rw_channel_id, rw_author_id, rw_content, rw_created_at, rw_updated_at
        """;

        var updatedList = jdbcTemplate.queryForList(updateSql, content.trim(), messageId, channelId, userId);
        if (updatedList.isEmpty()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Message not found or not editable");
        }

        Map<String, Object> updatedMessage = updatedList.get(0);
        embeddingService.generateAndStoreEmbedding(messageId, content.trim());

        return ResponseEntity.ok(updatedMessage);
    }

    // Soft-deletes message adhering to D-01 and D-02
    @DeleteMapping("/{messageId}")
    @Transactional
    public ResponseEntity<Void> deleteMessage(
            @PathVariable UUID channelId,
            @PathVariable UUID messageId,
            HttpServletRequest request) {

        UUID userId = dbContextHelper.getRequiredUserId(request);
        dbContextHelper.setCurrentUser(jdbcTemplate, userId);

        String deleteSql = """
            UPDATE rw_messages
            SET rw_deleted_at = NOW(), rw_is_active = FALSE
            WHERE rw_id = ? AND rw_channel_id = ? AND rw_author_id = ? AND rw_is_active = TRUE
        """;

        int rows = jdbcTemplate.update(deleteSql, messageId, channelId, userId);
        if (rows == 0) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Message not found or already deleted");
        }

        return ResponseEntity.noContent().build();
    }

    // Marks message as read by the authenticated user idempotently
    @PostMapping("/{messageId}/read")
    @Transactional
    public ResponseEntity<Void> markMessageRead(
            @PathVariable UUID channelId,
            @PathVariable UUID messageId,
            HttpServletRequest request) {

        UUID userId = dbContextHelper.getRequiredUserId(request);
        dbContextHelper.setCurrentUser(jdbcTemplate, userId);

        jdbcTemplate.update(
                "INSERT INTO rw_message_reads (rw_message_id, rw_user_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
                messageId,
                userId
        );

        return ResponseEntity.noContent().build();
    }
}
