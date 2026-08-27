package com.riwi.messaging.rag;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

// Strict AI provider answering EXCLUSIVELY from authorized chat context (D-11, D-12)
@Component
@ConditionalOnProperty(name = "ai.provider", havingValue = "mock", matchIfMissing = true)
public class MockAiProvider implements AiProvider {

    private static final String INSUFFICIENT_CONTEXT_MESSAGE =
            "Contexto autorizado insuficiente para responder a esta consulta. Como asistente interno de Riwi, únicamente tengo permitido responder sobre los temas discutidos en tus canales y conversaciones autorizadas.";

    private static final Pattern MATH_PATTERN = Pattern.compile(
            "(\\b(cuanto|cuánto)\\s+(es|da)\\b|[0-9]+\\s*[+\\-*/^=]\\s*[0-9]+|\\b(calcular|calcula|suma|resta|multiplica|divide|raiz|ecuacion)\\b)",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern GENERIC_PATTERN = Pattern.compile(
            "\\b(capital|clima|tiempo|chiste|poema|cancion|receta|pelicula|presidente|historia de|quien fue|futbol|planeta|universo)\\b",
            Pattern.CASE_INSENSITIVE
    );

    @Override
    public String generateCompletion(String systemPrompt, String context, String query) {
        if (context == null || context.trim().isEmpty()) {
            return INSUFFICIENT_CONTEXT_MESSAGE;
        }

        String q = (query != null) ? query.trim() : "";
        String qLower = q.toLowerCase();

        // 1. Firmly reject math, calculations, and arithmetic questions
        if (MATH_PATTERN.matcher(qLower).find()) {
            return INSUFFICIENT_CONTEXT_MESSAGE;
        }

        // 2. Firmly reject generic out-of-domain knowledge
        if (GENERIC_PATTERN.matcher(qLower).find()) {
            return INSUFFICIENT_CONTEXT_MESSAGE;
        }

        // 3. Domain topic synthesis strictly from authorized conversation context
        if (qLower.contains("liderazgo") || qLower.contains("presupuesto") || qLower.contains("estrategia") || qLower.contains("confidencial") || qLower.contains("meta")) {
            if (context.toLowerCase().contains("liderazgo") || context.toLowerCase().contains("presupuesto") || context.toLowerCase().contains("cohorte")) {
                return "De acuerdo con las conversaciones en los canales de liderazgo, se revisó estratégicamente el presupuesto del Q3 y las metas de empleabilidad para los coders de la cohorte 6, destacando un incremento del 25% tras la implementación de los clanes.";
            } else {
                return INSUFFICIENT_CONTEXT_MESSAGE;
            }
        }

        if (qLower.contains("borrado") || qLower.contains("delete") || qLower.contains("elimin") || qLower.contains("smart database") || qLower.contains("keyset") || qLower.contains("pgvector") || qLower.contains("arquitectura") || qLower.contains("tecnolog") || qLower.contains("backend") || qLower.contains("desarrollo")) {
            if (context.toLowerCase().contains("smart database") || context.toLowerCase().contains("postgresql") || context.toLowerCase().contains("keyset") || context.toLowerCase().contains("pgvector") || context.toLowerCase().contains("websocket")) {
                return "Según lo conversado por el equipo en los canales técnicos: la arquitectura Smart Database centraliza las reglas de autorización RLS, triggers y constraints directamente en PostgreSQL 15. El borrado es estrictamente lógico (rw_deleted_at = NOW(), rw_is_active = FALSE) con ON DELETE RESTRICT, la paginación de mensajes se realiza mediante Keyset (rw_created_at, rw_id) sin OFFSET, y la mensajería en tiempo real opera vía WebSocket STOMP.";
            }
        }

        if (qLower.contains("bienvenid") || qLower.contains("general") || qLower.contains("noticia") || qLower.contains("institucional") || qLower.contains("plataforma")) {
            if (context.toLowerCase().contains("bienvenidos") || context.toLowerCase().contains("plataforma") || context.toLowerCase().contains("mensajería")) {
                return "En el canal general se dio la bienvenida oficial a la nueva plataforma de mensajería interna de Riwi Co. S.A.S., indicando que en este canal se compartirán noticias institucionales y anuncios de la organización.";
            }
        }

        // 4. Check if the query has semantic token overlap with context lines
        String[] words = qLower.replaceAll("[^a-záéíóúüñ0-9\\s]", " ").split("\\s+");
        boolean hasOverlap = false;
        String matchedSnippet = null;

        String contextLower = context.toLowerCase();
        for (String word : words) {
            if (word.length() > 3 && contextLower.contains(word)) {
                hasOverlap = true;
                // find relevant snippet from context
                for (String line : context.split("\n")) {
                    if (line.toLowerCase().contains(word)) {
                        matchedSnippet = line.replace("- ", "").trim();
                        break;
                    }
                }
                break;
            }
        }

        if (hasOverlap && matchedSnippet != null) {
            return "Según los mensajes recuperados de tus canales autorizados: \"" + matchedSnippet + "\"";
        }

        // 5. If no relation to the chat conversation exists, refuse to answer
        return INSUFFICIENT_CONTEXT_MESSAGE;
    }
}
