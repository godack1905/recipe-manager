import React, { useState, useEffect } from 'react';
import { X, Sparkles, Check, Calendar, Users, ChefHat, Clock, Zap, Filter, RefreshCw, Heart, Brain, AlertCircle } from 'lucide-react';
import { addDays, format, isWeekend } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Recipe } from '../lib/recipesApi';
import { useRecipeStore } from '../store/recipeStore';
import { useAuthStore } from '../store/authStore';

interface AIGenerateModalProps {
  onClose: () => void;
  onGenerate: (mealPlans: MealPlan) => void;
}

type MealType = 'breakfast' | 'snack' | 'lunch' | 'afternoonSnack' | 'dinner';
type MealPlan = Record<string, DayMeals>;

interface DayMeals {
  breakfast: MealItem[];
  snack: MealItem[];
  lunch: MealItem[];
  afternoonSnack: MealItem[];
  dinner: MealItem[];
}

interface MealItem {
  recipe: string;
  people: number;
  notes: string;
  prepTime?: number;
  difficulty?: string;
  category?: string;
}

interface GenerationPreferences {
  avoidRepeats: boolean;
  balanceNutrition: boolean;
  considerPrepTime: boolean;
  weekendSpecial: boolean;
  includeQuickMeals: boolean;
}

const durationOptions = [
  { value: 1, label: 'Hoy', icon: '📅', description: 'Plan para hoy' },
  { value: 3, label: 'Próximos 3 días', icon: '📆', description: 'Corto plazo' },
  { value: 7, label: 'Próxima semana', icon: '🗓️', description: 'Plan semanal' },
  { value: 30, label: 'Próximo mes', icon: '📊', description: 'Plan mensual' },
];

const mealTypes: { key: MealType; label: string; icon: string; defaultChecked: boolean }[] = [
  { key: 'breakfast', label: 'Desayuno', icon: '☕', defaultChecked: true },
  { key: 'snack', label: 'Almuerzo', icon: '🥪', defaultChecked: false },
  { key: 'lunch', label: 'Comida', icon: '🍽️', defaultChecked: true },
  { key: 'afternoonSnack', label: 'Merienda', icon: '🍎', defaultChecked: false },
  { key: 'dinner', label: 'Cena', icon: '🌙', defaultChecked: true },
];

