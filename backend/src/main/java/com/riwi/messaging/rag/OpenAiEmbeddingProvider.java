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

import java.util.HashMap;
import java.util.Map;

// OpenAI embeddings API client implementation using configured embedding model (D-15)
@Component
@ConditionalOnProperty(name = "ai.embedding.provider", havingValue = "openai")
public class OpenAiEmbeddingProvider implements EmbeddingProvider {

    private static final Logger log = LoggerFactory.getLogger(OpenAiEmbeddingProvider.class);
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${ai.openai.api-key:}")
    private String apiKey;

    @Value("${ai.embedding.model:text-embedding-ada-002}")
    private String model;

    @Override
    public float[] embed(String text) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("OpenAI API key missing, returning empty embedding vector");
            return new float[1536];
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(apiKey);

            Map<String, Object> body = new HashMap<>();
            body.put("input", text);
            body.put("model", model);

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.postForEntity("https://api.openai.com/v1/embeddings", request, String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode embeddingArray = root.path("data").get(0).path("embedding");

                float[] vector = new float[embeddingArray.size()];
                for (int i = 0; i < embeddingArray.size(); i++) {
                    vector[i] = (float) embeddingArray.get(i).asDouble();
                }
                return vector;
            }
        } catch (Exception e) {
            log.error("Failed to generate OpenAI embedding: {}", e.getMessage(), e);
        }

        return new float[1536];
    }
}
