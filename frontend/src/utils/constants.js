// Configuración de la aplicación
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
export const API_ENDPOINTS = {
  AUTH: {
    GOOGLE: '/api/user/google',
  },
  USER: {
    PROFILE: (userId) => `/api/user/${userId}`,
    UPDATE: (userId) => `/api/user/${userId}/data`,
  },
  CHAT: {
    ASK: '/api/chat/ask',
  },
};

// Claves de almacenamiento local
export const STORAGE_KEYS = {
  TOKEN: 'token',
  USER: 'user',
};

// Mensajes de error
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Error de conexión. Por favor, verifica tu conexión a internet.',
  UNAUTHORIZED: 'No estás autorizado. Por favor, inicia sesión nuevamente.',
  NOT_FOUND: 'No se encontró el recurso solicitado.',
  SERVER_ERROR: 'Error del servidor. Por favor, intenta más tarde.',
  UNKNOWN_ERROR: 'Ocurrió un error inesperado.',
};

// Mensajes de éxito
export const SUCCESS_MESSAGES = {
  PROFILE_SAVED: 'Datos guardados correctamente',
  LOGIN_SUCCESS: 'Inicio de sesión exitoso',
  LOGOUT_SUCCESS: 'Sesión cerrada correctamente',
};

