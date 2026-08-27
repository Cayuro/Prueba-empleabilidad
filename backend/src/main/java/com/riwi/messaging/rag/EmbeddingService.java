package com.riwi.messaging.rag;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.UUID;

// Service orchestrating embedding generation and persistence for messages (D-15)
@Service
public class EmbeddingService {

    private static final Logger log = LoggerFactory.getLogger(EmbeddingService.class);
    private final EmbeddingProvider embeddingProvider;
    private final EmbeddingRepository embeddingRepository;

    public EmbeddingService(EmbeddingProvider embeddingProvider, EmbeddingRepository embeddingRepository) {
        this.embeddingProvider = embeddingProvider;
        this.embeddingRepository = embeddingRepository;
    }

    // Generates embedding asynchronously to avoid blocking the main transaction
    @Async
    public void generateAndStoreEmbedding(UUID messageId, String content) {
        if (content == null || content.isBlank()) {
            return;
        }
        try {
            float[] vector = embeddingProvider.embed(content);
            embeddingRepository.save(messageId, vector);
            log.debug("Saved vector embedding for message ID {}", messageId);
        } catch (Exception e) {
            log.error("Failed to generate or store embedding for message {}: {}", messageId, e.getMessage());
        }
    }
}
