package com.riwi.messaging.security;

import com.riwi.messaging.exception.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.UUID;

// Helper to propagate app.current_user_id to PostgreSQL session in @Transactional methods (D-01, D-12)
@Component
public class DbContextHelper {

    // Validates that the user actually exists in rw_users before proceeding
    public void validateUserExists(JdbcTemplate jdbcTemplate, UUID userId) {
        if (userId == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "User is not authenticated");
        }
        try {
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM rw_users WHERE rw_id = ? AND rw_is_active = TRUE",
                    Integer.class,
                    userId
            );
            if (count == null || count == 0) {
                throw new ApiException(HttpStatus.UNAUTHORIZED, "USER_NOT_FOUND", "Session is invalid or user was not found in database");
            }
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "USER_NOT_FOUND", "Session is invalid or user was not found in database");
        }
    }

    // Sets the database session variable for PostgreSQL Row Level Security (RLS)
    public void setCurrentUser(JdbcTemplate jdbcTemplate, UUID userId) {
        if (userId != null) {
            validateUserExists(jdbcTemplate, userId);
            jdbcTemplate.queryForObject("SELECT set_config('app.current_user_id', ?, true)", String.class, userId.toString());
        }
    }

    // Extracts authenticated user ID from request attributes or throws 401 Unauthorized
    public UUID getRequiredUserId(HttpServletRequest request) {
        Object userIdObj = request.getAttribute("current_user_id");
        if (userIdObj instanceof UUID uuid) {
            return uuid;
        }
        if (userIdObj instanceof String str && !str.isBlank()) {
            return UUID.fromString(str);
        }
        throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "User is not authenticated");
    }
}
