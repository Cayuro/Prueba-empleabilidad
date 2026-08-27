package com.riwi.messaging.rag;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

// Mock AI provider generating contextual responses for integration testing and offline MVP (D-11)
@Component
@ConditionalOnProperty(name = "ai.provider", havingValue = "mock", matchIfMissing = true)
public class MockAiProvider implements AiProvider {

    @Override
    public String generateCompletion(String systemPrompt, String context, String query) {
        if (context == null || context.isBlank()) {
            return "No se encontró información relevante o autorizada en los canales accesibles para responder a esta consulta.";
        }

        String qLower = query.toLowerCase();

        if (qLower.contains("liderazgo") || qLower.contains("presupuesto") || qLower.contains("estrategia") || qLower.contains("confidencial")) {
            return "En base a los mensajes analizados de los canales autorizados de liderazgo, se acordó la revisión estratégica del presupuesto Q3 y metas de empleabilidad para los coders de la cohorte 6, observando un incremento del 25% tras la adopción de los clanes.";
        }

        if (qLower.contains("borrado") || qLower.contains("delete") || qLower.contains("smart database") || qLower.contains("keyset") || qLower.contains("pgvector")) {
            return "De acuerdo con las directrices registradas en los canales del equipo, la arquitectura Smart Database establece que toda la lógica de autorización RLS, triggers y constraints reside en PostgreSQL. El borrado es estrictamente lógico (rw_deleted_at = NOW(), rw_is_active = FALSE) con ON DELETE RESTRICT, y la paginación de mensajes se realiza mediante Keyset (rw_created_at, rw_id).";
        }

        return "Según la información recuperada de las conversaciones autorizadas: " + context.substring(0, Math.min(context.length(), 200)).replace("\n", " ") + "...";
    }
}
