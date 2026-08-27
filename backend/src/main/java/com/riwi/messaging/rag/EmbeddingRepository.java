package com.riwi.messaging.rag;

import java.util.List;
import java.util.UUID;

// Repository abstraction for persisting and nearest-neighbor querying of vector embeddings (D-15)
public interface EmbeddingRepository {
    void save(UUID messageId, float[] vector);
    List<UUID> findNearestMessageIds(float[] vector, int limit);
}
