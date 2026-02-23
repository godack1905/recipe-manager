import { useState, useEffect, useMemo, useCallback } from 'react';
import { ingredientsApi } from '../lib/ingredientsApi';
import type { IngredientData } from '../lib/ingredientsApi';

import { t } from "i18next";

// Global cache
const ingredientCache = new Map<string, IngredientData>();

export const useIngredients = () => {
  const [ingredients, setIngredients] = useState<IngredientData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load all ingredients
  const fetchAllIngredients = useCallback(async () => {
    try {
      setLoading(true);
      const response = await ingredientsApi.getAll();
      
      const ingredientsList = response.data.ingredients || response.data || response;
      
      // Full cache
      ingredientsList.forEach((ing: IngredientData) => {
        ingredientCache.set(ing.id, ing);
      });
      
      setIngredients(ingredientsList);
      setError(null);
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Get an ingredient by name
  const fetchIngredientByName = useCallback(async (name: string): Promise<IngredientData | null> => {
    // First verify if is in cache
    if (ingredientCache.has(name)) {
      return ingredientCache.get(name)!;
    }
    
    try {
      const response = await ingredientsApi.getByName(name);
      
      if (response.success && response.data.ingredient) {
        const ingredient = response.data.ingredient;
        // Load in cache
        ingredientCache.set(name, ingredient);
        return ingredient;
      }
      
      return null;
    } catch {
      return null;
    }
  }, []);

  // Get multiples ingredients by names
  const fetchIngredientsByIds = useCallback(async (names: string[]): Promise<IngredientData[]> => {
    const uniqueNames = [...new Set(names)];
    const results: IngredientData[] = [];
    
    for (const name of uniqueNames) {
      const ingredient = await fetchIngredientByName(name);
      if (ingredient) {
        results.push(ingredient);
      }
    }
    
    return results;
  }, [fetchIngredientByName]);

  const getIngredientCategory = useCallback((id: string): string => {
    const ingredient = ingredientCache.get(id);
    return ingredient ? t(`ingredient.category.${ingredient.categoria}`) : '';
  }, []);

  const getIngredientByName = useCallback((id: string): IngredientData | undefined => {
    return ingredientCache.get(id);
  }, []);

  const searchIngredients = useCallback((query: string): IngredientData[] => {
    if (!query.trim()) {
      return ingredients;
    }
    
    const lowerQuery = query.toLowerCase();
    return ingredients.filter((ingredient) => 
      ingredient.name.toLowerCase().includes(lowerQuery)
    );
  }, [ingredients]);

  // Initialize loading all ingredients
  useEffect(() => {
    fetchAllIngredients();
  }, [fetchAllIngredients]);

  // Return the memo
  return useMemo(() => ({
    ingredients,
    loading,
    error,
    getIngredientCategory,
    getIngredientByName,
    searchIngredients,
    fetchIngredientByName,
    fetchIngredientsByIds,
    refetch: fetchAllIngredients,
  }), [
    ingredients, 
    loading, 
    error, 
    getIngredientCategory, 
    getIngredientByName, 
    searchIngredients,
    fetchIngredientByName, 
    fetchIngredientsByIds, 
    fetchAllIngredients
  ]);
};