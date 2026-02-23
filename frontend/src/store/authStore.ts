import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '../lib/authApi';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { t } from 'i18next';
import type { AxiosError } from 'axios';

// Helper to extract error message from AxiosError
const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) {
    const axiosErr = err as AxiosError;
    const data = axiosErr?.response?.data as Record<string, unknown> | undefined;
    const nestedData = data?.data as Record<string, unknown> | undefined;
    const originalMessage = nestedData?.originalMessage as string | undefined;
    return originalMessage || axiosErr.message || 'Unknown error';
  }
  return 'Unknown error';
};

interface User {
  id: string;
  username: string;
  email: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  initialLoading: boolean;
  error: string | null;
  
  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  initializeAuth: () => Promise<void>; // Nuevo método
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      loading: false,
      initialLoading: true,
      error: null,

      initializeAuth: async () => {
        const token = localStorage.getItem('token');
        
        if (!token) {
          set({ initialLoading: false });
          return;
        }
        
        try {
          // Configure the api with the token
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          set({ 
            token,
            isAuthenticated: true,
            initialLoading: false 
          });
        } catch {
          // If token is invalid, remove it
          localStorage.removeItem('token');
          delete api.defaults.headers.common['Authorization'];
          set({ 
            token: null,
            isAuthenticated: false,
            initialLoading: false 
          });
        }
      },

      login: async (email: string, password: string) => {
        set({ loading: true, error: null });
        try {
          const response = await authApi.login({ email, password });

          const token = response.data.token;
          const user = response.data.user;
          
          // Save token to localStorage
          localStorage.setItem('token', token);
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          set({
            user,
            token,
            isAuthenticated: true,
            loading: false,
            initialLoading: false,
          });
          toast.success(t("login.success"));
        } catch (err) {
          const message = getErrorMessage(err);
          set({ error: message, loading: false, initialLoading: false });
          toast.error(message);
        }
      },

      register: async (username: string, email: string, password: string) => {
        set({ loading: true, error: null });
        try {
          await authApi.register({ username, email, password });
          set({ loading: false });
          toast.success(t("register.success"));
        } catch (err) {
          const message = getErrorMessage(err);
          set({ error: message, loading: false });
          toast.error(message);
        }
      },

      logout: () => {
        localStorage.removeItem('token');
        delete api.defaults.headers.common['Authorization'];
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);