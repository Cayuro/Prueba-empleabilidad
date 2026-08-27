package com.riwi.messaging.controller;

import com.riwi.messaging.config.RateLimiterService;
import com.riwi.messaging.exception.ApiException;
import com.riwi.messaging.security.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

// Thin Auth Controller managing login, token rotation and logout (D-07, D-08)
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final JdbcTemplate jdbcTemplate;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;
    private final RateLimiterService rateLimiterService;

    public AuthController(JdbcTemplate jdbcTemplate, JwtUtil jwtUtil, PasswordEncoder passwordEncoder, RateLimiterService rateLimiterService) {
        this.jdbcTemplate = jdbcTemplate;
        this.jwtUtil = jwtUtil;
        this.passwordEncoder = passwordEncoder;
        this.rateLimiterService = rateLimiterService;
    }

    // Hashes refresh token string with SHA-256 for safe DB storage
    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] encodedhash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : encodedhash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }

    // Authenticates user, verifies password hash, and issues access + refresh tokens
    @PostMapping("/login")
    @Transactional
    public ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, String> body, HttpServletRequest request) {
        String clientIp = request.getRemoteAddr();
        rateLimiterService.checkRateLimit("login:" + clientIp, 10);

        String email = body.get("email");
        String password = body.get("password");

        if (email == null || email.isBlank() || password == null || password.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Email and password are required");
        }

        String sql = "SELECT rw_id, rw_email, rw_password_hash, rw_name, rw_role FROM rw_users WHERE rw_email = LOWER(TRIM(?)) AND rw_is_active = TRUE";
        var users = jdbcTemplate.queryForList(sql, email);

        if (users.isEmpty()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid email or password");
        }

        Map<String, Object> user = users.get(0);
        String passwordHash = (String) user.get("rw_password_hash");

        if (!passwordEncoder.matches(password, passwordHash)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid email or password");
        }

        UUID userId = (UUID) user.get("rw_id");
        String accessToken = jwtUtil.generateAccessToken(userId);
        String rawRefreshToken = UUID.randomUUID().toString();
        String tokenHash = hashToken(rawRefreshToken);

        // Store hashed refresh token in rw_refresh_tokens table
        jdbcTemplate.update(
                "INSERT INTO rw_refresh_tokens (rw_user_id, rw_token_hash, rw_expires_at) VALUES (?, ?, NOW() + INTERVAL '30 days')",
                userId,
                tokenHash
        );

        Map<String, Object> response = new HashMap<>();
        response.put("access_token", accessToken);
        response.put("refresh_token", rawRefreshToken);
        response.put("expires_in", 900);
        response.put("user", Map.of(
                "id", userId.toString(),
                "email", user.get("rw_email"),
                "name", user.get("rw_name"),
                "role", user.get("rw_role")
        ));

        return ResponseEntity.ok(response);
    }

    // Validates refresh token, rotates token pair, and revokes previous token
    @PostMapping("/refresh")
    @Transactional
    public ResponseEntity<Map<String, Object>> refresh(@RequestBody Map<String, String> body) {
        String rawRefreshToken = body.get("refresh_token");
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Refresh token is required");
        }

        String tokenHash = hashToken(rawRefreshToken);
        String sql = "SELECT rw_id, rw_user_id, rw_is_revoked, rw_expires_at FROM rw_refresh_tokens WHERE rw_token_hash = ?";
        var tokens = jdbcTemplate.queryForList(sql, tokenHash);

        if (tokens.isEmpty()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid refresh token");
        }

        Map<String, Object> tokenRecord = tokens.get(0);
        Boolean isRevoked = (Boolean) tokenRecord.get("rw_is_revoked");
        Timestamp expiresAt = (Timestamp) tokenRecord.get("rw_expires_at");

        if (Boolean.TRUE.equals(isRevoked) || (expiresAt != null && expiresAt.toInstant().isBefore(Instant.now()))) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Refresh token is revoked or expired");
        }

        UUID oldTokenId = (UUID) tokenRecord.get("rw_id");
        UUID userId = (UUID) tokenRecord.get("rw_user_id");

        // Issue new token pair and rotate
        String newAccessToken = jwtUtil.generateAccessToken(userId);
        String newRawRefreshToken = UUID.randomUUID().toString();
        String newTokenHash = hashToken(newRawRefreshToken);
        UUID newTokenId = UUID.randomUUID();

        jdbcTemplate.update(
                "INSERT INTO rw_refresh_tokens (rw_id, rw_user_id, rw_token_hash, rw_expires_at) VALUES (?, ?, ?, NOW() + INTERVAL '30 days')",
                newTokenId,
                userId,
                newTokenHash
        );

        jdbcTemplate.update(
                "UPDATE rw_refresh_tokens SET rw_is_revoked = TRUE, rw_replaced_by = ? WHERE rw_id = ?",
                newTokenId,
                oldTokenId
        );

        Map<String, Object> response = new HashMap<>();
        response.put("access_token", newAccessToken);
        response.put("refresh_token", newRawRefreshToken);
        response.put("expires_in", 900);

        return ResponseEntity.ok(response);
    }

    // Revokes refresh token in database during active logout (D-08)
    @PostMapping("/logout")
    @Transactional
    public ResponseEntity<Void> logout(@RequestBody(required = false) Map<String, String> body) {
        if (body != null && body.containsKey("refresh_token")) {
            String rawRefreshToken = body.get("refresh_token");
            if (rawRefreshToken != null && !rawRefreshToken.isBlank()) {
                String tokenHash = hashToken(rawRefreshToken);
                jdbcTemplate.update(
                        "UPDATE rw_refresh_tokens SET rw_is_revoked = TRUE WHERE rw_token_hash = ?",
                        tokenHash
                );
            }
        }
        return ResponseEntity.noContent().build();
    }
}
