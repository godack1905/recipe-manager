import { create } from 'zustand';
import type { MealPlan, CreateMealPlanData } from '../lib/mealPlanApi';
import { mealPlanApi } from '../lib/mealPlanApi';
import type { AxiosError } from 'axios';
import toast from 'react-hot-toast';
import { t } from 'i18next';

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

export const useMealPlanStore = create<MealPlanState>((set) => ({
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
    } catch (err) {
      const message = getErrorMessage(err);
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
      toast.success(t("mealPlan.createSuccess"));
      return newMealPlan;
    } catch (err) {
      const message = getErrorMessage(err);
      set({ error: message, loading: false });
      toast.error(message);
      throw err;
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
      toast.success(t("mealPlan.deleteSucces"));
      return true;
    } catch (err) {
      const message = getErrorMessage(err);
      set({ error: message, loading: false });
      toast.error(message);
      return false;
    }
  },

  clearCurrentMealPlan: () => set({ currentMealPlan: null }),
  clearError: () => set({ error: null }),
}));