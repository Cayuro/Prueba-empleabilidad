package com.riwi.messaging.controller;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.riwi.messaging.config.RateLimiterService;
import com.riwi.messaging.exception.ApiException;
import com.riwi.messaging.security.DbContextHelper;
import com.riwi.messaging.security.JwtUtil;

import jakarta.servlet.http.HttpServletRequest;

// Authentication Controller issuing 15-minute access tokens and rotating refresh tokens (D-07, D-08, D-09, D-13)
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final JdbcTemplate jdbcTemplate;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;
    private final RateLimiterService rateLimiterService;
    private final DbContextHelper dbContextHelper;

    public AuthController(
            JdbcTemplate jdbcTemplate,
            JwtUtil jwtUtil,
            PasswordEncoder passwordEncoder,
            RateLimiterService rateLimiterService,
            DbContextHelper dbContextHelper) {
        this.jdbcTemplate = jdbcTemplate;
        this.jwtUtil = jwtUtil;
        this.passwordEncoder = passwordEncoder;
        this.rateLimiterService = rateLimiterService;
        this.dbContextHelper = dbContextHelper;
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

    // Registers a new user via SECURITY DEFINER stored procedure rw_sp_create_user (D-09, D-13)
    @PostMapping("/register")
    @Transactional
    public ResponseEntity<Map<String, Object>> register(@RequestBody Map<String, String> body, HttpServletRequest request) {
        String clientIp = request.getRemoteAddr();
        rateLimiterService.checkRateLimit("register:" + clientIp, 10);

        String email = body.get("email");
        String password = body.get("password");
        String name = body.get("name");

        if (email == null || email.isBlank() || password == null || password.isBlank() || name == null || name.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Name, email and password are required");
        }

        if (password.length() < 6) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Password must be at least 6 characters long");
        }

        // Check if active user already exists
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM rw_users WHERE rw_email = LOWER(TRIM(?)) AND rw_is_active = TRUE",
                Integer.class,
                email
        );
        if (count != null && count > 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "EMAIL_ALREADY_EXISTS", "A user with this email already exists");
        }

        String passwordHash = passwordEncoder.encode(password);

        // Call stored function rw_fn_create_user in PostgreSQL (Smart Database)
        UUID userId = jdbcTemplate.queryForObject(
                "SELECT rw_fn_create_user(?, ?, ?, 'member')",
                UUID.class,
                email.trim(),
                passwordHash,
                name.trim()
        );

        // Set session context for RLS
        dbContextHelper.setCurrentUser(jdbcTemplate, userId);

        String accessToken = jwtUtil.generateAccessToken(userId);
        String rawRefreshToken = UUID.randomUUID().toString();
        String tokenHash = hashToken(rawRefreshToken);

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
                "email", email.trim().toLowerCase(),
                "name", name.trim(),
                "role", "member"
        ));

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
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
        dbContextHelper.setCurrentUser(jdbcTemplate, userId);

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

        String oldTokenHash = hashToken(rawRefreshToken);
        String newRawRefreshToken = UUID.randomUUID().toString();
        String newTokenHash = hashToken(newRawRefreshToken);

        UUID userId;
        try {
            userId = jdbcTemplate.queryForObject(
                    "SELECT rw_fn_rotate_refresh_token(?, ?)",
                    UUID.class,
                    oldTokenHash,
                    newTokenHash
            );
        } catch (Exception e) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid or expired refresh token");
        }

        if (userId == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid or expired refresh token");
        }

        String newAccessToken = jwtUtil.generateAccessToken(userId);

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
                jdbcTemplate.update("CALL rw_sp_revoke_refresh_token(?)", tokenHash);
            }
        }
        return ResponseEntity.noContent().build();
    }
}
