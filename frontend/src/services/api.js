import axios from 'axios';
import { API_BASE_URL, STORAGE_KEYS, ERROR_MESSAGES, API_ENDPOINTS } from '../utils/constants';

// Dispatch limpio de sesión — AuthContext escucha este evento para limpiar estado React
function dispatchLogout() {
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  window.dispatchEvent(new Event('auth:logout'));
}

// Control de inflight refresh para no hacer múltiples llamadas simultáneas
let refreshPromise = null;
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
        case 403: {
          // Intentar renovar el token con el refresh token antes de cerrar sesión
          const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

          // No intentar refresh en la propia llamada de refresh (evitar loop infinito)
          const isRefreshCall = error.config?.url?.includes('/api/user/refresh');
          const isLoginCall = error.config?.url?.includes('/api/user/google');

          if (refreshToken && !isRefreshCall && !isLoginCall) {
            // Reutilizar el mismo promise si ya hay un refresh en vuelo
            if (!refreshPromise) {
              refreshPromise = axios
                .post(`${API_BASE_URL}/api/user/refresh`, { refreshToken })
                .then((res) => {
                  const { token, refreshToken: newRefresh } = res.data;
                  localStorage.setItem(STORAGE_KEYS.TOKEN, token);
                  if (newRefresh) localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, newRefresh);
                  return token;
                })
                .catch(() => {
                  dispatchLogout();
                  return null;
                })
                .finally(() => {
                  refreshPromise = null;
                });
            }

            return refreshPromise.then((newToken) => {
              if (!newToken) return Promise.reject(new Error(ERROR_MESSAGES.UNAUTHORIZED));
              // Reintentar la petición original con el nuevo token
              error.config.headers.Authorization = `Bearer ${newToken}`;
              return axios(error.config);
            });
          }

          // Sin refresh token o llamada de login fallida → limpiar sesión completamente
          dispatchLogout();
          return Promise.reject(new Error(ERROR_MESSAGES.UNAUTHORIZED));
        }
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

  logout: async (bearerToken) => {
    try {
      await axios.post(
        `${API_BASE_URL}/api/user/logout`,
        {},
        { headers: { Authorization: `Bearer ${bearerToken}` } },
      );
    } catch {
      // Best-effort: no propagar error de logout al usuario
    }
  },

  refresh: async (refreshToken) => {
    const response = await axios.post(`${API_BASE_URL}/api/user/refresh`, { refreshToken });
    return response.data;
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

  createSectionItem: async (userId, sectionKey, payload) => {
    const response = await api.post(`/api/user/${userId}/section/${sectionKey}`, payload);
    return response.data;
  },

  updateSectionItem: async (userId, sectionKey, itemId, payload) => {
    const response = await api.put(`/api/user/${userId}/section/${sectionKey}/${itemId}`, payload);
    return response.data;
  },

  deleteSectionItem: async (userId, sectionKey, itemId) => {
    const response = await api.delete(`/api/user/${userId}/section/${sectionKey}/${itemId}`);
    return response.data;
  },

  updateRole: async (userId, role) => {
    const response = await api.patch(`/api/user/${userId}/role`, { role });
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
  askStream: async (candidateId, message, onToken, onError, onDone, options = {}) => {
    const { signal, onEvent } = options;
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
        signal,
        body: JSON.stringify({ message }),
      });
    } catch (networkErr) {
      if (networkErr?.name === 'AbortError') {
        const abortErr = new Error('Solicitud cancelada por el usuario');
        abortErr.name = 'AbortError';
        onError?.(abortErr);
        return;
      }
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
          if (!line) continue;

          const sseLines = line.split('\n');
          const eventLine = sseLines.find((entry) => entry.startsWith('event:'));
          const eventName = eventLine ? eventLine.slice(6).trim() : '';
          const dataLines = sseLines.filter((entry) => entry.startsWith('data:'));
          if (dataLines.length === 0) continue;

          const raw = dataLines.map((entry) => entry.slice(5).trim()).join('\n').trim();
          try {
            const parsed = JSON.parse(raw);
            if (eventName && parsed && typeof parsed === 'object' && !parsed.eventType) {
              parsed.eventType = eventName;
            }

            onEvent?.(parsed);
            if (parsed.error) { onError?.(new Error(parsed.error)); return; }
            if (parsed.done) { onDone?.(); return; }
            if (parsed.token != null) onToken?.(parsed.token);
          } catch { /* ignorar líneas no-JSON */ }
        }
      }
    } catch (readErr) {
      if (readErr?.name === 'AbortError') {
        const abortErr = new Error('Solicitud cancelada por el usuario');
        abortErr.name = 'AbortError';
        onError?.(abortErr);
        return;
      }
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

// Servicio de observabilidad/metricas
export const metricsService = {
  overview: async (hours = 24) => {
    const safeHours = Number.isFinite(Number(hours)) ? Number(hours) : 24;
    const response = await api.get('/api/metrics/overview', {
      params: { hours: safeHours },
    });
    return response.data;
  },
};

export default api;

