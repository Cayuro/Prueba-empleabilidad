package com.riwi.messaging.rag;

// Interface generating float embeddings from text (D-15)
public interface EmbeddingProvider {
    float[] embed(String text);
}
