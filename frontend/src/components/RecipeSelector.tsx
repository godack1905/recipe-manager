import React, { useState, useEffect } from 'react';
import { Search, Check } from 'lucide-react';
import type { Recipe } from '../lib/recipesApi';

interface RecipeSelectorProps {
  value: string;
  onChange: (recipeId: string) => void;
  recipes: Recipe[];
}

const RecipeSelector: React.FC<RecipeSelectorProps> = ({ value, onChange, recipes }) => {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const selectedRecipe = recipes.find(r => r.id === value);

  const filteredRecipes = recipes.filter(recipe =>
    recipe.title.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 10); // Limitar a 10 resultados

  const handleSelect = (recipe: Recipe) => {
    onChange(recipe.id);
    setSearch(recipe.title);
    setIsOpen(false);
  };

  useEffect(() => {
    if (selectedRecipe && !search) {
      setSearch(selectedRecipe.title);
    }
  }, [selectedRecipe, search]);

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">Receta</label>
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Buscar receta..."
          className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
      </div>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {filteredRecipes.length > 0 ? (
            filteredRecipes.map(recipe => (
              <button
                key={recipe.id}
                onClick={() => handleSelect(recipe)}
                className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
              >
                <div>
                  <div className="font-medium">{recipe.title}</div>
                  <div className="text-sm text-gray-500">
                    {recipe.servings} porciones • {recipe.prepTime}min • {recipe.difficulty}
                  </div>
                </div>
                {value === recipe.id && <Check className="w-4 h-4 text-blue-500" />}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-gray-500">No se encontraron recetas</div>
          )}
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default RecipeSelector;