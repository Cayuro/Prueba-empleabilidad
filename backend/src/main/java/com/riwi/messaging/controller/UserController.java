package com.riwi.messaging.controller;

import com.riwi.messaging.security.DbContextHelper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

// Thin User Controller delegating to PostgreSQL stored procedures (rw_sp_get_users, rw_sp_maintain_user)
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final JdbcTemplate jdbcTemplate;
    private final DbContextHelper dbContextHelper;

    public UserController(JdbcTemplate jdbcTemplate, DbContextHelper dbContextHelper) {
        this.jdbcTemplate = jdbcTemplate;
        this.dbContextHelper = dbContextHelper;
    }

    // Calls rw_sp_get_users stored procedure to query users with optional filter
    @GetMapping
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getUsers(
            @RequestParam(required = false, defaultValue = "") String search,
            @RequestParam(required = false, defaultValue = "50") int limit,
            HttpServletRequest request) {
        UUID currentUserId = dbContextHelper.getRequiredUserId(request);
        dbContextHelper.setCurrentUser(jdbcTemplate, currentUserId);

        return jdbcTemplate.queryForList(
                "SELECT rw_id, rw_email, rw_name, rw_role, rw_is_active, rw_created_at, rw_updated_at FROM rw_fn_get_users(?, ?)",
                search,
                Math.min(limit, 100)
        );
    }

    // Updates user attributes using rw_sp_maintain_user procedure
    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<Map<String, Object>> updateUser(
            @PathVariable UUID id,
            @RequestBody Map<String, String> body,
            HttpServletRequest request) {
        UUID currentUserId = dbContextHelper.getRequiredUserId(request);
        dbContextHelper.setCurrentUser(jdbcTemplate, currentUserId);

        String name = body.get("name");
        String role = body.get("role");

        jdbcTemplate.update("CALL rw_sp_maintain_user(?::uuid, ?, ?, 'UPDATE')", id, name, role);

        return ResponseEntity.ok(Map.of(
                "id", id.toString(),
                "name", name != null ? name : "",
                "role", role != null ? role : "",
                "status", "updated"
        ));
    }

    // Soft-deletes user using rw_sp_maintain_user procedure
    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> deleteUser(@PathVariable UUID id, HttpServletRequest request) {
        UUID currentUserId = dbContextHelper.getRequiredUserId(request);
        dbContextHelper.setCurrentUser(jdbcTemplate, currentUserId);

        jdbcTemplate.update("CALL rw_sp_maintain_user(?::uuid, NULL, NULL, 'DELETE')", id);

        return ResponseEntity.noContent().build();
    }
}
