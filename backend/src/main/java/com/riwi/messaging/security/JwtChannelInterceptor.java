package com.riwi.messaging.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.List;
import java.util.UUID;

// Intercepts WebSocket CONNECT frame to validate JWT and attach Principal user ID
@Component
public class JwtChannelInterceptor implements ChannelInterceptor {

    private static final Logger log = LoggerFactory.getLogger(JwtChannelInterceptor.class);
    private final JwtUtil jwtUtil;

    public JwtChannelInterceptor(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
            List<String> authHeaders = accessor.getNativeHeader("Authorization");
            String authHeader = (authHeaders != null && !authHeaders.isEmpty()) ? authHeaders.get(0) : null;

            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7).trim();
                if (!token.isEmpty() && !"null".equalsIgnoreCase(token) && !"undefined".equalsIgnoreCase(token) && token.startsWith("ey") && token.split("\\.").length == 3) {
                    try {
                        UUID userId = jwtUtil.extractUserId(token);
                        accessor.setUser(new StompPrincipal(userId.toString()));
                        log.info("WebSocket STOMP connected for user: {}", userId);
                    } catch (Exception e) {
                        log.warn("Invalid JWT in WebSocket CONNECT header: {}", e.getMessage());
                    }
                }
            }
        }

        return message;
    }

    // Custom Principal holding authenticated user UUID
    public record StompPrincipal(String name) implements Principal {
        @Override
        public String getName() {
            return name;
        }
    }
}
