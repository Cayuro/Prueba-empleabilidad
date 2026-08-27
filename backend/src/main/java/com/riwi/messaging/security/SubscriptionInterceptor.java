package com.riwi.messaging.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// Intercepts SUBSCRIBE frames to ensure user has authorization for private channel topics (D-14)
@Component
public class SubscriptionInterceptor implements ChannelInterceptor {

    private static final Logger log = LoggerFactory.getLogger(SubscriptionInterceptor.class);
    private static final Pattern CHANNEL_TOPIC_PATTERN = Pattern.compile("^/topic/channels/([a-fA-F0-9\\-]+)$");

    private final JdbcTemplate jdbcTemplate;

    public SubscriptionInterceptor(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor != null && StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            String destination = accessor.getDestination();
            if (destination != null) {
                Matcher matcher = CHANNEL_TOPIC_PATTERN.matcher(destination);
                if (matcher.matches()) {
                    String channelIdStr = matcher.group(1);
                    UUID channelId;
                    try {
                        channelId = UUID.fromString(channelIdStr);
                    } catch (IllegalArgumentException e) {
                        throw new AccessDeniedException("Invalid channel ID in subscription destination");
                    }

                    Principal principal = accessor.getUser();
                    UUID userId = principal != null ? UUID.fromString(principal.getName()) : null;

                    if (!isAuthorizedForChannel(channelId, userId)) {
                        log.debug("Subscription rejected for user {} to topic {}", userId, destination);
                        return null; // Cleanly drop frame without throwing unhandled channel exceptions
                    }
                }
            }
        }

        return message;
    }

    // Verifies channel access against PostgreSQL public status and membership
    private boolean isAuthorizedForChannel(UUID channelId, UUID userId) {
        if (userId == null) {
            return false;
        }

        String sql = """
            SELECT EXISTS (
                SELECT 1 FROM rw_channels c
                WHERE c.rw_id = ? AND c.rw_is_active = TRUE
                  AND (
                      c.rw_is_private = FALSE
                      OR c.rw_created_by = ?
                      OR EXISTS (
                          SELECT 1 FROM rw_channel_members cm
                          WHERE cm.rw_channel_id = c.rw_id
                            AND cm.rw_user_id = ?
                            AND cm.rw_is_active = TRUE
                      )
                      OR EXISTS (
                          SELECT 1 FROM rw_users u
                          WHERE u.rw_id = ?
                            AND u.rw_role = 'admin'
                            AND u.rw_is_active = TRUE
                      )
                  )
            )
        """;

        Boolean allowed = jdbcTemplate.queryForObject(sql, Boolean.class, channelId, userId, userId, userId);
        return Boolean.TRUE.equals(allowed);
    }
}
