import React, { useState, useEffect } from 'react';
import { Package, AlertCircle, Loader } from 'lucide-react';
import { useIngredients } from '../../hooks/useIngredients';

import { t } from "i18next";

interface IngredientDisplayProps {
  ingredient: {
    ingredient: string;
    quantity: number;
    unit: string;
  };
  index: number;
  showCategory?: boolean;
}

const IngredientDisplay: React.FC<IngredientDisplayProps> = ({
  ingredient,
  index,
  showCategory = true,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { fetchIngredientByName, getIngredientCategory } = useIngredients();

  useEffect(() => {
    const loadIngredient = async () => {
      try {
        setLoading(true);
        const id = ingredient.ingredient;
        const info = await fetchIngredientByName(id);
        if (!info) setError(t("ingredient.notFound"));
        
      } catch (err) {
        console.error(`Error loading ingredient ${ingredient.ingredient}:`, err);
        setError(t("ingredient.loadError"));
      } finally {
        setLoading(false);
      }
    };

    loadIngredient();
  }, [ingredient.ingredient, fetchIngredientByName]);

  const displayName = t(`ingredient.names.${ingredient.ingredient}`);
  const category = getIngredientCategory(ingredient.ingredient);

  return (
    <div className="flex items-start p-3 rounded-lg hover:bg-gray-50 transition-colors">
      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center mr-3 mt-0.5">
        {loading ? (
          <Loader className="h-4 w-4 text-blue-600 animate-spin" />
        ) : (
          <span className="text-blue-600 text-sm font-bold">{index + 1}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center">
          <Package className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline flex-wrap">
              <span className="font-medium text-gray-900 truncate mr-2">
                {displayName}
              </span>
              <span className="text-gray-600 whitespace-nowrap">
                {ingredient.quantity} {ingredient.unit}
              </span>
            </div>
            
            {/* Additional Info */}
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {loading ? (
                <span className="text-xs text-gray-400">{t("loading")}</span>
              ) : error ? (
                <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded flex items-center">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {error}
                </span>
              ) : (
                <>
                  {showCategory && category && category !== '' && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {category}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IngredientDisplay;