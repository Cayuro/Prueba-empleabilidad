package com.riwi.messaging.config;

import com.riwi.messaging.exception.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;

// In-memory sliding window rate limiter for login and copilot endpoints
@Service
public class RateLimiterService {

    private final ConcurrentHashMap<String, ConcurrentLinkedQueue<Long>> requestCounts = new ConcurrentHashMap<>();

    // Checks and enforces rate limit for a given key over 1 minute window
    public void checkRateLimit(String key, int maxRequestsPerMinute) {
        long now = System.currentTimeMillis();
        long windowStart = now - 60_000;

        ConcurrentLinkedQueue<Long> timestamps = requestCounts.computeIfAbsent(key, k -> new ConcurrentLinkedQueue<>());

        // Evicts timestamps older than 60 seconds
        while (!timestamps.isEmpty() && timestamps.peek() < windowStart) {
            timestamps.poll();
        }

        if (timestamps.size() >= maxRequestsPerMinute) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMIT_EXCEEDED", "Rate limit exceeded. Please try again in 1 minute.");
        }

        timestamps.add(now);
    }
}
