import api from './api';

export interface Meal {
  recipe: {
    id: string;
    title: string;
    imageUrl?: string;
    servings: number;
    prepTime?: number;
    difficulty: 'Fácil' | 'Media' | 'Difícil';
  };
  people: number;
  notes: string;
}

export interface MealPlan {
  id: string;
  user: string;
  date: string;
  meals: {
    breakfast: Meal[];
    snack: Meal[];
    lunch: Meal[];
    afternoonSnack: Meal[];
    dinner: Meal[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateMealPlanData {
  date: string;
  meals: {
    breakfast?: { recipe: string; people?: number; notes?: string }[];
    snack?: { recipe: string; people?: number; notes?: string }[];
    lunch?: { recipe: string; people?: number; notes?: string }[];
    afternoonSnack?: { recipe: string; people?: number; notes?: string }[];
    dinner?: { recipe: string; people?: number; notes?: string }[];
  };
}

export const mealPlanApi = {
  // Obtener planes de comida
  getAll: async (params?: { start?: string; end?: string }) => {
    const response = await api.get('/api/meal-plans', { params });
    return response.data;
  },

  // Crear o actualizar plan de comida
  upsert: async (data: CreateMealPlanData) => {
    const response = await api.post('/api/meal-plans', data);
    return response.data;
  },

  // Eliminar plan de comida por fecha
  delete: async (date: string) => {
    const response = await api.delete(`/api/meal-plans/${date}`);
    return response.data;
  },
};