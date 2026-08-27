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

// Google Gemini API provider with secure contextual fallback and zero technical error leakage
@Component
@ConditionalOnProperty(name = "ai.provider", havingValue = "gemini")
public class GeminiProvider implements AiProvider {

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
            return "Contexto autorizado insuficiente para responder a esta consulta. Como asistente interno de Riwi, únicamente tengo permitido responder sobre los temas discutidos en tus canales y conversaciones autorizadas.";
        }

        // Strict out-of-context guardrails: reject math, generic facts, or general domain questions
        String cleanQuery = query.toLowerCase().trim();
        if (cleanQuery.matches(".*(\\d+\\s*[+\\-*/^%]\\s*\\d+|cuanto es|cuánto es|calcular|suma|resta|multiplica|divide).*") ||
            cleanQuery.matches(".*(capital de|clima en|chiste|cuentame un cuento|poema|quien es el presidente|receta).*")) {
            return "Contexto autorizado insuficiente para responder a esta consulta. Como asistente interno de Riwi, únicamente tengo permitido responder sobre los temas discutidos en tus canales y conversaciones autorizadas.";
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
                        "%s\n\nREGLA ESTRICTA E INVIOLABLE:\n" +
                        "Responde ÚNICAMENTE utilizando los hechos explícitos del siguiente contexto de mensajes de chat autorizados.\n" +
                        "Si la pregunta es genérica, de matemáticas, programación general, chistes, clima o cualquier tema no mencionado directamente en el contexto, DEBES responder exactamente:\n" +
                        "'Contexto autorizado insuficiente para responder a esta consulta. Como asistente interno de Riwi, únicamente tengo permitido responder sobre los temas discutidos en tus canales y conversaciones autorizadas.'\n\n" +
                        "Contexto de la conversación:\n%s\n\nPregunta del usuario:\n%s",
                        systemPrompt, context, query
                );

                Map<String, Object> textPart = Map.of("text", prompt);
                Map<String, Object> contentObj = Map.of("parts", List.of(textPart));
                Map<String, Object> requestBody = new HashMap<>();
                requestBody.put("contents", List.of(contentObj));
                requestBody.put("generationConfig", Map.of(
                        "temperature", 0.1,
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

    // Local extractive synthesizer from RLS-authorized context
    private String synthesizeAuthorizedContext(String context, String query) {
        String[] qTokens = query.toLowerCase().replaceAll("[^a-záéíóúñ0-9\\s]", " ").split("\\s+");
        String[] lines = context.split("\n");
        List<String> matchingPoints = new ArrayList<>();

        for (String line : lines) {
            String l = line.trim();
            if (l.startsWith("- ")) l = l.substring(2).trim();
            if (l.isEmpty()) continue;

            String lowerLine = l.toLowerCase();
            int matches = 0;
            for (String tok : qTokens) {
                if (tok.length() >= 3 && lowerLine.contains(tok)) {
                    matches++;
                }
            }
            if (matches > 0) {
                matchingPoints.add(l);
            }
        }

        if (matchingPoints.isEmpty()) {
            for (String line : lines) {
                String l = line.trim();
                if (l.startsWith("- ")) l = l.substring(2).trim();
                if (!l.isEmpty() && matchingPoints.size() < 3) {
                    matchingPoints.add(l);
                }
            }
        }

        if (matchingPoints.isEmpty()) {
            return "Contexto autorizado insuficiente para responder a esta consulta. Como asistente interno de Riwi, únicamente tengo permitido responder sobre los temas discutidos en tus canales y conversaciones autorizadas.";
        }

        StringBuilder sb = new StringBuilder();
        sb.append("De acuerdo con lo conversado en los canales autorizados:\n\n");
        for (String point : matchingPoints) {
            sb.append("• ").append(point).append("\n");
        }
        return sb.toString().trim();
    }
}
