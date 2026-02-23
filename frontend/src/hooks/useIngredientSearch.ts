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
        `${import.meta.env.VITE_API_URL}/api/ingredients?query=${encodeURIComponent(query)}`
      );

      if (response.data.success && response.data.data.ingredients) {
        const mappedSuggestions = response.data.data.ingredients.map((ing: unknown) => {
          const item = ing as Record<string, unknown>;
          const name = String(item.name ?? '');
          const id = String(item.id ?? name);
          const allowedMeasures = Array.isArray(item.allowedMeasures)
            ? (item.allowedMeasures as unknown[]).map(m => {
                const mm = m as Record<string, unknown>;
                return { name: String(mm.name ?? '') };
              })
            : [];

          return { id, name, allowedMeasures };
        });

        setSuggestions(mappedSuggestions);
      }
    } catch (error) {
      console.error('Error:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Update suggestions when searchTerm changes
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
