import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService, userService } from '../services/api';
import { STORAGE_KEYS } from '../utils/constants';

const AuthContext = createContext(null);

const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'si' || normalized === 'yes';
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  // Cargar datos del usuario desde localStorage al iniciar
  useEffect(() => {
    const storedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
    const storedUser = localStorage.getItem(STORAGE_KEYS.USER);

    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsedUser);
        setOnboardingCompleted(parseBoolean(parsedUser?.onboarding_completed ?? parsedUser?.onboardingCompleted));
      } catch (error) {
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER);
        localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
        setOnboardingCompleted(false);
      }
    }
    setLoading(false);

    // Escuchar el evento dispatched por api.js cuando el token expira y el refresh falla
    const handleForceLogout = () => {
      setToken(null);
      setUser(null);
      setOnboardingCompleted(false);
    };
    window.addEventListener('auth:logout', handleForceLogout);
    return () => window.removeEventListener('auth:logout', handleForceLogout);
  }, []);

  const login = async (credential) => {
    try {
      if (!credential) {
        throw new Error('No se proporcionó un credential de Google');
      }

      const response = await authService.loginWithGoogle(credential);
      
      if (response.success && response.token && response.user) {
        localStorage.setItem(STORAGE_KEYS.TOKEN, response.token);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.user));
        // Guardar refresh token si el backend lo devuelve (P1-003)
        if (response.refreshToken) {
          localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.refreshToken);
        }
        setToken(response.token);
        setUser(response.user);
        setOnboardingCompleted(parseBoolean(response.user?.onboarding_completed ?? response.user?.onboardingCompleted));
        return { success: true, user: response.user };
      } else {
        const errorMessage = response.message || 
                            response.error || 
                            'Error en el inicio de sesión. Por favor, verifica tus credenciales.';
        console.error('Error en la respuesta del servidor:', errorMessage);
        throw new Error(errorMessage);
      }
    } catch (error) {
      const errorMessage = error.message || 
                          error.response?.data?.message || 
                          error.response?.data?.error ||
                          'Error al iniciar sesión. Por favor, verifica que el backend esté corriendo.';
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    // Notificar al backend para revocar refresh tokens (best-effort)
    try {
      const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
      if (token) {
        await authService.logout(token);
      }
    } catch {
      // Error no crítico — limpiar estado de todas formas
    }
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    setToken(null);
    setUser(null);
    setOnboardingCompleted(false);
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
    setOnboardingCompleted(parseBoolean(userData?.onboarding_completed ?? userData?.onboardingCompleted));
  };

  const updateRole = async (newRole) => {
    if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
    try {
      await userService.updateRole(user.id, newRole);
      // Renovar JWT para que incluya el nuevo role
      const storedRefresh = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (storedRefresh) {
        try {
          const refreshResponse = await authService.refresh(storedRefresh);
          if (refreshResponse?.token) {
            localStorage.setItem(STORAGE_KEYS.TOKEN, refreshResponse.token);
            if (refreshResponse.refreshToken) {
              localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshResponse.refreshToken);
            }
          }
        } catch {
          // No crítico: el role local se actualiza igual
        }
      }
      const updatedUser = { ...user, role: newRole };
      setUser(updatedUser);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message || 'Error al actualizar el rol' };
    }
  };

  const markOnboardingCompleted = (value = true, userData) => {
    const normalizedValue = !!value;
    setOnboardingCompleted(normalizedValue);

    const nextUser = userData || user;
    if (!nextUser) return;

    const updatedUser = {
      ...nextUser,
      onboarding_completed: normalizedValue ? 1 : 0,
      onboardingCompleted: normalizedValue,
    };

    setUser(updatedUser);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
  };

  const value = {
    user,
    token,
    loading,
    onboardingCompleted,
    isAuthenticated: !!user && !!token,
    role: user?.role || 'candidate',
    isRecruiter: user?.role === 'recruiter',
    login,
    logout,
    updateUser,
    updateRole,
    markOnboardingCompleted,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

