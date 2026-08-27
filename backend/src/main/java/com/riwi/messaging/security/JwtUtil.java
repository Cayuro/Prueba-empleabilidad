package com.riwi.messaging.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

// JWT utility generating short-lived 15-minute tokens with ONLY sub, iat, exp claims (D-07, D-08)
@Component
public class JwtUtil {

    private final SecretKey signingKey;
    private final long expirationMillis;

    public JwtUtil(
            @Value("${jwt.secret:changeme_min_32_characters_secret_key_riwi_2026}") String secret,
            @Value("${jwt.expiration-minutes:15}") long expirationMinutes) {
        // Generates HMAC SHA-256 signing key from configured secret string
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            byte[] padded = new byte[32];
            System.arraycopy(keyBytes, 0, padded, 0, Math.min(keyBytes.length, 32));
            this.signingKey = Keys.hmacShaKeyFor(padded);
        } else {
            this.signingKey = Keys.hmacShaKeyFor(keyBytes);
        }
        this.expirationMillis = expirationMinutes * 60 * 1000;
    }

    // Generates short-lived access token containing ONLY subject (UUID), issuedAt and expiration (D-07)
    public String generateAccessToken(UUID userId) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .subject(userId.toString())
                .issuedAt(new Date(now))
                .expiration(new Date(now + expirationMillis))
                .signWith(signingKey)
                .compact();
    }

    // Validates token signature and expiration, extracting the user UUID from the subject claim
    public UUID extractUserId(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
        return UUID.fromString(claims.getSubject());
    }

    // Validates token validity without throwing unhandled exceptions
    public boolean validateToken(String token) {
        try {
            extractUserId(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
