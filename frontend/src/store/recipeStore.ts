import { create } from 'zustand';
import type { Recipe, CreateRecipeData } from '../lib/recipesApi';
import { recipesApi } from '../lib/recipesApi';
import { useAuthStore } from './authStore';
import toast from 'react-hot-toast';

interface RecipeState {
  recipes: Recipe[];
  favorites: string[];
  currentRecipe: Recipe | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchRecipes: (search?: string) => Promise<void>;
  fetchRecipeById: (id: string) => Promise<Recipe | null>; // Cambiado para devolver Recipe
  fetchFavorites: () => Promise<void>;
  createRecipe: (data: CreateRecipeData) => Promise<Recipe>;
  updateRecipe: (id: string, data: Partial<CreateRecipeData>) => Promise<Recipe>;
  deleteRecipe: (id: string) => Promise<boolean>; // Ahora devuelve boolean
  toggleFavorite: (id: string) => Promise<void>;
  isFavorite: (id: string) => boolean;
  clearCurrentRecipe: () => void;
  clearError: () => void;
}

export const useRecipeStore = create<RecipeState>((set, get) => ({
  recipes: [],
  favorites: [],
  currentRecipe: null,
  loading: false,
  error: null,

  fetchRecipes: async (search?: string) => {
    set({ loading: true, error: null });
    try {
      const response = await recipesApi.getAll({ search });
      set({ 
        recipes: response.data.recipes,
        loading: false 
      });
    } catch (error: any) {
      const message = error.response?.data?.data?.originalMessage || 'Error al cargar recetas';
      set({ error: message, loading: false });
      toast.error(message);
    }
  },

  fetchRecipeById: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const response  = await recipesApi.getById(id);
      set({ currentRecipe: response.data, loading: false });
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.data?.originalMessage || 'Error al cargar receta';
      set({ error: message, loading: false });
      toast.error(message);
      return null; // Devuelve null en caso de error
    }
  },

  fetchFavorites: async () => {
    set({ loading: true });
    try {
      const response = await recipesApi.getFavorites();
      const favoritesData = response.data.favorites || [];
      const favoriteIds = Array.isArray(favoritesData) 
        ? favoritesData.map((fav: any) => fav.id || fav)
        : [];
      set({ 
        favorites: favoriteIds,
        loading: false 
      });
    } catch (error: any) {
      const message = error.response?.data?.data?.originalMessage || 'Error al cargar favoritos';
      set({ error: message, loading: false });
      toast.error(message);
    }
  },

  createRecipe: async (data: CreateRecipeData) => {
    set({ loading: true, error: null });
    try {
      const recipe = await recipesApi.create(data);
      set((state) => ({ 
        recipes: [recipe, ...state.recipes],
        loading: false 
      }));
      toast.success('Receta creada exitosamente');
      return recipe;
    } catch (error: any) {
      const message = error.response?.data?.data?.originalMessage || 'Error al crear receta';
      set({ error: message, loading: false });
      toast.error(message);
      throw error;
    }
  },

  updateRecipe: async (id: string, data: Partial<CreateRecipeData>) => {
    set({ loading: true, error: null });
    try {
      const recipe = await recipesApi.update(id, data);
      set((state) => ({
        recipes: state.recipes.map(r => r.id === id ? recipe : r),
        currentRecipe: recipe,
        loading: false
      }));
      toast.success('Receta actualizada exitosamente');
      return recipe;
    } catch (error: any) {
      const message = error.response?.data?.data?.originalMessage || 'Error al actualizar receta';
      set({ error: message, loading: false });
      toast.error(message);
      throw error;
    }
  },

  deleteRecipe: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await recipesApi.delete(id);
      set((state) => ({
        recipes: state.recipes.filter(r => r.id !== id),
        currentRecipe: state.currentRecipe?.id === id ? null : state.currentRecipe,
        loading: false
      }));
      toast.success('Receta eliminada exitosamente');
      return true; // Devuelve true si fue exitoso
    } catch (error: any) {
      const message = error.response?.data?.data?.originalMessage || 'Error al eliminar receta';
      set({ error: message, loading: false });
      toast.error(message);
      return false; // Devuelve false si hubo error
    }
  },

  toggleFavorite: async (id: string) => {
    try {
      const response = await recipesApi.toggleFavorite(id);
      const newFavorites = response.data.favorites || get().favorites;
      const favoriteIds = Array.isArray(newFavorites) 
        ? newFavorites.map((fav: any) => fav.id || fav)
        : [];
      
      set({ favorites: favoriteIds });
      toast.success(response.message || 'Favoritos actualizados');
    } catch (error: any) {
      const message = error.response?.data?.data?.originalMessage || 'Error al actualizar favoritos';
      toast.error(message);
    }
  },

  isFavorite: (id: string) => {
    return get().favorites.includes(id);
  },

  clearCurrentRecipe: () => set({ currentRecipe: null }),
  clearError: () => set({ error: null }),
}));