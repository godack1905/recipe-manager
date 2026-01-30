import { create } from 'zustand';
import type { MealPlan, CreateMealPlanData } from '../lib/mealPlanApi';
import { mealPlanApi } from '../lib/mealPlanApi';
import toast from 'react-hot-toast';

interface MealPlanState {
  mealPlans: MealPlan[];
  currentMealPlan: MealPlan | null;
  loading: boolean;
  error: string | null;

  // Actions
  fetchMealPlans: (start?: string, end?: string) => Promise<void>;
  upsertMealPlan: (data: CreateMealPlanData) => Promise<MealPlan>;
  deleteMealPlan: (date: string) => Promise<boolean>;
  clearCurrentMealPlan: () => void;
  clearError: () => void;
}

export const useMealPlanStore = create<MealPlanState>((set, get) => ({
  mealPlans: [],
  currentMealPlan: null,
  loading: false,
  error: null,

  fetchMealPlans: async (start?: string, end?: string) => {
    set({ loading: true, error: null });
    try {
      const response = await mealPlanApi.getAll({ start, end });
      set({ 
        mealPlans: response.data.mealPlans || response.data || response,
        loading: false 
      });
    } catch (error: any) {
      const message = error.response?.data?.data?.originalMessage || 'Error al cargar planes de comida';
      set({ error: message, loading: false });
      toast.error(message);
    }
  },

  upsertMealPlan: async (data: CreateMealPlanData) => {
    set({ loading: true, error: null });
    try {
      const response = await mealPlanApi.upsert(data);
      const newMealPlan = response.data.data.mealPlan || response.data;
      set((state) => ({
        mealPlans: state.mealPlans.map(plan =>
          plan.date === newMealPlan.date ? newMealPlan : plan
        ).concat(state.mealPlans.some(plan => plan.date === newMealPlan.date) ? [] : [newMealPlan]),
        loading: false
      }));
      toast.success('Plan de comida guardado exitosamente');
      return newMealPlan;
    } catch (error: any) {
      const message = error.response?.data?.data?.originalMessage || 'Error al guardar plan de comida';
      set({ error: message, loading: false });
      toast.error(message);
      throw error;
    }
  },

  deleteMealPlan: async (date: string) => {
    set({ loading: true, error: null });
    try {
      await mealPlanApi.delete(date);
      set((state) => ({
        mealPlans: state.mealPlans.filter(plan => plan.date !== date),
        loading: false
      }));
      toast.success('Plan de comida eliminado exitosamente');
      return true;
    } catch (error: any) {
      const message = error.response?.data?.data?.originalMessage || 'Error al eliminar plan de comida';
      set({ error: message, loading: false });
      toast.error(message);
      return false;
    }
  },

  clearCurrentMealPlan: () => set({ currentMealPlan: null }),
  clearError: () => set({ error: null }),
}));