package com.riwi.messaging.rag;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.Random;

// Deterministic mock embedding provider generating normalized 1536-dimension vectors for testing (D-15)
@Component
@ConditionalOnProperty(name = "ai.embedding.provider", havingValue = "mock", matchIfMissing = true)
public class MockEmbeddingProvider implements EmbeddingProvider {

    @Override
    public float[] embed(String text) {
        float[] vector = new float[1536];
        long seed = (text == null) ? 0 : text.hashCode();
        Random random = new Random(seed);

        double norm = 0.0;
        for (int i = 0; i < 1536; i++) {
            vector[i] = (float) (random.nextGaussian());
            norm += vector[i] * vector[i];
        }

        // L2 normalize
        float invNorm = (float) (1.0 / Math.sqrt(norm));
        for (int i = 0; i < 1536; i++) {
            vector[i] *= invNorm;
        }

        return vector;
    }
}
