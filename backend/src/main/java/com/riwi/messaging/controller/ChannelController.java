package com.riwi.messaging.controller;

import com.riwi.messaging.exception.ApiException;
import com.riwi.messaging.security.DbContextHelper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

// Thin Channel Controller managing channel listings, creations and member invitations under RLS
@RestController
@RequestMapping("/api/channels")
public class ChannelController {

    private final JdbcTemplate jdbcTemplate;
    private final DbContextHelper dbContextHelper;

    public ChannelController(JdbcTemplate jdbcTemplate, DbContextHelper dbContextHelper) {
        this.jdbcTemplate = jdbcTemplate;
        this.dbContextHelper = dbContextHelper;
    }

    // Lists channels visible to the user under PostgreSQL RLS
    @GetMapping
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getChannels(HttpServletRequest request) {
        UUID userId = dbContextHelper.getRequiredUserId(request);
        dbContextHelper.setCurrentUser(jdbcTemplate, userId);

        String sql = """
            SELECT c.*,
                   (SELECT COUNT(*) FROM rw_channel_members cm WHERE cm.rw_channel_id = c.rw_id AND cm.rw_is_active = TRUE) AS member_count
            FROM rw_channels c
            WHERE c.rw_is_active = TRUE
            ORDER BY c.rw_created_at ASC
        """;

        return jdbcTemplate.queryForList(sql);
    }

    // Creates new channel and automatically registers creator as admin member
    @PostMapping
    @Transactional
    public ResponseEntity<Map<String, Object>> createChannel(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        UUID userId = dbContextHelper.getRequiredUserId(request);
        dbContextHelper.setCurrentUser(jdbcTemplate, userId);

        String name = (String) body.get("name");
        Boolean isPrivate = body.get("is_private") != null ? (Boolean) body.get("is_private") : false;

        if (name == null || name.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Channel name is required");
        }

        String insertChannelSql = """
            INSERT INTO rw_channels (rw_name, rw_is_private, rw_created_by)
            VALUES (?, ?, ?)
            RETURNING rw_id, rw_name, rw_is_private, rw_created_by, rw_is_active, rw_created_at, rw_updated_at
        """;

        Map<String, Object> createdChannel = jdbcTemplate.queryForMap(insertChannelSql, name.trim(), isPrivate, userId);
        UUID channelId = (UUID) createdChannel.get("rw_id");

        // Insert creator into rw_channel_members as admin
        jdbcTemplate.update(
                "INSERT INTO rw_channel_members (rw_channel_id, rw_user_id, rw_role) VALUES (?, ?, 'admin')",
                channelId,
                userId
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(createdChannel);
    }

    // Lists members of a channel
    @GetMapping("/{channelId}/members")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getMembers(@PathVariable UUID channelId, HttpServletRequest request) {
        UUID userId = dbContextHelper.getRequiredUserId(request);
        dbContextHelper.setCurrentUser(jdbcTemplate, userId);

        String sql = """
            SELECT cm.rw_channel_id, cm.rw_user_id, cm.rw_role, cm.rw_is_active, cm.rw_joined_at,
                   u.rw_name, u.rw_email
            FROM rw_channel_members cm
            JOIN rw_users u ON u.rw_id = cm.rw_user_id
            WHERE cm.rw_channel_id = ? AND cm.rw_is_active = TRUE
            ORDER BY cm.rw_joined_at ASC
        """;

        return jdbcTemplate.queryForList(sql, channelId);
    }

    // Invites or adds a user to a channel
    @PostMapping("/{channelId}/members")
    @Transactional
    public ResponseEntity<Map<String, Object>> addMember(
            @PathVariable UUID channelId,
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {
        UUID currentUserId = dbContextHelper.getRequiredUserId(request);
        dbContextHelper.setCurrentUser(jdbcTemplate, currentUserId);

        String userIdStr = (String) body.get("user_id");
        if (userIdStr == null || userIdStr.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "user_id is required");
        }
        UUID targetUserId = UUID.fromString(userIdStr);
        String role = body.get("role") != null ? (String) body.get("role") : "member";

        String insertSql = """
            INSERT INTO rw_channel_members (rw_channel_id, rw_user_id, rw_role, rw_is_active)
            VALUES (?, ?, ?, TRUE)
            ON CONFLICT (rw_channel_id, rw_user_id)
            DO UPDATE SET rw_is_active = TRUE, rw_role = EXCLUDED.rw_role, rw_deleted_at = NULL
            RETURNING rw_channel_id, rw_user_id, rw_role, rw_is_active, rw_joined_at
        """;

        Map<String, Object> member = jdbcTemplate.queryForMap(insertSql, channelId, targetUserId, role);
        return ResponseEntity.status(HttpStatus.CREATED).body(member);
    }
}
