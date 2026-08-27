package com.riwi.messaging.exception;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.UUID;

// Global exception handler returning uniform error format across all endpoints
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    // Extracts active correlation ID from MDC or generates a fallback UUID
    private String getCorrelationId(HttpServletRequest request) {
        String correlationId = MDC.get("correlation_id");
        if (correlationId == null || correlationId.isBlank()) {
            Object attr = request.getAttribute("correlation_id");
            if (attr != null) {
                correlationId = attr.toString();
            } else {
                correlationId = UUID.randomUUID().toString();
            }
        }
        return correlationId;
    }

    // Handles custom domain API exceptions
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> handleApiException(ApiException ex, HttpServletRequest request) {
        String cid = getCorrelationId(request);
        log.warn("API Exception [{}]: {} - {}", cid, ex.getStatus(), ex.getMessage());
        ErrorResponse body = new ErrorResponse(ex.getError(), ex.getMessage(), cid);
        return ResponseEntity.status(ex.getStatus()).body(body);
    }

    // Handles Spring validation errors on request bodies
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationException(MethodArgumentNotValidException ex, HttpServletRequest request) {
        String cid = getCorrelationId(request);
        String message = ex.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(err -> err.getField() + ": " + err.getDefaultMessage())
                .orElse("Validation failed");
        log.warn("Validation error [{}]: {}", cid, message);
        ErrorResponse body = new ErrorResponse("INVALID_INPUT", message, cid);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    // Handles illegal arguments or malformed UUIDs
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex, HttpServletRequest request) {
        String cid = getCorrelationId(request);
        log.warn("Illegal argument [{}]: {}", cid, ex.getMessage());
        ErrorResponse body = new ErrorResponse("INVALID_INPUT", ex.getMessage(), cid);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    // Handles Spring Security access denied exceptions
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex, HttpServletRequest request) {
        String cid = getCorrelationId(request);
        log.warn("Access denied [{}]: {}", cid, ex.getMessage());
        ErrorResponse body = new ErrorResponse("FORBIDDEN", "Access is denied", cid);
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
    }

    // Handles database constraint, trigger or privilege violations
    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<ErrorResponse> handleDataAccessException(DataAccessException ex, HttpServletRequest request) {
        String cid = getCorrelationId(request);
        log.error("Database access error [{}]: {}", cid, ex.getMessage(), ex);
        String message = ex.getMostSpecificCause() != null ? ex.getMostSpecificCause().getMessage() : ex.getMessage();
        ErrorResponse body = new ErrorResponse("DATABASE_ERROR", message, cid);
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(body);
    }

    // Handles unexpected generic exceptions
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGenericException(Exception ex, HttpServletRequest request) {
        String cid = getCorrelationId(request);
        log.error("Unexpected server error [{}]: {}", cid, ex.getMessage(), ex);
        ErrorResponse body = new ErrorResponse("INTERNAL_SERVER_ERROR", "An unexpected error occurred", cid);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
    }
}
