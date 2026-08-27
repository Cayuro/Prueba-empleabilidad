package com.riwi.messaging.exception;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;

// Standardized error response contract matching spec/api-contract.md
public class ErrorResponse {

    @JsonProperty("error")
    private String error;

    @JsonProperty("message")
    private String message;

    @JsonProperty("correlation_id")
    private String correlationId;

    @JsonProperty("timestamp")
    private String timestamp;

    public ErrorResponse() {
        this.timestamp = Instant.now().toString();
    }

    public ErrorResponse(String error, String message, String correlationId) {
        this.error = error;
        this.message = message;
        this.correlationId = correlationId;
        this.timestamp = Instant.now().toString();
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getCorrelationId() {
        return correlationId;
    }

    public void setCorrelationId(String correlationId) {
        this.correlationId = correlationId;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }
}
