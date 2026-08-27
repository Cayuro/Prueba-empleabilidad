package com.riwi.messaging.controller;

import com.riwi.messaging.security.DbContextHelper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// Full-text search controller leveraging PostgreSQL tsvector, GIN index and ts_headline (D-10)
@RestController
@RequestMapping("/api/messages/search")
public class SearchController {

    private final JdbcTemplate jdbcTemplate;
    private final DbContextHelper dbContextHelper;

    public SearchController(JdbcTemplate jdbcTemplate, DbContextHelper dbContextHelper) {
        this.jdbcTemplate = jdbcTemplate;
        this.dbContextHelper = dbContextHelper;
    }

    // Executes full-text search over authorized messages with highlighted text snippets
    @GetMapping
    @Transactional(readOnly = true)
    public List<Map<String, Object>> searchMessages(
            @RequestParam(required = false, defaultValue = "") String q,
            HttpServletRequest request) {

        if (q == null || q.trim().isEmpty()) {
            return Collections.emptyList();
        }

        UUID userId = dbContextHelper.getRequiredUserId(request);
        dbContextHelper.setCurrentUser(jdbcTemplate, userId);

        String trimmedQuery = q.trim();

        String sql = """
            SELECT m.rw_id, m.rw_channel_id, m.rw_author_id, u.rw_name AS author_name,
                   m.rw_content,
                   ts_headline('spanish', m.rw_content, plainto_tsquery('spanish', ?), 'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15') AS snippet,
                   m.rw_created_at
            FROM rw_messages m
            JOIN rw_users u ON m.rw_author_id = u.rw_id
            WHERE m.rw_is_active = TRUE
              AND m.rw_tsv @@ (plainto_tsquery('spanish', ?) || plainto_tsquery('english', ?))
            ORDER BY ts_rank(m.rw_tsv, plainto_tsquery('spanish', ?)) DESC
            LIMIT 20
        """;

        return jdbcTemplate.queryForList(sql, trimmedQuery, trimmedQuery, trimmedQuery, trimmedQuery);
    }
}
