package com.riwi.messaging.rag;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;

// PostgreSQL pgvector implementation of vector store for similarity search (D-12, D-15)
@Repository
public class PgVectorEmbeddingRepository implements EmbeddingRepository {

    private static final Logger log = LoggerFactory.getLogger(PgVectorEmbeddingRepository.class);
    private final JdbcTemplate jdbcTemplate;

    public PgVectorEmbeddingRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    // Converts float array to pgvector string representation: [v1,v2,...]
    private String toVectorString(float[] vector) {
        if (vector == null || vector.length == 0) {
            return "[]";
        }
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < vector.length; i++) {
            sb.append(vector[i]);
            if (i < vector.length - 1) {
                sb.append(",");
            }
        }
        sb.append("]");
        return sb.toString();
    }

    @Override
    public void save(UUID messageId, float[] vector) {
        String vectorStr = toVectorString(vector);
        try {
            // Check if embedding exists for message
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM rw_embeddings WHERE rw_message_id = ?",
                    Integer.class,
                    messageId
            );

            if (count != null && count > 0) {
                jdbcTemplate.update(
                        "UPDATE rw_embeddings SET rw_embedding = ?::vector WHERE rw_message_id = ?",
                        vectorStr,
                        messageId
                );
            } else {
                jdbcTemplate.update(
                        "INSERT INTO rw_embeddings (rw_message_id, rw_embedding) VALUES (?, ?::vector)",
                        messageId,
                        vectorStr
                );
            }
        } catch (Exception e) {
            log.error("Failed to save embedding for message {}: {}", messageId, e.getMessage());
        }
    }

    @Override
    public List<UUID> findNearestMessageIds(float[] vector, int limit) {
        String vectorStr = toVectorString(vector);
        int searchLimit = Math.max(1, Math.min(limit, 50));

        String sql = """
            SELECT rw_message_id
            FROM rw_embeddings
            ORDER BY rw_embedding <=> ?::vector
            LIMIT ?
        """;

        return jdbcTemplate.query(
                sql,
                (rs, rowNum) -> (UUID) rs.getObject("rw_message_id"),
                vectorStr,
                searchLimit
        );
    }
}
