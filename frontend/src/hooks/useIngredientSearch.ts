// hooks/useIngredientSearch.ts
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

interface IngredientSuggestion {
  id: string;
  name: string;
  allowedMeasures: Array<{ name: string }>;
}

export const useIngredientSearch = () => {
  const [suggestions, setSuggestions] = useState<IngredientSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const searchIngredients = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/ingredients?query=${encodeURIComponent(query)}&lang=es&limit=5`
      );

      if (response.data.success && response.data.ingredients) {
        const mappedSuggestions = response.data.ingredients.map((ing: any) => {
          // Siempre usar el ID como valor principal para enviar al backend
          const id = ing.id;
          // Mostrar nombre en la UI
          const name = ing.names?.es || ing.names?.en || id;
          const allowedMeasures = ing.allowedMeasures || [{ name: 'g' }];

          return { id, name, allowedMeasures };
        });

        setSuggestions(mappedSuggestions);
      }
    } catch (error) {
      console.error('Error buscando ingredientes:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Actualizamos search cada vez que el usuario escribe
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm) searchIngredients(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, searchIngredients]);

  const clearSuggestions = () => setSuggestions([]);

  return {
    suggestions,
    loading,
    searchTerm,
    setSearchTerm,
    clearSuggestions
  };
};
