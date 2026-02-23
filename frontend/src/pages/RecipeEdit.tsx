import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Plus, 
  X, 
  Save, 
  ChefHat, 
  Tag as TagIcon,
  ListOrdered,
  Package,
  Scale,
  Search,
  Check,
  Edit2,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useRecipeStore } from '../store/recipeStore';
import { useAuthStore } from '../store/authStore';
import { ingredientsApi, type IngredientData } from '../lib/ingredientsApi';
import { 
  TAG_CATEGORIES
} from '../constants/mealTags';
import toast from 'react-hot-toast';
import { useTranslation } from "react-i18next";
import enTranslations from '../../public/locales/en/translation.json';
import esTranslations from '../../public/locales/es/translation.json';

// Define type for measure option
interface MeasureOption {
  name: string;
  baseValue?: number;
  baseUnit?: string;
}

// Define interface for ingredient with measures
interface IngredientWithMeasures extends Omit<IngredientData, 'allowedMeasures'> {
  allowedMeasures?: MeasureOption[];
}

// Extend IngredientData to include displayName
interface IngredientWithDisplay extends IngredientData {
  displayName?: string;
}

// Define interface for form ingredient
interface FormIngredient {
  ingredient: string;
  ingredientId?: string;
  ingredientData: IngredientWithMeasures | null;
  quantity: number | string;
  unit: string;
  displayQuantity: string;
}

// Normalize API ingredient shape to `IngredientWithMeasures`
const normalizeIngredient = (ing: IngredientData): IngredientWithMeasures => ({
  ...ing,
  allowedMeasures: (ing.allowedMeasures || []).map((m: unknown) => {
    if (typeof m === 'string') return { name: m } as MeasureOption;
    return (m as MeasureOption);
  })
});

// Helper to extract error message from AxiosError
const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) {
    const axiosErr = err as import('axios').AxiosError;
    const data = axiosErr?.response?.data as Record<string, unknown> | undefined;
    const originalMessage = data?.message as string | undefined;
    return originalMessage || axiosErr.message || 'Unknown error';
  }
  return 'Unknown error';
};

const RecipeEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentRecipe, loading: recipeLoading, fetchRecipeById, updateRecipe } = useRecipeStore();
  const { user } = useAuthStore();
  
  const ingredientInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const { t, i18n } = useTranslation();
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    servings: 2,
    prepTime: 15,
    difficulty: 'easy' as 'easy' | 'medium' | 'hard',
    isPublic: true,
    ingredients: [] as FormIngredient[],
    steps: [''],
    tags: [] as string[]
  });

  const [suggestedIngredients, setSuggestedIngredients] = useState<IngredientWithDisplay[]>([]);
  const [searchIngredient, setSearchIngredient] = useState('');
  const [currentIngredient, setCurrentIngredient] = useState({
    ingredient: '',
    ingredientData: null as IngredientWithMeasures | null,
    quantity: '',
    unit: '',
    displayQuantity: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [loadingIngredients, setLoadingIngredients] = useState(false);


  // Get current language (es or en)
  const currentLang = i18n.language?.split('-')[0] || 'en';

  // Map visibleWord -> id
  const generateMap = (namesObj: Record<string, string>) => {
    const map: Record<string, string> = {};
    if (!namesObj) return map;
    
    Object.entries(namesObj).forEach(([key, visibleName]) => {
      if (visibleName && typeof visibleName === 'string') {
        map[visibleName.toLowerCase()] = key;
      }
    });
    return map;
  };

  const mapEnVisibleToKey = generateMap(enTranslations?.ingredient?.names || {});
  const mapEsVisibleToKey = generateMap(esTranslations?.ingredient?.names || {});

  const mapByLang: Record<string, Record<string, string>> = {
    en: mapEnVisibleToKey,
    es: mapEsVisibleToKey,
  };

  // Get display name from key
  const getDisplayNameFromKey = (key: string): string => {
    const translations = currentLang === 'es' ? esTranslations : enTranslations;
    return translations?.ingredient?.names?.[key] || key;
  };

  // Close ingrediente suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target as Node) &&
        ingredientInputRef.current && 
        !ingredientInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Tag features removed - no-op

  // Load recipe
  const loadRecipe = useCallback(async () => {
    if (!id) return;
    
    const recipe = await fetchRecipeById(id);
    if (!recipe) {
      toast.error(t("recipe.notFound"));
      navigate('/recipes');
      return;
    }
    
    if (recipe.createdBy?._id !== user?.id) {
      toast.error(t("recipe.notAuthorizedEdit"));
      navigate('/recipes');
      return;
    }
    
    setLoadingIngredients(true);
    try {
      const ingredientsWithData = await Promise.all(
        (recipe.ingredients || []).map(async (ing: unknown) => {
          const rawIng = ing as Record<string, unknown>;
          const ingName = String(rawIng.ingredient ?? '');
          if (/^\d+$/.test(ingName)) {
            try {
              const response = await ingredientsApi.getByName(ingName);
              if (response.success && response.ingredient) {
                const rawIngredient = response.ingredient as IngredientData;
                const ingredientData = normalizeIngredient(rawIngredient);
                return {
                  ingredient: ingredientData.name,
                  ingredientData: ingredientData,
                  quantity: Number(rawIng.quantity ?? 0) || 0,
                  unit: String(rawIng.unit ?? ''),
                  displayQuantity: String(rawIng.displayQuantity ?? rawIng.quantity ?? '')
                };
              }
            } catch (err) {
              console.error('Error fetching ingredient by name:', err);
            }
          }

          return {
            ingredient: ingName,
            ingredientData: null,
            quantity: Number((rawIng.quantity as unknown) ?? 0) || 0,
            unit: String(rawIng.unit ?? ''),
            displayQuantity: String(rawIng.displayQuantity ?? rawIng.quantity ?? '')
          };
        })
      );
      
      setFormData({
        title: recipe.title || '',
        description: recipe.description || '',
        servings: recipe.servings || 2,
        prepTime: recipe.prepTime || 15,
        difficulty: recipe.difficulty || 'easy',
        isPublic: recipe.isPublic !== undefined ? recipe.isPublic : true,
        ingredients: ingredientsWithData,
        steps: recipe.steps?.length ? recipe.steps : [''],
        tags: recipe.tags || [],
      });
    } catch (err) {
      console.error('Error loading recipe:', err);
      toast.error(t("recipe.loadError"));
    } finally {
      setLoadingIngredients(false);
    }
  }, [id, fetchRecipeById, user?.id, navigate, t]);

  useEffect(() => {
    if (id) {
      loadRecipe();
    }
  }, [id, loadRecipe]);

  // Handle search input change - CORREGIDO
  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchIngredient(value);
    
    if (!value.trim() || value.length < 2) {
      setSuggestedIngredients([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
    
    try {
      // Get the display name to key map for current language
      const displayNameToKey = mapByLang[currentLang] || {};
      
      // Check if we have translations
      if (Object.keys(displayNameToKey).length === 0) {
        setSuggestedIngredients([]);
        setShowSuggestions(false);
        return;
      }
      
      const searchLower = value.toLowerCase();
      
      // Find all keys whose display names contain the search text
      const possibleKeys = Object.entries(displayNameToKey)
        .filter(([displayName]) => {
          return displayName && displayName.toLowerCase().includes(searchLower);
        })
        .map(([, key]) => key);

      if (possibleKeys.length > 0) {
        // Limit to 15 keys to avoid overloading
        const limitedKeys = possibleKeys.slice(0, 15);
        
        const response = await axios.post(
          `${import.meta.env.VITE_API_URL}/api/ingredients/search-by-keys`,
          { keys: limitedKeys }
        );
        
        if (response.data.success && response.data.data?.ingredients) {
          // Map ingredients with display names
          const mappedIngredients = response.data.data.ingredients.map((ing: IngredientData) => {
            const displayName = getDisplayNameFromKey(ing.name);
            
            return {
              ...ing,
              displayName,
            };
          });
          
          // Sort results: first those that start with search term
          mappedIngredients.sort((a, b) => {
            const aStartsWith = a.displayName?.toLowerCase().startsWith(searchLower) || false;
            const bStartsWith = b.displayName?.toLowerCase().startsWith(searchLower) || false;
            
            if (aStartsWith && !bStartsWith) return -1;
            if (!aStartsWith && bStartsWith) return 1;
            return (a.displayName || '').localeCompare(b.displayName || '');
          });
          
          setSuggestedIngredients(mappedIngredients);
          setShowSuggestions(true);
        } else {
          setSuggestedIngredients([]);
          setShowSuggestions(false);
        }
      } else {
        setSuggestedIngredients([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Error searching ingredients:', error);
      setSuggestedIngredients([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Select ingredient from suggestions - CORREGIDO
  const selectIngredient = (ingredient: IngredientWithDisplay) => {
    const ingredientWithMeasures = normalizeIngredient(ingredient as IngredientData);
    const defaultUnit = ingredientWithMeasures.allowedMeasures?.[0]?.name || '';
    
    setCurrentIngredient(prev => ({
      ...prev,
      ingredient: ingredient.name,
      ingredientId: ingredient.id,
      ingredientData: ingredientWithMeasures,
      quantity: '',
      unit: defaultUnit,
      displayQuantity: '',
    }));
    
    // Use display name for search input
    setSearchIngredient(ingredient.displayName || ingredient.name);
    setShowSuggestions(false);
    
    toast.success(`${ingredient.displayName || ingredient.name} ${t("recipe.selected")}`);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
    } else if (['servings', 'prepTime'].includes(name)) {
      setFormData(prev => ({
        ...prev,
        [name]: value === '' ? '' : Number(value)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Obtain all measure options for the current ingredient
  const getAllMeasureOptions = () => {
    const options: Array<{value: string, label: string, baseValue?: number, baseUnit?: string}> = [];
    
    if (currentIngredient.ingredientData?.allowedMeasures) {
      currentIngredient.ingredientData.allowedMeasures.forEach(measure => {
        options.push({
          value: measure.name,
          label: t(`ingredient.units.${measure.name}`, { defaultValue: measure.name }),
          baseValue: measure.baseValue,
          baseUnit: measure.baseUnit
        });
      });
    }

    return options;
  };

  // Add or update ingredients
  const addIngredient = () => {
    if (!currentIngredient.ingredient.trim()) {
      toast.error(t("recipe.selectIngredient"));
      return;
    }

    if (!currentIngredient.ingredientData) {
      toast.error(t("recipe.invalidIngredient"));
      return;
    }
    
    if (!currentIngredient.quantity) {
      toast.error(t("recipe.missingQuantity"));
      return;
    }
    if (!currentIngredient.unit) {
      toast.error(t("recipe.missingUnit"));
      return;
    }
    
    if (currentIngredient.ingredientData.allowedMeasures && currentIngredient.ingredientData.allowedMeasures.length > 0) {
      const isValidUnit = currentIngredient.ingredientData.allowedMeasures.some(
        measure => measure.name === currentIngredient.unit
      );

      if (!isValidUnit) {
        const allowedUnits = currentIngredient.ingredientData.allowedMeasures.map(m => m.name).join(', ');
        toast.error(`${t("recipe.invalidUnit")} ${allowedUnits}`);
        return;
      }
    }

    const exists = formData.ingredients.some(
      ing => ing.ingredient.toLowerCase() === currentIngredient.ingredient.toLowerCase()
    );
    if (exists && editingIndex === null) {
      toast.error(t("recipe.ingredientAlreadyAdded"));
      return;
    }

    const quantity = parseFloat(currentIngredient.quantity) || 0;

    const newIngredient: FormIngredient = {
      ingredient: currentIngredient.ingredient,
      ingredientData: currentIngredient.ingredientData,
      quantity: quantity,
      unit: currentIngredient.unit,
      displayQuantity: currentIngredient.displayQuantity || currentIngredient.quantity.toString()
    };

    if (editingIndex !== null) {
      const updatedIngredients = [...formData.ingredients];
      updatedIngredients[editingIndex] = newIngredient;
      
      setFormData(prev => ({
        ...prev,
        ingredients: updatedIngredients
      }));
      
      setEditingIndex(null);
      toast.success(t("recipe.ingredientUpdated"));
    } else {
      setFormData(prev => ({
        ...prev,
        ingredients: [...prev.ingredients, newIngredient]
      }));
      
      toast.success(t("recipe.ingredientAdded"));
    }

    resetIngredientForm();
  };

  // Edit existing ingredient
  const editIngredient = (index: number) => {
    const ingredientToEdit = formData.ingredients[index];
    
    setCurrentIngredient({
      ingredient: ingredientToEdit.ingredient,
      ingredientData: ingredientToEdit.ingredientData,
      quantity: ingredientToEdit.quantity.toString(),
      unit: ingredientToEdit.unit,
      displayQuantity: ingredientToEdit.displayQuantity
    });
    
    setSearchIngredient(getDisplayNameFromKey(ingredientToEdit.ingredient));
    setEditingIndex(index);
    setShowSuggestions(false);
    
    toast(t("recipe.editAndSaveIngredient"), {
      icon: '✏️',
      duration: 3000
    });
  };

  // Cancel edit
  const cancelEdit = () => {
    resetIngredientForm();
    setEditingIndex(null);
    toast.success(t("recipe.cancelledEdit"));
  };

  // Reset ingredient form
  const resetIngredientForm = () => {
    setCurrentIngredient({
      ingredient: '',
      ingredientData: null,
      quantity: '',
      unit: '',
      displayQuantity: ''
    });
    setSearchIngredient('');
    setShowSuggestions(false);
  };

  const removeIngredient = (index: number) => {
    if (editingIndex === index) {
      cancelEdit();
    }
    
    setFormData(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }));
    toast.success(t("recipe.ingredientRemoved"));
  };

  const addStep = () => {
    setFormData(prev => ({
      ...prev,
      steps: [...prev.steps, '']
    }));
  };

  const updateStep = (index: number, value: string) => {
    const newSteps = [...formData.steps];
    newSteps[index] = value;
    setFormData(prev => ({
      ...prev,
      steps: newSteps
    }));
  };

  const removeStep = (index: number) => {
    if (formData.steps.length > 1) {
      const newSteps = formData.steps.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        steps: newSteps
      }));
      toast.success(t("recipe.stepRemoved"));
    }
  };

  const handleCancel = () => {
    if (window.confirm(t("recipe.cancelEditConfirm"))) {
      navigate(`/recipes`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast.error(t("recipe.missingTitle"));
      return;
    }

    if (formData.ingredients.length === 0) {
      toast.error(t("recipe.missingIngredients"));
      return;
    }

    const validSteps = formData.steps.filter(step => step.trim() !== '');
    if (validSteps.length === 0) {
      toast.error(t("recipe.missingSteps"));
      return;
    }

    setIsSubmitting(true);

    try {
      const recipeToSend = {
        ...formData,
        servings: Number(formData.servings),
        prepTime: Number(formData.prepTime),
        difficulty: formData.difficulty,
        steps: formData.steps.filter(step => step.trim() !== ''),
        ingredients: formData.ingredients.map(ing => ({
          ingredient: ing.ingredientId || ing.ingredient,
          quantity: Number(ing.quantity),
          unit: ing.unit,
          displayQuantity: ing.displayQuantity || ing.quantity.toString()
        }))
      };

      if (!id) {
        toast.error(t("recipe.invalidRecipeId"));
        return;
      }

      await updateRecipe(id, recipeToSend);
      
      toast.success(t("recipe.updateSuccess"));
      navigate(`/recipes`);

    } catch (err) {
      console.error('Error updating recipe:', err);
      const errorMessage = getErrorMessage(err);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const difficultyOptions = [
    { value: 'easy', label: t("easy") },
    { value: 'medium', label: t("medium") },
    { value: 'hard', label: t("hard") },
  ];

  if (recipeLoading || loadingIngredients) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!currentRecipe) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{t("recipe.notFound.title")}</h2>
          <p className="text-gray-600 mb-6">{t("recipe.notFound.description")}</p>
          <button
            onClick={() => navigate('/recipes')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t("recipe.backToRecipes")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-md p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic info section */}
          <div className="space-y-4">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-blue-100 rounded-lg mr-3">
                <ChefHat className="h-6 w-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">{t("recipe.basicInfo")}</h2>
            </div>

            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                {t("recipe.titleOfRecipe")} *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={t("recipe.titlePlaceholder")}
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                {t("recipe.description")}
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={t("recipe.descriptionPlaceholder")}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label htmlFor="servings" className="block text-sm font-medium text-gray-700 mb-2">
                  {t("recipe.servings")} *
                </label>
                <input
                  type="number"
                  id="servings"
                  name="servings"
                  value={formData.servings}
                  onChange={handleInputChange}
                  required
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="prepTime" className="block text-sm font-medium text-gray-700 mb-2">
                  Prep. (min) *
                </label>
                <input
                  type="number"
                  id="prepTime"
                  name="prepTime"
                  value={formData.prepTime}
                  onChange={handleInputChange}
                  required
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="difficulty" className="block text-sm font-medium text-gray-700 mb-2">
                  {t("recipe.difficulty")} *
                </label>
                <select
                  id="difficulty"
                  name="difficulty"
                  value={formData.difficulty}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {difficultyOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                id="isPublic"
                name="isPublic"
                checked={formData.isPublic}
                onChange={handleInputChange}
                className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <div>
                <label htmlFor="isPublic" className="text-sm font-medium text-gray-700 cursor-pointer">
                  {t("recipe.makePublic")}
                </label>
                <p className="text-sm text-gray-500">
                  {t("recipe.makePublicDescription")}
                </p>
              </div>
            </div>
          </div>

          {/* Ingredients section */}
          <div className="border-t pt-6">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-green-100 rounded-lg mr-3">
                <Package className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                {t("recipe.ingredients")}
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({formData.ingredients.length} {t("recipe.ingredientAdded")})
                </span>
                {editingIndex !== null && (
                  <span className="ml-3 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                    <Edit2 className="h-3 w-3 mr-1" />
                    {t("recipe.editingIngredient")} {editingIndex + 1}
                  </span>
                )}
              </h2>
            </div>

            {/* Input to add more ingredients */}
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Ingredient searcher */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("recipe.ingredient")} *
                  </label>
                  <div className="relative">
                    <div className="relative">
                      <input
                        ref={ingredientInputRef}
                        type="text"
                        value={searchIngredient}
                        onChange={handleSearchChange}
                        placeholder={t("recipe.searchIngredientPlaceholder")}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        onFocus={() => setShowSuggestions(true)}
                      />
                      <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                        <Search className="h-4 w-4 text-gray-400" />
                      </div>
                      {isSearching && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                        </div>
                      )}
                    </div>

                    {/* Ingredient suggestions - CORREGIDO */}
                    {showSuggestions && suggestedIngredients.length > 0 && (
                      <div 
                        ref={suggestionsRef}
                        className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto"
                      >
                        {suggestedIngredients.map((ing) => {
                          const displayName = ing.displayName || ing.name;
                          const searchTerm = searchIngredient;
                          
                          // Safe split with error handling
                          let parts = [displayName];
                          try {
                            if (searchTerm) {
                              const regex = new RegExp(`(${searchTerm})`, 'gi');
                              parts = displayName.split(regex);
                            }
                          } catch {
                            parts = [displayName];
                          }
                          
                          return (
                            <div
                              key={ing.name}
                              onClick={() => selectIngredient(ing)}
                              className="px-3 py-2 hover:bg-green-50 cursor-pointer border-b border-gray-100 last:border-b-0 flex items-center justify-between"
                            >
                              <div className="font-medium text-gray-900">
                                {parts.map((part, i) => {
                                  if (searchTerm && part.toLowerCase() === searchTerm.toLowerCase()) {
                                    return (
                                      <span key={i} className="bg-yellow-200 font-bold">
                                        {part}
                                      </span>
                                    );
                                  }
                                  return <span key={i}>{part}</span>;
                                })}
                              </div>
                              {currentIngredient.ingredient === ing.name && (
                                <Check className="h-4 w-4 text-green-600" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Quantity field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("recipe.quantity")} *
                  </label>
                  <input
                    type="number"
                    value={currentIngredient.quantity}
                    onChange={(e) => setCurrentIngredient(prev => ({
                      ...prev,
                      quantity: e.target.value
                    }))}
                    placeholder={t("recipe.quantityPlaceholder")}
                    step="0.1"
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>

                {/* Measure selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("recipe.measure")} *
                  </label>
                  <div className="relative">
                    <select
                      value={currentIngredient.unit}
                      onChange={(e) => setCurrentIngredient(prev => ({
                        ...prev,
                        unit: e.target.value
                      }))}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 appearance-none"
                      disabled={!currentIngredient.ingredientData}
                    >
                      <option value="">{t("recipe.measureSelect")}</option>
                      {getAllMeasureOptions().map((option, index) => (
                        <option key={index} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                      <Scale className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-3 flex justify-between items-center">
                {editingIndex !== null && (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    {t("recipe.cancelEdit")}
                  </button>
                )}
                
                <div className="ml-auto flex space-x-2">
                  <button
                    type="button"
                    onClick={addIngredient}
                    disabled={
                      !currentIngredient.ingredientData ||
                      !currentIngredient.unit ||
                      !currentIngredient.quantity
                    }
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {editingIndex !== null ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        {t("recipe.saveChanges")}
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-1" />
                        {t("recipe.addIngredient")}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Added ingredients list - CORREGIDO */}
            <div className="mt-4">
              {formData.ingredients.length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg">
                  <Package className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600">{t("recipe.addIngredientsToYourRecipe")}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {t("recipe.searchForIngredientsAndAddQuantity")}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {formData.ingredients.map((ing, index) => (
                    <div 
                      key={index} 
                      className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                        editingIndex === index 
                          ? 'bg-yellow-50 border-2 border-yellow-300' 
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center ${
                          editingIndex === index ? 'bg-yellow-100' : 'bg-green-100'
                        }`}>
                          <span className={`font-bold text-xs ${
                            editingIndex === index ? 'text-yellow-600' : 'text-green-600'
                          }`}>
                            {index + 1}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {getDisplayNameFromKey(ing.ingredient)}
                          </div>
                          <div className="text-sm text-gray-600">
                            {ing.quantity} {t(`ingredient.units.${ing.unit}`, { defaultValue: ing.unit })}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => editIngredient(index)}
                          className={`p-2 rounded ${
                            editingIndex === index 
                              ? 'bg-yellow-100 text-yellow-600' 
                              : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'
                          }`}
                          title={editingIndex === index ? "Editando..." : "Editar ingrediente"}
                          disabled={editingIndex === index}
                        >
                          {editingIndex === index ? (
                            <Edit2 className="h-4 w-4 animate-pulse" />
                          ) : (
                            <Edit2 className="h-4 w-4" />
                          )}
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => removeIngredient(index)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                          title="Eliminar ingrediente"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Steps section */}
          <div className="border-t pt-6">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-purple-100 rounded-lg mr-3">
                <ListOrdered className="h-6 w-6 text-purple-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                {t("recipe.preparationSteps")}
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({formData.steps.filter(s => s.trim() !== '').length} {t("recipe.steps")})
                </span>
              </h2>
            </div>

            <div className="space-y-4">
              {formData.steps.map((step, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center">
                      <div className="h-6 w-6 rounded-full bg-purple-100 flex items-center justify-center mr-2">
                        <span className="text-purple-600 font-bold text-sm">{index + 1}</span>
                      </div>
                      <h3 className="font-medium text-gray-900">{t("recipe.step")} {index + 1}</h3>
                    </div>
                    {formData.steps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeStep(index)}
                        className="text-sm text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded"
                      >
                        {t("recipe.delete")}
                      </button>
                    )}
                  </div>
                  <textarea
                    value={step}
                    onChange={(e) => updateStep(index, e.target.value)}
                    placeholder={`${t("recipe.describeStep")} ${index + 1}...`}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              ))}
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={addStep}
                className="inline-flex items-center px-4 py-2 border border-dashed border-purple-300 text-purple-600 font-medium rounded-lg hover:bg-purple-50"
              >
                <Plus className="h-4 w-4 mr-1" />
                {t("recipe.addStep")}
              </button>
            </div>
          </div>

          {/* Tags section */}
          <div className="border-t pt-6">
            <div className="flex items-center mb-6">
              <div className="p-2 bg-orange-100 rounded-lg mr-3">
                <TagIcon className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {t("recipe.tags")}
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({formData.tags.length} {t("recipe.tagsSelected")})
                  </span>
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {t("recipe.selectTags")}
                </p>
              </div>
            </div>

            {/* Tags by category */}
            <div className="space-y-8">
              {Object.entries(TAG_CATEGORIES).map(([category, tags]) => (
                <div key={category}>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
                    {t(`tagCategories.${category}`)}
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {tags.map(tag => {
                      const isSelected = formData.tags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setFormData(prev => ({
                                ...prev,
                                tags: prev.tags.filter(t => t !== tag)
                              }));
                              toast.success(`${t("recipe.tag")} "${t(`tags.${tag}`)}" ${t("recipe.deleted")}`);
                            } else {
                              setFormData(prev => ({
                                ...prev,
                                tags: [...prev.tags, tag]
                              }));
                              toast.success(`${t("recipe.tag")} "${t(`tags.${tag}`)}" ${t("recipe.added")}`);
                            }
                          }}
                          className={`
                            inline-flex items-center px-4 py-2 rounded-lg border-2 transition-all duration-200
                            ${isSelected 
                              ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-sm' 
                              : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                            }
                          `}
                        >
                          <span className="font-medium">{t(`tags.${tag}`)}</span>
                          {isSelected && (
                            <Check className="h-4 w-4 ml-2 text-purple-600" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Selected Tags */}
            <div className="mt-8 pt-6 border-t">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{t("recipe.selectedTagsTitle")}</h3>
              </div>
              
              {formData.tags.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {formData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 rounded-lg border border-purple-200"
                    >
                      <span className="font-medium">{t(`tags.${tag}`)}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            tags: prev.tags.filter(t => t !== tag)
                          }));
                          toast.success(`${t("recipe.tag")} "${t(`tags.${tag}`)}" ${t("recipe.deleted")}`);
                        }}
                        className="ml-2 text-purple-600 hover:text-purple-900 p-1 hover:bg-purple-200 rounded"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                  <TagIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">{t("recipe.noSelectedTags")}</p>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end space-x-4 pt-6">
            <button
              type="button"
              onClick={handleCancel}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center"
            >
              <X className="h-4 w-4 mr-2" />
              {t("recipe.cancel")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSubmitting ? t("recipe.saving") : t("recipe.saveChanges")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecipeEdit;