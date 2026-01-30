import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token automáticamente
api.interceptors.request.use(
  (config) => {
    // Obtener token desde store o localStorage
    const token = useAuthStore.getState().token || localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para manejar errores
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Si es 401, cerrar sesión
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }

    // Normalizar mensaje de error para los stores
    const message =
      error.response?.data?.error || // backend manda { error: '...' }
      error.response?.data?.data?.originalMessage || // tu antiguo throwApiError
      'Error desconocido';

    return Promise.reject({ ...error, message });
  }
);

export default api;
