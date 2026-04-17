import axios from 'axios';
import { API_BASE_URL, STORAGE_KEYS, ERROR_MESSAGES } from '../utils/constants';

// Crear instancia de axios con configuración base
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token a las peticiones
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores de respuesta
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      // El servidor respondió con un código de estado fuera del rango 2xx
      switch (error.response.status) {
        case 400: {
          // Error de solicitud - mostrar mensaje del servidor
          const errorMessage = error.response.data?.message || 
                              error.response.data?.error || 
                              'Error en la solicitud. Por favor, verifica los datos e intenta nuevamente.';
          return Promise.reject(new Error(errorMessage));
        }
        case 401:
          // No autorizado - limpiar token y datos del usuario
          localStorage.removeItem(STORAGE_KEYS.TOKEN);
          localStorage.removeItem(STORAGE_KEYS.USER);
          // El componente ProtectedRoute manejará la redirección
          return Promise.reject(new Error(ERROR_MESSAGES.UNAUTHORIZED));
        case 404:
          return Promise.reject(new Error(ERROR_MESSAGES.NOT_FOUND));
        case 500:
          return Promise.reject(
            new Error(
              error.response.data?.message ||
              error.response.data?.error ||
              ERROR_MESSAGES.SERVER_ERROR
            )
          );
        default:
          return Promise.reject(
            new Error(error.response.data?.message || error.response.data?.error || ERROR_MESSAGES.UNKNOWN_ERROR)
          );
      }
    } else if (error.request) {
      // La petición fue hecha pero no se recibió respuesta
      return Promise.reject(new Error(ERROR_MESSAGES.NETWORK_ERROR));
    } else {
      // Algo pasó al configurar la petición
      return Promise.reject(new Error(error.message || ERROR_MESSAGES.UNKNOWN_ERROR));
    }
  }
);

// Servicio de autenticación
export const authService = {
  loginWithGoogle: async (credential) => {
    if (!credential) {
      throw new Error('No se proporcionó un credential de Google. Por favor, intenta iniciar sesión nuevamente.');
    }
    
    try {
      const response = await api.post('/api/user/google', { credential });
      return response.data;
    } catch (error) {
      // Si el error ya tiene un mensaje, lanzarlo tal cual
      if (error.message) {
        throw error;
      }
      // Si no, crear un error genérico
      throw new Error(error.response?.data?.message || 'Error al iniciar sesión con Google');
    }
  },
};

// Servicio de usuario
export const userService = {
  getProfile: async (userId) => {
    const response = await api.get(`/api/user/${userId}`);
    return response.data;
  },

  updateProfile: async (userId, profileData) => {
    const response = await api.put(`/api/user/${userId}/data`, {
      ...profileData,
      userId,
    });
    return response.data;
  },
};

// Servicio de chat (propio del usuario)
export const chatService = {
  askQuestion: async (question, userId) => {
    const response = await api.post('/api/chat/ask', {
      question,
      userData: { userId },
    });
    return response.data;
  },
};

// Servicio de chat con candidato específico (por ID)
export const candidateChatService = {
  ask: async (candidateId, message) => {
    const response = await api.post(`/api/chat/candidate/${candidateId}`, { message });
    return response.data;
  },
};

// Servicio de candidatos públicos
export const candidatesService = {
  getAll: async () => {
    const response = await api.get('/api/candidates');
    return response.data;
  },
};

// Servicio de recruiting con IA
export const recruiterService = {
  chat: async ({ message, conversationHistory = [], phase = 'collect', jobProfile = {} }) => {
    const response = await api.post('/api/recruiter/chat', {
      message,
      conversationHistory,
      phase,
      jobProfile,
    });
    return response.data;
  },
};

export default api;

