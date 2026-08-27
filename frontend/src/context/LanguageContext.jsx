import React, { createContext, useContext, useState, useEffect } from 'react';

// Comprehensive dictionary for Spanish and English
export const translations = {
  es: {
    appTitle: "Riwi Mensajería",
    appSubtitle: "Plataforma Interna con Copiloto IA",
    themeToggle: "Cambiar Tema",
    themeDark: "🌙 Oscuro",
    themeLight: "☀ Claro",
    langToggle: "English",
    
    // Connection status
    statusConnected: "Conectado",
    statusConnecting: "Conectando...",
    statusDisconnected: "Desconectado",
    statusError: "Error de Conexión",
    reconnect: "Reconectar",
    
    // Zone 1: Conversations & Channels
    channelsTitle: "Canales y Chats",
    searchChannelsPlaceholder: "Buscar canal o conversación...",
    allChannels: "Todos los canales",
    unread: "no leídos",
    newChannel: "Nuevo Canal",
    createChannelTitle: "Crear Nuevo Canal",
    channelNameLabel: "Nombre del canal",
    channelNamePlaceholder: "ej. general-anuncios",
    isPrivateLabel: "Canal Privado (solo miembros)",
    createChannelBtn: "Crear Canal",
    cancelBtn: "Cancelar",
    noChannelsFound: "No se encontraron canales",
    loadingChannels: "Cargando canales...",
    errorChannels: "Error al cargar conversaciones",
    publicBadge: "Público",
    privateBadge: "Privado",
    toggleChannels: "Canales",
    toggleCopilot: "Copiloto IA",
    searchMessages: "Buscar mensajes...",
    searchResults: "Resultados de búsqueda",
    noSearchResults: "No se encontraron mensajes",
    
    // Zone 2: Chat & Messages
    selectChannelPrompt: "Selecciona un canal de la izquierda para comenzar",
    channelMembers: "miembros",
    messageStatusPending: "Enviando...",
    messageStatusSent: "Enviado",
    messageStatusFailed: "Error al enviar",
    retry: "Reintentar",
    typeMessagePlaceholder: "Escribe un mensaje... (Enter para enviar)",
    sendMessageBtn: "Enviar",
    loadingHistory: "Cargando historial...",
    loadOlderMessages: "Cargar mensajes anteriores (Keyset)",
    noMoreMessages: "Has llegado al inicio de la conversación",
    noMessagesInChannel: "No hay mensajes en este canal. ¡Sé el primero en escribir!",
    markAsRead: "Marcar como leído",
    readReceipts: "Leído por",
    deletedMessage: "Este mensaje ha sido eliminado",
    deleteMessage: "Eliminar",
    confirmDeleteMessage: "¿Deseas eliminar este mensaje?",
    
    // Zone 3: Copilot AI
    copilotTitle: "Copiloto IA (RAG)",
    copilotSubtitle: "Consultas contextuales con Row Level Security",
    copilotQueryPlaceholder: "¿Qué se acordó en la reunión de despliegue?",
    copilotAskBtn: "Consultar Copiloto",
    copilotAskingBtn: "Consultando contexto...",
    copilotTokensUsed: "Tokens usados:",
    copilotTotalTokens: "Total de tokens:",
    copilotTotalQueries: "Consultas totales:",
    copilotCitations: "Citas y Contexto Utilizado:",
    copilotNoCitations: "Sin citas referenciadas",
    copilotInsufficientContext: "Contexto autorizado insuficiente para responder a esta consulta.",
    copilotEmptyHistory: "Haz una pregunta para consultar el historial autorizado de mensajes.",
    copilotSystemVersion: "Versión de Prompt:",
    copilotUsageStats: "Métricas de Consumo",
    
    // Zone 4: User Profile & Session
    userProfileTitle: "Perfil de Usuario",
    userName: "Nombre:",
    userEmail: "Correo:",
    userRole: "Rol:",
    roleAdmin: "Administrador",
    roleMember: "Miembro",
    switchUserBtn: "Cambiar Usuario (Simulación)",
    logoutBtn: "Cerrar Sesión",
    sessionActive: "Sesión activa",
    closeBtn: "Cerrar",
    
    // Login & Register Screen
    loginTitle: "Iniciar Sesión",
    loginSubtitle: "Ingresa tus credenciales para acceder a la plataforma",
    registerTitle: "Crear Cuenta",
    registerSubtitle: "Regístrate para unirte a la plataforma de Riwi",
    tabLogin: "Iniciar Sesión",
    tabRegister: "Registrarse",
    nameLabel: "Nombre Completo",
    namePlaceholder: "ej. Alejandro Castro",
    emailLabel: "Correo Electrónico",
    passwordLabel: "Contraseña",
    loginBtn: "Ingresar",
    loggingInBtn: "Verificando...",
    registerBtn: "Crear Cuenta",
    registeringBtn: "Creando cuenta...",
    haveAccount: "¿Ya tienes cuenta? Inicia sesión",
    needAccount: "¿No tienes cuenta? Regístrate aquí",
    demoUsersTitle: "Usuarios de demostración disponibles:",
    invalidCredentials: "Credenciales inválidas. Por favor intenta de nuevo.",
  },
  en: {
    appTitle: "Riwi Messaging",
    appSubtitle: "Internal Platform with AI Copilot",
    themeToggle: "Toggle Theme",
    themeDark: "🌙 Dark",
    themeLight: "☀ Light",
    langToggle: "Español",
    
    // Connection status
    statusConnected: "Connected",
    statusConnecting: "Connecting...",
    statusDisconnected: "Disconnected",
    statusError: "Connection Error",
    reconnect: "Reconnect",
    
    // Zone 1: Conversations & Channels
    channelsTitle: "Channels & Chats",
    searchChannelsPlaceholder: "Search channel or conversation...",
    allChannels: "All channels",
    unread: "unread",
    newChannel: "New Channel",
    createChannelTitle: "Create New Channel",
    channelNameLabel: "Channel name",
    channelNamePlaceholder: "e.g. general-announcements",
    isPrivateLabel: "Private Channel (members only)",
    createChannelBtn: "Create Channel",
    cancelBtn: "Cancel",
    noChannelsFound: "No channels found",
    loadingChannels: "Loading channels...",
    errorChannels: "Error loading conversations",
    publicBadge: "Public",
    privateBadge: "Private",
    toggleChannels: "Channels",
    toggleCopilot: "AI Copilot",
    searchMessages: "Search messages...",
    searchResults: "Search Results",
    noSearchResults: "No messages found",
    
    // Zone 2: Chat & Messages
    selectChannelPrompt: "Select a channel on the left to start chatting",
    channelMembers: "members",
    messageStatusPending: "Sending...",
    messageStatusSent: "Sent",
    messageStatusFailed: "Failed to send",
    retry: "Retry",
    typeMessagePlaceholder: "Type a message... (Press Enter to send)",
    sendMessageBtn: "Send",
    loadingHistory: "Loading history...",
    loadOlderMessages: "Load earlier messages (Keyset)",
    noMoreMessages: "You have reached the beginning of the conversation",
    noMessagesInChannel: "No messages in this channel yet. Be the first to post!",
    markAsRead: "Mark as read",
    readReceipts: "Read by",
    deletedMessage: "This message was deleted",
    deleteMessage: "Delete",
    confirmDeleteMessage: "Do you want to delete this message?",
    
    // Zone 3: Copilot AI
    copilotTitle: "AI Copilot (RAG)",
    copilotSubtitle: "Contextual queries with Row Level Security",
    copilotQueryPlaceholder: "What was agreed in the deployment meeting?",
    copilotAskBtn: "Ask Copilot",
    copilotAskingBtn: "Querying context...",
    copilotTokensUsed: "Tokens used:",
    copilotTotalTokens: "Total tokens:",
    copilotTotalQueries: "Total queries:",
    copilotCitations: "Citations & Used Context:",
    copilotNoCitations: "No citations referenced",
    copilotInsufficientContext: "Insufficient authorized context to answer this query.",
    copilotEmptyHistory: "Ask a question to query authorized message history.",
    copilotSystemVersion: "Prompt Version:",
    copilotUsageStats: "Usage Metrics",
    
    // Zone 4: User Profile & Session
    userProfileTitle: "User Profile",
    userName: "Name:",
    userEmail: "Email:",
    userRole: "Role:",
    roleAdmin: "Administrator",
    roleMember: "Member",
    switchUserBtn: "Switch User (Simulation)",
    logoutBtn: "Sign Out",
    sessionActive: "Active session",
    closeBtn: "Close",
    
    // Login & Register Screen
    loginTitle: "Log In",
    loginSubtitle: "Enter your credentials to access the platform",
    registerTitle: "Create Account",
    registerSubtitle: "Sign up to join the Riwi messaging platform",
    tabLogin: "Log In",
    tabRegister: "Register",
    nameLabel: "Full Name",
    namePlaceholder: "e.g. Alejandro Castro",
    emailLabel: "Email Address",
    passwordLabel: "Password",
    loginBtn: "Log In",
    loggingInBtn: "Verifying...",
    registerBtn: "Create Account",
    registeringBtn: "Creating account...",
    haveAccount: "Already have an account? Log in",
    needAccount: "Don't have an account? Register here",
    demoUsersTitle: "Available demo users:",
    invalidCredentials: "Invalid credentials. Please try again.",
  }
};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  // Read persisted language or default to Spanish per spec
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('rw_lang') || 'es';
  });

  // Persist language changes to localStorage
  useEffect(() => {
    localStorage.setItem('rw_lang', lang);
  }, [lang]);

  // Toggle language between Spanish and English
  const toggleLanguage = () => {
    setLang((prev) => (prev === 'es' ? 'en' : 'es'));
  };

  // Get current active translation dictionary
  const t = translations[lang] || translations.es;

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

// Hook for accessing translations and language state
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