const AIGenerateModal: React.FC<AIGenerateModalProps> = ({ onClose, onGenerate }) => {
  const { recipes, isFavorite } = useRecipeStore();
  const { user, isAuthenticated } = useAuthStore();
  
  const [selectedMeals, setSelectedMeals] = useState<Record<MealType, boolean>>(
    Object.fromEntries(mealTypes.map(type => [type.key, type.defaultChecked])) as Record<MealType, boolean>
  );
  const [people, setPeople] = useState(4);
  const [duration, setDuration] = useState(7);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [useAI, setUseAI] = useState(true);
  const [preferences, setPreferences] = useState<GenerationPreferences>({
    avoidRepeats: true,
    balanceNutrition: true,
    considerPrepTime: true,
    weekendSpecial: true,
    includeQuickMeals: true,
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [maxPrepTime, setMaxPrepTime] = useState<number>(120);
  const [previewPlan, setPreviewPlan] = useState<MealPlan | null>(null);
  const [favoriteRecipes, setFavoriteRecipes] = useState<Recipe[]>([]);
  const [generationSource, setGenerationSource] = useState<'ai' | 'local' | null>(null);

  // Obtener solo las recetas favoritas
  useEffect(() => {
    if (isAuthenticated && recipes.length > 0) {
      const favorites = recipes.filter(recipe => isFavorite(recipe.id));
      setFavoriteRecipes(favorites);
      
      // Extraer categorías únicas de las recetas favoritas
      const categories = Array.from(
        new Set(favorites.map(r => r.category).filter(Boolean))
      ) as string[];
      setSelectedCategories(categories);
    }
  }, [recipes, isFavorite, isAuthenticated]);

  const handlePreferenceToggle = (key: keyof GenerationPreferences) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const generateWithAI = async () => {
    const selectedMealTypes = Object.entries(selectedMeals)
      .filter(([_, selected]) => selected)
      .map(([key]) => key as MealType);

    if (selectedMealTypes.length === 0) {
      setError('Selecciona al menos un tipo de comida');
      return;
    }

    if (favoriteRecipes.length === 0) {
      setError('No tienes recetas favoritas. Agrega algunas a tus favoritos primero.');
      return;
    }

    // Filtrar recetas por categorías seleccionadas
    const filteredRecipes = favoriteRecipes.filter(recipe => {
      if (selectedCategories.length > 0 && recipe.category) {
        return selectedCategories.includes(recipe.category);
      }
      return true;
    });

    if (filteredRecipes.length === 0) {
      setError('No hay recetas favoritas en las categorías seleccionadas.');
      return;
    }

    // Filtrar por tiempo máximo si la opción está activada
    let finalRecipes = filteredRecipes;
    if (preferences.considerPrepTime) {
      finalRecipes = filteredRecipes.filter(r => 
        !r.prepTime || r.prepTime <= maxPrepTime
      );
    }

    if (finalRecipes.length === 0) {
      setError('No hay recetas que cumplan con los criterios de tiempo de preparación.');
      return;
    }

    setAiLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/aiRoutes/generate-meal-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`
        },
        body: JSON.stringify({
          favoriteRecipes: finalRecipes,
          preferences: {
            people,
            duration,
            selectedMeals,
            ...preferences,
            maxPrepTime,
            selectedCategories
          },
          selectedMealTypes
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Error al generar plan con IA');
      }

      // Convertir el formato del backend a nuestro formato
      const convertedPlan = convertAIPlanToInternalFormat(data.data.mealPlan, finalRecipes);
      setPreviewPlan(convertedPlan);
      setGenerationSource(data.data.source || 'ai');
      
      if (data.warning) {
        setSuccess(`Plan generado (${data.warning})`);
      } else {
        setSuccess('Plan generado con IA');
      }
      
    } catch (error: any) {
      console.error('Error generando con IA:', error);
      setError(`Error con IA: ${error.message}. Usando algoritmo local...`);
      // Fallback a algoritmo local
      setTimeout(() => {
        generateLocalPlan();
      }, 500);
    } finally {
      setAiLoading(false);
    }
  };

  const generateLocalPlan = () => {
    const selectedMealTypes = Object.entries(selectedMeals)
      .filter(([_, selected]) => selected)
      .map(([key]) => key as MealType);

    if (selectedMealTypes.length === 0) {
      setError('Selecciona al menos un tipo de comida');
      return;
    }

    if (favoriteRecipes.length === 0) {
      setError('No tienes recetas favoritas. Agrega algunas a tus favoritos primero.');
      return;
    }

    // Filtrar recetas por categorías seleccionadas
    const filteredRecipes = favoriteRecipes.filter(recipe => {
      if (selectedCategories.length > 0 && recipe.category) {
        return selectedCategories.includes(recipe.category);
      }
      return true;
    });

    if (filteredRecipes.length === 0) {
      setError('No hay recetas favoritas en las categorías seleccionadas.');
      return;
    }

    // Filtrar por tiempo máximo si la opción está activada
    let finalRecipes = filteredRecipes;
    if (preferences.considerPrepTime) {
      finalRecipes = filteredRecipes.filter(r => 
        !r.prepTime || r.prepTime <= maxPrepTime
      );
    }

    if (finalRecipes.length === 0) {
      setError('No hay recetas que cumplan con los criterios de tiempo de preparación.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess('Plan generado localmente');

    // Algoritmo local simple
    const plan: MealPlan = {};
    const today = new Date();
    
    // Mezclar recetas
    const shuffledRecipes = [...finalRecipes].sort(() => Math.random() - 0.5);
    
    for (let day = 0; day < duration; day++) {
      const date = addDays(today, day);
      const dateStr = format(date, 'yyyy-MM-dd');
      const isWeekendDay = isWeekend(date);
      
      plan[dateStr] = {
        breakfast: [],
        snack: [],
        lunch: [],
        afternoonSnack: [],
        dinner: [],
      };
      
      let recipeIndex = day * selectedMealTypes.length;
      
      selectedMealTypes.forEach(mealType => {
        const recipe = shuffledRecipes[recipeIndex % shuffledRecipes.length];
        recipeIndex++;
        
        if (recipe) {
          plan[dateStr][mealType] = [{
            recipe: recipe.id,
            people,
            notes: generateLocalNote(mealType, isWeekendDay),
            prepTime: recipe.prepTime,
            difficulty: recipe.difficulty,
            category: recipe.category,
          }];
        }
      });
    }
    
    setPreviewPlan(plan);
    setGenerationSource('local');
    setLoading(false);
  };

  const generateLocalNote = (mealType: MealType, isWeekend: boolean): string => {
    const notes: Record<MealType, string[]> = {
      breakfast: [
        'Perfecto para empezar el día con energía',
        'Desayuno balanceado',
      ],
      snack: [
        'Merienda ligera',
        'Snack saludable',
      ],
      lunch: [
        isWeekend ? 'Comida especial de fin de semana' : 'Comida principal',
        'Almuerzo nutritivo',
      ],
      afternoonSnack: [
        'Refrigerio de tarde',
        'Merienda para mantener energía',
      ],
      dinner: [
        'Cena ligera',
        'Comida reconfortante',
      ],
    };
    
    const mealNotes = notes[mealType] || ['Comida planificada'];
    return mealNotes[Math.floor(Math.random() * mealNotes.length)];
  };

  const convertAIPlanToInternalFormat = (aiPlan: any, recipes: Recipe[]): MealPlan => {
    const plan: MealPlan = {};
    
    // Crear un mapa de recetas por ID para acceso rápido
    const recipeMap = new Map(recipes.map(r => [r.id, r]));
    
    Object.entries(aiPlan).forEach(([date, dayMeals]: [string, any]) => {
      plan[date] = {
        breakfast: [],
        snack: [],
        lunch: [],
        afternoonSnack: [],
        dinner: [],
      };
      
      Object.entries(dayMeals).forEach(([mealType, items]: [string, any]) => {
        if (Array.isArray(items)) {
          items.forEach((item: any) => {
            const recipe = recipeMap.get(item.recipeId);
            if (recipe) {
              plan[date][mealType as MealType]?.push({
                recipe: recipe.id,
                people,
                notes: item.notes || 'Comida planificada',
                prepTime: recipe.prepTime,
                difficulty: recipe.difficulty,
                category: recipe.category,
              });
            }
          });
        }
      });
    });
    
    return plan;
  };

  const handleGeneratePreview = () => {
    if (useAI) {
      generateWithAI();
    } else {
      generateLocalPlan();
    }
  };

  const handleConfirmGeneration = () => {
    if (!previewPlan) return;
    
    setLoading(true);
    setTimeout(() => {
      onGenerate(previewPlan);
      setLoading(false);
      onClose();
    }, 500);
  };

  const handleRandomize = () => {
    if (useAI) {
      generateWithAI();
    } else {
      generateLocalPlan();
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
          <div className="p-8 text-center">
            <div className="bg-red-100 rounded-full p-4 inline-flex mb-4">
              <Heart className="w-12 h-12 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Acceso Requerido
            </h2>
            <p className="text-gray-600 mb-6">
              Inicia sesión para generar planes de comidas personalizados.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Sparkles className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Generar Plan Inteligente</h2>
              <p className="text-sm text-gray-600">
                {useAI ? 'Usando IA para un plan optimizado' : 'Usando algoritmo local'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex h-[calc(90vh-200px)]">
          {/* Panel izquierdo: Configuración */}
          <div className="w-2/5 p-6 border-r overflow-y-auto">
            <div className="space-y-6">
              {/* Selector IA vs Local */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Brain className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="font-semibold text-gray-900">Usar Inteligencia Artificial</p>
                      <p className="text-xs text-gray-600">
                        {useAI ? 'IA generará un plan optimizado' : 'Algoritmo local más rápido'}
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useAI}
                      onChange={() => setUseAI(!useAI)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                  </label>
                </div>
              </div>

              {/* Indicador de recetas favoritas */}
              <div className="p-4 bg-gradient-to-r from-red-50 to-pink-50 rounded-xl border border-red-100">
                <div className="flex items-center space-x-3">
                  <Heart className="w-5 h-5 text-red-500 fill-red-500" />
                  <div>
                    <p className="font-semibold text-gray-900">
                      {favoriteRecipes.length} {favoriteRecipes.length === 1 ? 'receta favorita' : 'recetas favoritas'}
                    </p>
                    <p className="text-xs text-gray-600">
                      Todas se usarán para generar tu plan
                    </p>
                  </div>
                </div>
              </div>

              {/* Duración */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  Duración del plan
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {durationOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setDuration(option.value)}
                      className={`p-4 border-2 rounded-xl text-left transition-all duration-200 ${
                        duration === option.value
                          ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-sm scale-[1.02]'
                          : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-xl">{option.icon}</span>
                        <div>
                          <div className="font-medium">{option.label}</div>
                          <div className="text-xs text-gray-500">{option.description}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Personas y tiempo */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                    <Users className="w-4 h-4 mr-2" />
                    Personas
                  </label>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setPeople(Math.max(1, people - 1))}
                      className="p-2 rounded-lg border hover:bg-gray-50"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={people}
                      onChange={(e) => setPeople(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center font-medium"
                    />
                    <button
                      onClick={() => setPeople(Math.min(20, people + 1))}
                      className="p-2 rounded-lg border hover:bg-gray-50"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                    <Clock className="w-4 h-4 mr-2" />
                    Tiempo máximo (min)
                  </label>
                  <input
                    type="range"
                    min="15"
                    max="180"
                    step="15"
                    value={maxPrepTime}
                    onChange={(e) => setMaxPrepTime(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="text-xs text-gray-500 text-center mt-1">{maxPrepTime} minutos</div>
                </div>
              </div>

              {/* Tipos de comida */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
                  <ChefHat className="w-4 h-4 mr-2" />
                  Tipos de comida
                </label>
                <div className="space-y-2">
                  {mealTypes.map(({ key, label, icon }) => (
                    <button
                      key={key}
                      onClick={() => setSelectedMeals(prev => ({ ...prev, [key]: !prev[key] }))}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                        selectedMeals[key]
                          ? 'border-purple-500 bg-purple-50 text-purple-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">{icon}</span>
                        <span className="font-medium">{label}</span>
                      </div>
                      {selectedMeals[key] && (
                        <Check className="w-4 h-4 text-purple-600" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preferencias avanzadas */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
                  <Filter className="w-4 h-4 mr-2" />
                  Preferencias avanzadas
                </label>
                <div className="space-y-2">
                  {Object.entries(preferences).map(([key, value]) => (
                    <label key={key} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${value ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <span className="text-sm">
                          {key === 'avoidRepeats' && 'Evitar repeticiones'}
                          {key === 'balanceNutrition' && 'Balance nutricional'}
                          {key === 'considerPrepTime' && 'Considerar tiempo de preparación'}
                          {key === 'weekendSpecial' && 'Comidas especiales en fin de semana'}
                          {key === 'includeQuickMeals' && 'Incluir comidas rápidas'}
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={() => handlePreferenceToggle(key as keyof GenerationPreferences)}
                        className="sr-only"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Panel derecho: Vista previa */}
          <div className="w-3/5 p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Vista previa del plan</h3>
                <p className="text-sm text-gray-600">
                  {duration} días • {people} persona{people !== 1 ? 's' : ''}
                  {generationSource && (
                    <span className="ml-2 px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                      {generationSource === 'ai' ? 'Con IA' : 'Local'}
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={handleRandomize}
                disabled={loading || aiLoading || favoriteRecipes.length === 0}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading || aiLoading ? 'animate-spin' : ''}`} />
                <span>Re-generar</span>
              </button>
            </div>

            {/* Mensajes de estado */}
            {(error || success) && (
              <div className={`mb-4 p-3 rounded-lg ${error ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
                <div className="flex items-center">
                  {error && <AlertCircle className="w-4 h-4 mr-2" />}
                  {success && <Check className="w-4 h-4 mr-2" />}
                  <span className="text-sm">{error || success}</span>
                </div>
              </div>
            )}

            {favoriteRecipes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <Heart className="w-16 h-16 mb-4 text-red-400" />
                <p className="text-lg font-medium">No tienes recetas favoritas</p>
                <p className="text-sm text-center mt-2">
                  Agrega algunas recetas a tus favoritos para generar un plan personalizado.
                </p>
              </div>
            ) : previewPlan ? (
              <div className="space-y-4">
                <div className="max-h-[400px] overflow-y-auto pr-2">
                  {Object.entries(previewPlan).map(([date, meals]) => (
                    <div key={date} className="border rounded-xl p-4 hover:shadow-md transition-shadow mb-4">
                      <div className="flex justify-between items-center mb-3">
                        <div className="font-semibold text-gray-900">
                          {format(new Date(date), 'EEEE d', { locale: es })}
                        </div>
                        <div className="text-sm text-gray-500">
                          {isWeekend(new Date(date)) ? 'Fin de semana' : 'Día laboral'}
                        </div>
                      </div>
                      <div className="space-y-2">
                        {Object.entries(meals)
                          .filter(([mealType]) => selectedMeals[mealType as MealType])
                          .map(([mealType, mealItems]) => (
                            mealItems.length > 0 && (
                              <div key={mealType} className="flex items-center space-x-3 text-sm">
                                <div className="w-24 text-gray-500 capitalize">
                                  {mealType === 'afternoonSnack' ? 'Merienda' : 
                                   mealType === 'snack' ? 'Almuerzo' : mealType}
                                </div>
                                <div className="flex-1">
                                  {mealItems.map((item, idx) => {
                                    const recipe = favoriteRecipes.find(r => r.id === item.recipe);
                                    return (
                                      <div key={idx} className="flex items-center justify-between mb-1">
                                        <div className="flex items-center space-x-2">
                                          <span className="font-medium">{recipe?.title || 'Receta'}</span>
                                          <Heart className="w-3 h-3 text-red-500 fill-red-500" />
                                        </div>
                                        <span className="text-xs text-gray-500">
                                          {recipe?.prepTime}min • {recipe?.difficulty}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <Sparkles className="w-12 h-12 mb-4" />
                <p className="text-lg font-medium">Configura tu plan</p>
                <p className="text-sm">Haz clic en "Generar Vista Previa" para ver tu plan</p>
              </div>
            )}

            {/* Estadísticas */}
            {previewPlan && (
              <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                <h4 className="font-semibold text-gray-900 mb-3">Estadísticas del plan</h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 bg-white rounded-lg">
                    <div className="text-xl font-bold text-purple-600">
                      {Object.values(previewPlan).reduce((acc, day) => 
                        acc + Object.values(day).flat().length, 0
                      )}
                    </div>
                    <div className="text-xs text-gray-600">Comidas totales</div>
                  </div>
                  <div className="p-3 bg-white rounded-lg">
                    <div className="text-xl font-bold text-green-600">
                      {new Set(
                        Object.values(previewPlan).flatMap(day => 
                          Object.values(day).flatMap(meals => 
                            meals.map(m => m.recipe)
                          )
                        )
                      ).size}
                    </div>
                    <div className="text-xs text-gray-600">Recetas únicas</div>
                  </div>
                  <div className="p-3 bg-white rounded-lg">
                    <div className="text-xl font-bold text-blue-600">
                      {Math.round(
                        Object.values(previewPlan).flatMap(day => 
                          Object.values(day).flatMap(meals => 
                            meals.map(m => {
                              const recipe = favoriteRecipes.find(r => r.id === m.recipe);
                              return recipe?.prepTime || 0;
                            })
                          )
                        ).reduce((a, b) => a + b, 0) / Object.values(previewPlan).length
                      )}
                    </div>
                    <div className="text-xs text-gray-600">Promedio min/día</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pie del modal */}
        <div className="flex justify-between items-center p-6 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            <span className="flex items-center">
              <Zap className="w-4 h-4 mr-1" />
              {favoriteRecipes.length} recetas favoritas disponibles
              <Heart className="w-4 h-4 ml-2 text-red-500 fill-red-500" />
            </span>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleGeneratePreview}
              disabled={loading || aiLoading || favoriteRecipes.length === 0}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-2"
            >
              {aiLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Generando con IA...</span>
                </>
              ) : loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Generando...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generar Vista Previa</span>
                </>
              )}
            </button>
            {previewPlan && (
              <button
                onClick={handleConfirmGeneration}
                disabled={loading}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors flex items-center space-x-2"
              >
                <Check className="w-4 h-4" />
                <span>Confirmar Plan</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIGenerateModal;