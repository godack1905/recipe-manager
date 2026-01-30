import { useState, useEffect, useMemo, useCallback } from 'react';
import { ingredientsApi } from '../lib/ingredientsApi';
import type { IngredientData } from '../lib/ingredientsApi';

// Cache global fuera del hook
const ingredientCache = new Map<string, IngredientData>();

export const useIngredients = () => {
  const [ingredients, setIngredients] = useState<IngredientData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar todos los ingredientes una vez
  const fetchAllIngredients = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔄 Fetching ALL ingredients from API...');
      const response = await ingredientsApi.getAll('es');
      
      const ingredientsList = response.data.ingredients || response.data || response;
      console.log(`✅ Loaded ${ingredientsList.length} ingredients to cache`);
      
      // Llenar el cache
      ingredientsList.forEach((ing: IngredientData) => {
        ingredientCache.set(ing.id, ing);
      });
      
      setIngredients(ingredientsList);
      setError(null);
    } catch (err: any) {
      console.error('❌ Error loading all ingredients:', err);
      setError(err.message || 'Error al cargar ingredientes');
    } finally {
      setLoading(false);
    }
  }, []);

  // Obtener un ingrediente específico por ID
  const fetchIngredientById = useCallback(async (id: string): Promise<IngredientData | null> => {
    // Primero verificar si está en cache
    if (ingredientCache.has(id)) {
      return ingredientCache.get(id)!;
    }
    
    try {
      const response = await ingredientsApi.getById(id);
      
      if (response.success && response.data.ingredient) {
        const ingredient = response.data.ingredient;
        // Guardar en cache
        ingredientCache.set(id, ingredient);
        return ingredient;
      }
      
      return null;
    } catch (err) {
      console.error(`❌ Error fetching ingredient ${id}:`, err);
      return null;
    }
  }, []);

  // Obtener múltiples ingredientes por sus IDs (con memoización)
  const fetchIngredientsByIds = useCallback(async (ids: string[]): Promise<IngredientData[]> => {
    const uniqueIds = [...new Set(ids)]; // Eliminar duplicados
    const results: IngredientData[] = [];
    
    for (const id of uniqueIds) {
      const ingredient = await fetchIngredientById(id);
      if (ingredient) {
        results.push(ingredient);
      }
    }
    
    return results;
  }, [fetchIngredientById]);

  // Funciones sincrónicas que usan el cache (memoizadas)
  const getIngredientName = useCallback((id: string): string => {
    const ingredient = ingredientCache.get(id);
    return ingredient ? ingredient.names.es : id;
  }, []);

  const getIngredientCategory = useCallback((id: string): string => {
    const ingredient = ingredientCache.get(id);
    return ingredient ? ingredient.categoria : 'Sin categoría';
  }, []);

  const getIngredientById = useCallback((id: string): IngredientData | undefined => {
    return ingredientCache.get(id);
  }, []);

  // Inicializar cargando todos los ingredientes
  useEffect(() => {
    fetchAllIngredients();
  }, [fetchAllIngredients]);

  // Memoizar el valor retornado
  return useMemo(() => ({
    ingredients,
    loading,
    error,
    getIngredientName,
    getIngredientCategory,
    getIngredientById,
    fetchIngredientById,
    fetchIngredientsByIds,
    refetch: fetchAllIngredients,
  }), [
    ingredients, 
    loading, 
    error, 
    getIngredientName, 
    getIngredientCategory, 
    getIngredientById, 
    fetchIngredientById, 
    fetchIngredientsByIds, 
    fetchAllIngredients
  ]);
};