package com.riwi.messaging;

import com.riwi.messaging.config.RateLimiterService;
import com.riwi.messaging.exception.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.junit.jupiter.api.Assertions.*;

// Unit test verifying sliding window rate limiting
class RateLimiterTest {

    @Test
    void testRateLimitEnforced() {
        RateLimiterService service = new RateLimiterService();
        String key = "test:client:1";

        // First 3 requests under limit 3 should succeed
        for (int i = 0; i < 3; i++) {
            assertDoesNotThrow(() -> service.checkRateLimit(key, 3));
        }

        // 4th request must throw 429 TOO_MANY_REQUESTS
        ApiException ex = assertThrows(ApiException.class, () -> service.checkRateLimit(key, 3));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, ex.getStatus());
        assertEquals("RATE_LIMIT_EXCEEDED", ex.getError());
    }
}
