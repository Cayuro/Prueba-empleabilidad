package com.riwi.messaging.rag;

// Pluggable LLM interface generating natural language responses from context (D-11, D-15)
public interface AiProvider {
    String generateCompletion(String systemPrompt, String context, String query);
}
