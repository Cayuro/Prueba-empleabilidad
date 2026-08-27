package com.riwi.messaging.controller;

import com.riwi.messaging.security.DbContextHelper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

// Thin Conversation Controller querying PostgreSQL view rw_vw_user_conversations under RLS
@RestController
@RequestMapping("/api/conversations")
public class ConversationController {

    private final JdbcTemplate jdbcTemplate;
    private final DbContextHelper dbContextHelper;

    public ConversationController(JdbcTemplate jdbcTemplate, DbContextHelper dbContextHelper) {
        this.jdbcTemplate = jdbcTemplate;
        this.dbContextHelper = dbContextHelper;
    }

    // Fetches conversation list with unread counts and latest messages under RLS context
    @GetMapping
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getConversations(HttpServletRequest request) {
        UUID userId = dbContextHelper.getRequiredUserId(request);
        dbContextHelper.setCurrentUser(jdbcTemplate, userId);

        String sql = """
            SELECT
                rw_channel_id,
                rw_channel_name,
                rw_channel_is_private,
                rw_channel_created_by,
                rw_channel_created_at,
                rw_channel_updated_at,
                rw_last_message_id,
                rw_last_message_content,
                rw_last_message_author_id,
                rw_last_message_at,
                rw_unread_count
            FROM rw_vw_user_conversations
            ORDER BY rw_last_message_at DESC NULLS LAST, rw_channel_created_at DESC
        """;

        return jdbcTemplate.queryForList(sql);
    }
}
