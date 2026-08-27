package com.riwi.messaging;

import com.riwi.messaging.security.JwtUtil;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

// Unit test verifying 15-minute JWT generation and validation according to D-07
class JwtUtilTest {

    private final JwtUtil jwtUtil = new JwtUtil("my_super_secret_test_key_minimum_32_characters_long_12345", 15);

    @Test
    void testTokenGenerationAndExtraction() {
        UUID userId = UUID.randomUUID();
        String token = jwtUtil.generateAccessToken(userId);

        assertNotNull(token);
        assertTrue(jwtUtil.validateToken(token));
        assertEquals(userId, jwtUtil.extractUserId(token));
    }

    @Test
    void testPasswordBcrypt() {
        org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder enc = new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder();
        System.out.println("ADMIN_HASH=" + enc.encode("RiwiAdmin2026!"));
        System.out.println("DEV_HASH=" + enc.encode("RiwiDev2026!"));
    }
}
