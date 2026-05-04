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
        case 403:
          // No autorizado o token inválido/expirado - limpiar sesión
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

// Servicio de onboarding
export const onboarding = {
  uploadPhoto: async (userId, file) => {
    const formData = new FormData();
    formData.append('photo', file);

    const response = await api.post(`/api/user/${userId}/photo`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },

  saveStep: async (userId, step, data = {}) => {
    const response = await api.put(`/api/user/${userId}/onboarding`, data, {
      params: { step },
    });

    return response.data;
  },

  complete: async (userId) => {
    const response = await api.put(`/api/user/${userId}/onboarding/complete`);
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

  /**
   * Streaming SSE: envía la pregunta y llama a los callbacks conforme
   * llegan los tokens, sin esperar la respuesta completa.
   *
   * Conecta directamente al backend (port 3000) para evitar el buffering
   * interno del proxy de Vite que impide el streaming en tiempo real.
   *
   * @param {string} question
   * @param {string} userId
   * @param {(token: string) => void} onToken
   * @param {(err: Error) => void}   onError
   * @param {() => void}             onDone
   */
  askStream: async (question, userId, onToken, onError, onDone) => {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    // Conecta directamente al backend para evitar buffering del proxy de Vite
    const streamUrl = import.meta.env.VITE_STREAM_URL || 'http://localhost:3000';
    let response;

    try {
      response = await fetch(`${streamUrl}/api/chat/ask/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ question, userData: { userId } }),
      });
    } catch (networkErr) {
      onError?.(new Error('Error de red al conectar con el servidor'));
      return;
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      onError?.(new Error(errData.message || `Error del servidor (${response.status})`));
      return;
    }

    if (!response.body) {
      onError?.(new Error('El servidor no soporta streaming. Intenta recargar la página.'));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        // Los eventos SSE están separados por \n\n
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          const raw = line.slice(5).trim();
          try {
            const parsed = JSON.parse(raw);
            if (parsed.error) { onError?.(new Error(parsed.error)); return; }
            if (parsed.done) { onDone?.(); return; }
            if (parsed.token != null) onToken?.(parsed.token);
          } catch { /* ignorar líneas no-JSON */ }
        }
      }
    } catch (readErr) {
      onError?.(new Error('Se interrumpió la conexión con el servidor'));
      return;
    } finally {
      reader.releaseLock();
    }

    onDone?.();
  },
};

// Servicio de chat con candidato específico (por ID)
export const candidateChatService = {
  ask: async (candidateId, message) => {
    const response = await api.post(`/api/chat/candidate/${candidateId}`, { message });
    return response.data;
  },

  /**
   * Igual que ask() pero con SSE streaming token a token.
   * Conecta directo al backend (port 3000) para evitar el buffering del proxy de Vite.
   */
  askStream: async (candidateId, message, onToken, onError, onDone) => {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    const streamUrl = import.meta.env.VITE_STREAM_URL || 'http://localhost:3000';
    let response;

    try {
      response = await fetch(`${streamUrl}/api/chat/candidate/${candidateId}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message }),
      });
    } catch (networkErr) {
      onError?.(new Error('Error de red al conectar con el servidor'));
      return;
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      onError?.(new Error(errData.message || `Error del servidor (${response.status})`));
      return;
    }

    if (!response.body) {
      onError?.(new Error('El servidor no soporta streaming.'));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          const raw = line.slice(5).trim();
          try {
            const parsed = JSON.parse(raw);
            if (parsed.error) { onError?.(new Error(parsed.error)); return; }
            if (parsed.done) { onDone?.(); return; }
            if (parsed.token != null) onToken?.(parsed.token);
          } catch { /* ignorar líneas no-JSON */ }
        }
      }
    } catch (readErr) {
      onError?.(new Error('Se interrumpió la conexión con el servidor'));
      return;
    } finally {
      reader.releaseLock();
    }

    onDone?.();
  },
};

// Servicio de candidatos públicos
export const candidatesService = {
  getAll: async () => {
    const response = await api.get('/api/candidates');
    return response.data;
  },
};

// Servicio de FAQs por candidato
export const faqService = {
  list: async (candidateId, includeInactive = false) => {
    const response = await api.get(`/api/candidates/${candidateId}/faqs`, {
      params: { includeInactive },
    });
    return response.data;
  },

  create: async (candidateId, { question, answer, priority = 50 }) => {
    const response = await api.post(`/api/candidates/${candidateId}/faqs`, {
      question,
      answer,
      priority,
    });
    return response.data;
  },

  update: async (candidateId, faqId, { question, answer, priority, isActive }) => {
    const response = await api.put(`/api/candidates/${candidateId}/faqs/${faqId}`, {
      question,
      answer,
      priority,
      isActive,
    });
    return response.data;
  },

  remove: async (candidateId, faqId) => {
    const response = await api.delete(`/api/candidates/${candidateId}/faqs/${faqId}`);
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

