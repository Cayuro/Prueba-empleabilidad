package com.riwi.messaging.config;

import com.riwi.messaging.security.JwtChannelInterceptor;
import com.riwi.messaging.security.SubscriptionInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

// WebSocket STOMP broker configuration for real-time messaging on /ws (D-14)
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtChannelInterceptor jwtChannelInterceptor;
    private final SubscriptionInterceptor subscriptionInterceptor;

    public WebSocketConfig(JwtChannelInterceptor jwtChannelInterceptor, SubscriptionInterceptor subscriptionInterceptor) {
        this.jwtChannelInterceptor = jwtChannelInterceptor;
        this.subscriptionInterceptor = subscriptionInterceptor;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic");
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(jwtChannelInterceptor, subscriptionInterceptor);
    }
}
