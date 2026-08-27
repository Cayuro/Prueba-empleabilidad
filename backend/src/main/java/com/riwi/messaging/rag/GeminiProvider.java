package com.riwi.messaging.rag;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

// Google Gemini API provider with strict context validation, anti-hallucination guardrails, and zero technical error leakage
@Component
@ConditionalOnProperty(name = "ai.provider", havingValue = "gemini")
public class GeminiProvider implements AiProvider {

    public static final String NOT_FOUND_MESSAGE = "⚠️ No encontré esa información en los canales autorizados.";

    private static final Logger log = LoggerFactory.getLogger(GeminiProvider.class);
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${ai.gemini.api-key:}")
    private String apiKey;

    @Value("${ai.gemini.model:gemini-1.5-flash}")
    private String model;

    // Normalizes model name to official Gemini identifiers
    private String getNormalizedModel() {
        if (model == null || model.isBlank()) {
            return "gemini-1.5-flash";
        }
        String m = model.trim();
        if (m.startsWith("models/")) {
            m = m.substring("models/".length());
        }
        if (!m.startsWith("gemini-")) {
            return "gemini-1.5-flash";
        }
        return m;
    }

    @Override
    public String generateCompletion(String systemPrompt, String context, String query) {
        if (context == null || context.isBlank()) {
            return NOT_FOUND_MESSAGE;
        }

        // Strict out-of-context guardrails: reject math, generic facts, or general domain questions
        String cleanQuery = query.toLowerCase().trim();
        if (cleanQuery.matches(".*(\\d+\\s*[+\\-*/^%]\\s*\\d+|cuanto es|cuánto es|calcular|suma|resta|multiplica|divide).*") ||
            cleanQuery.matches(".*(capital de|clima en|chiste|cuentame un cuento|poema|quien es el presidente|receta|dime algo).*")) {
            return NOT_FOUND_MESSAGE;
        }

        // Attempt completion with Google Gemini if API key is provided
        if (apiKey != null && !apiKey.isBlank()) {
            try {
                String modelName = getNormalizedModel();
                String url = String.format(
                        "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
                        modelName, apiKey
                );

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);

                String prompt = String.format(
                        "%s\n\nREGLAS ESTRICTAS DE VALIDACIÓN Y RELEVANCIA (INVIOLABLES):\n" +
                        "1. VALIDACIÓN DE RELEVANCIA: Antes de responder, evalúa si el contexto recuperado contiene información que responda directamente la pregunta del usuario.\n" +
                        "2. Si ningún fragmento del contexto contiene esa información, NO inventes, NO combines fragmentos no relacionados para simular una respuesta, ni intentes adivinar. En su lugar, responde EXACTAMENTE con: '⚠️ No encontré esa información en los canales autorizados.'\n" +
                        "3. Responde de forma concisa y profesional basándote únicamente en los fragmentos verdaderamente pertinentes.\n\n" +
                        "Contexto de conversaciones autorizadas:\n%s\n\nPregunta del usuario:\n%s",
                        systemPrompt, context, query
                );

                Map<String, Object> textPart = Map.of("text", prompt);
                Map<String, Object> contentObj = Map.of("parts", List.of(textPart));
                Map<String, Object> requestBody = new HashMap<>();
                requestBody.put("contents", List.of(contentObj));
                requestBody.put("generationConfig", Map.of(
                        "temperature", 0.0,
                        "maxOutputTokens", 600
                ));

                HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
                ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);

                if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                    JsonNode root = objectMapper.readTree(response.getBody());
                    JsonNode candidate = root.path("candidates").path(0);
                    String text = candidate.path("content").path("parts").path(0).path("text").asText();
                    if (!text.isBlank()) {
                        return text.trim();
                    }
                }
            } catch (Exception e) {
                // Secure server-side logging — NEVER expose raw exception or API error to user
                log.warn("Gemini API call failed ({}), falling back to secure contextual extraction", e.getMessage());
            }
        }

        // Graceful fallback: synthesize response from authorized context without exposing internal details
        return synthesizeAuthorizedContext(context, query);
    }

    // Local extractive synthesizer from RLS-authorized context with strict stopword filtering
    private String synthesizeAuthorizedContext(String context, String query) {
        Set<String> stopWords = Set.of(
                "reunion", "reunión", "canal", "canales", "mensaje", "mensajes", "sobre", "acuerdo", "acordo", "acordó",
                "cual", "cuál", "cuales", "cuáles", "hola", "para", "como", "cómo", "este", "esta", "estos", "estas",
                "hacer", "decir", "tratar", "trataron", "tema", "temas", "hablo", "habló", "hablaron", "saber", "quiero",
                "informacion", "información", "discutio", "discutió", "acuerdos"
        );

        String[] rawTokens = query.toLowerCase().replaceAll("[^a-záéíóúñ0-9\\s]", " ").split("\\s+");
        List<String> distinctiveQueryTokens = new ArrayList<>();
        for (String tok : rawTokens) {
            if (tok.length() >= 4 && !stopWords.contains(tok)) {
                distinctiveQueryTokens.add(tok);
            }
        }

        String[] lines = context.split("\n");
        List<String> matchingPoints = new ArrayList<>();

        for (String line : lines) {
            String l = line.trim();
            if (l.startsWith("- ")) l = l.substring(2).trim();
            if (l.isEmpty()) continue;

            String lowerLine = l.toLowerCase();
            if (!distinctiveQueryTokens.isEmpty()) {
                int matches = 0;
                for (String tok : distinctiveQueryTokens) {
                    if (lowerLine.contains(tok)) {
                        matches++;
                    }
                }
                if (matches > 0) {
                    matchingPoints.add(l);
                }
            } else {
                // If query only contains common words, match on length >= 4
                int matches = 0;
                for (String tok : rawTokens) {
                    if (tok.length() >= 4 && lowerLine.contains(tok)) {
                        matches++;
                    }
                }
                if (matches > 0) {
                    matchingPoints.add(l);
                }
            }
        }

        // If no relevant points match the distinctive query keywords directly, reject hallucination
        if (matchingPoints.isEmpty()) {
            return NOT_FOUND_MESSAGE;
        }

        // Cap to maximum 2 points
        if (matchingPoints.size() > 2) {
            matchingPoints = matchingPoints.subList(0, 2);
        }

        StringBuilder sb = new StringBuilder();
        sb.append("De acuerdo con lo conversado en los canales autorizados:\n\n");
        for (String point : matchingPoints) {
            sb.append("• ").append(point).append("\n");
        }
        return sb.toString().trim();
    }
}
