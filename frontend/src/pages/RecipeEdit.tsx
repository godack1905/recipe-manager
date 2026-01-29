import React, { useState, useEffect, useRef } from 'react';
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
  XCircle,
  Sparkles,
  Info
} from 'lucide-react';
import { useRecipeStore } from '../store/recipeStore';
import { useAuthStore } from '../store/authStore';
import { ingredientsApi, type IngredientData } from '../lib/ingredientsApi';
import { 
  MEAL_TYPE_TAGS, 
  suggestTagsFromTitle,
  TAG_CATEGORIES,
  isValidTag 
} from '../constants/mealTags';
import toast from 'react-hot-toast';

// Definir tipo para las medidas permitidas
interface MeasureOption {
  name: string;
  baseValue?: number;
  baseUnit?: string;
}

// Definir tipo extendido para ingrediente con medidas
interface IngredientWithMeasures extends Omit<IngredientData, 'allowedMeasures'> {
  allowedMeasures?: MeasureOption[];
}

// Definir tipo para ingrediente en el formulario
interface FormIngredient {
  ingredient: string;
  ingredientId?: string;
  ingredientData: IngredientWithMeasures | null;
  quantity: number | string;
  unit: string;
  displayQuantity: string;
  displayUnit: string;
  estimatedValue?: number;
}

const RecipeEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentRecipe, loading: recipeLoading, fetchRecipeById, updateRecipe } = useRecipeStore();
  const { user } = useAuthStore();
  
  const ingredientInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    servings: 2,
    prepTime: 15,
    difficulty: 'Fácil' as 'Fácil' | 'Media' | 'Difícil',
    isPublic: true,
    ingredients: [] as FormIngredient[],
    steps: [''],
    tags: [] as string[]
  });

  const [suggestedIngredients, setSuggestedIngredients] = useState<IngredientData[]>([]);
  const [searchIngredient, setSearchIngredient] = useState('');
  const [currentIngredient, setCurrentIngredient] = useState({
    ingredient: '',
    ingredientId: undefined as string | undefined,
    ingredientData: null as IngredientWithMeasures | null,
    quantity: '',
    unit: '',
    displayQuantity: '',
    displayUnit: ''
  });
  const [currentTag, setCurrentTag] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [loadingIngredients, setLoadingIngredients] = useState(false);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [filteredTags, setFilteredTags] = useState<string[]>(MEAL_TYPE_TAGS);

  // Cerrar sugerencias al hacer clic fuera
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

  // Cerrar sugerencias de tags al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tagInputRef.current && 
        !tagInputRef.current.contains(event.target as Node)
      ) {
        setShowTagSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtrar tags según lo que se escribe
  useEffect(() => {
    if (currentTag.trim()) {
      const filtered = MEAL_TYPE_TAGS.filter(tag => 
        tag.toLowerCase().includes(currentTag.toLowerCase())
      );
      setFilteredTags(filtered);
      setShowTagSuggestions(true);
    } else {
      setFilteredTags(MEAL_TYPE_TAGS.slice(0, 10)); // Mostrar primeros 10 por defecto
      setShowTagSuggestions(false);
    }
  }, [currentTag]);

  // Buscar ingredientes mientras se escribe
  useEffect(() => {
    const searchIngredients = async () => {
      if (searchIngredient.trim().length < 2) {
        setSuggestedIngredients([]);
        setShowSuggestions(false);
        return;
      }

      setIsSearching(true);
      try {
        const response = await ingredientsApi.search(searchIngredient, 'es');
        
        if (response.success && response.ingredients) {
          setSuggestedIngredients(response.ingredients);
          setShowSuggestions(true);
        }
      } catch (error) {
        console.error('Error buscando ingredientes:', error);
        setSuggestedIngredients([]);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(() => {
      searchIngredients();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchIngredient]);

  // Cargar la receta
  useEffect(() => {
    if (id) {
      loadRecipe();
    }
  }, [id]);

  const loadRecipe = async () => {
    if (!id) return;
    
    const recipe = await fetchRecipeById(id);
    if (!recipe) {
      toast.error('Receta no encontrada');
      navigate('/recipes');
      return;
    }
    
    // Verificar que el usuario es el propietario
    if (recipe.createdBy?._id !== user?.id) {
      toast.error('No tienes permiso para editar esta receta');
      navigate('/recipes');
      return;
    }
    
    setLoadingIngredients(true);
    try {
      // Cargar datos de ingredientes
      const ingredientsWithData = await Promise.all(
        (recipe.ingredients || []).map(async (ing: any) => {
          if (/^\d+$/.test(ing.ingredient)) {
            try {
              const response = await ingredientsApi.getById(ing.ingredient);
              if (response.success && response.ingredient) {
                const ingredientData = response.ingredient as IngredientWithMeasures;
                return {
                  ingredient: ingredientData.names.es,
                  ingredientId: ingredientData.id,
                  ingredientData: ingredientData,
                  quantity: ing.quantity || 0,
                  unit: ing.unit || '',
                  displayQuantity: ing.displayQuantity || ing.quantity?.toString() || '',
                  displayUnit: ing.displayUnit || ing.unit || '',
                  estimatedValue: ing.estimatedValue || ing.quantity || 0
                };
              }
            } catch (error) {
              console.error(`Error cargando ingrediente ${ing.ingredient}:`, error);
            }
          }
          
          return {
            ingredient: ing.ingredient,
            ingredientId: /^\d+$/.test(ing.ingredient) ? ing.ingredient : undefined,
            ingredientData: null,
            quantity: ing.quantity || 0,
            unit: ing.unit || '',
            displayQuantity: ing.displayQuantity || ing.quantity?.toString() || '',
            displayUnit: ing.displayUnit || ing.unit || '',
            estimatedValue: ing.estimatedValue || ing.quantity || 0
          };
        })
      );
      
      setFormData({
        title: recipe.title || '',
        description: recipe.description || '',
        servings: recipe.servings || 2,
        prepTime: recipe.prepTime || 15,
        difficulty: recipe.difficulty || 'Fácil',
        isPublic: recipe.isPublic !== undefined ? recipe.isPublic : true,
        ingredients: ingredientsWithData,
        steps: recipe.steps?.length ? recipe.steps : [''],
        tags: recipe.tags || [],
      });
    } catch (error) {
      console.error('Error cargando receta:', error);
      toast.error('Error al cargar la receta');
    } finally {
      setLoadingIngredients(false);
    }
  };

  // Cuando se selecciona un ingrediente
  const selectIngredient = (ingredient: IngredientData) => {
    const ingredientWithMeasures = ingredient as IngredientWithMeasures;
    const defaultUnit = ingredientWithMeasures.allowedMeasures?.[0]?.name || '';
    
    setCurrentIngredient(prev => ({
      ...prev,
      ingredient: ingredient.names.es,
      ingredientId: ingredient.id,
      ingredientData: ingredientWithMeasures,
      quantity: '',
      unit: defaultUnit,
      displayQuantity: '',
      displayUnit: ''
    }));
    setSearchIngredient(ingredient.names.es);
    setShowSuggestions(false);
    
    toast.success(`${ingredient.names.es} seleccionado`);
  };

  // Manejar cambios en el input de búsqueda
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchIngredient(value);
    
    if (!value.trim()) {
      setCurrentIngredient(prev => ({
        ...prev,
        ingredient: '',
        ingredientId: undefined,
        ingredientData: null,
        quantity: '',
        unit: '',
        displayQuantity: '',
        displayUnit: ''
      }));
    }
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

  // Obtener todas las opciones de medida
  const getAllMeasureOptions = () => {
    const options: Array<{value: string, label: string, baseValue?: number, baseUnit?: string}> = [];
    
    if (currentIngredient.ingredientData?.allowedMeasures) {
      currentIngredient.ingredientData.allowedMeasures.forEach(measure => {
        options.push({
          value: measure.name,
          label: `${measure.name}`,
          baseValue: measure.baseValue,
          baseUnit: measure.baseUnit
        });
      });
    }
    
    if (options.length === 0) {
      const genericOptions = [
        { value: 'unidades', label: 'unidades' },
        { value: 'gramos', label: 'gramos' },
        { value: 'kilos', label: 'kilos' },
        { value: 'mililitros', label: 'mililitros' },
        { value: 'litros', label: 'litros' },
        { value: 'cucharadas', label: 'cucharadas' },
        { value: 'cucharaditas', label: 'cucharaditas' },
        { value: 'tazas', label: 'tazas' },
        { value: 'pizca', label: 'pizca' },
        { value: 'al gusto', label: 'al gusto' }
      ];
      
      options.push(...genericOptions);
    }
    
    return options;
  };

  // Añadir o actualizar ingrediente
  const addIngredient = () => {
    if (!currentIngredient.ingredient.trim()) {
      toast.error('Por favor selecciona un ingrediente');
      return;
    }

    if (!currentIngredient.ingredientData) {
      toast.error('Ingrediente no válido');
      return;
    }
    
    if (!currentIngredient.quantity) {
      toast.error('Por favor indica la cantidad');
      return;
    }
    if (!currentIngredient.unit) {
      toast.error('Por favor selecciona una unidad');
      return;
    }
    
    if (currentIngredient.ingredientData.allowedMeasures && currentIngredient.ingredientData.allowedMeasures.length > 0) {
      const isValidUnit = currentIngredient.ingredientData.allowedMeasures.some(
        measure => measure.name === currentIngredient.unit
      );

      if (!isValidUnit) {
        const allowedUnits = currentIngredient.ingredientData.allowedMeasures.map(m => m.name).join(', ');
        toast.error(`Unidad no permitida. Permitidas: ${allowedUnits}`);
        return;
      }
    }

    const quantity = parseFloat(currentIngredient.quantity) || 0;

    const newIngredient: FormIngredient = {
      ingredient: currentIngredient.ingredient,
      ingredientId: currentIngredient.ingredientId,
      ingredientData: currentIngredient.ingredientData,
      quantity: quantity,
      unit: currentIngredient.unit,
      displayQuantity: currentIngredient.displayQuantity || currentIngredient.quantity.toString(),
      displayUnit: currentIngredient.unit,
      estimatedValue: quantity
    };

    if (editingIndex !== null) {
      const updatedIngredients = [...formData.ingredients];
      updatedIngredients[editingIndex] = newIngredient;
      
      setFormData(prev => ({
        ...prev,
        ingredients: updatedIngredients
      }));
      
      setEditingIndex(null);
      toast.success('Ingrediente actualizado');
    } else {
      setFormData(prev => ({
        ...prev,
        ingredients: [...prev.ingredients, newIngredient]
      }));
      
      toast.success('Ingrediente añadido');
    }

    resetIngredientForm();
  };

  // Editar ingrediente existente
  const editIngredient = (index: number) => {
    const ingredientToEdit = formData.ingredients[index];
    
    setCurrentIngredient({
      ingredient: ingredientToEdit.ingredient,
      ingredientId: ingredientToEdit.ingredientId,
      ingredientData: ingredientToEdit.ingredientData,
      quantity: ingredientToEdit.quantity.toString(),
      unit: ingredientToEdit.unit,
      displayQuantity: ingredientToEdit.displayQuantity,
      displayUnit: ingredientToEdit.displayUnit
    });
    
    setSearchIngredient(ingredientToEdit.ingredient);
    setEditingIndex(index);
    setShowSuggestions(false);
    
    toast('Edita el ingrediente y guarda los cambios', {
      icon: '✏️',
      duration: 3000
    });
  };

  // Cancelar edición
  const cancelEdit = () => {
    resetIngredientForm();
    setEditingIndex(null);
    toast.success('Edición cancelada');
  };

  // Resetear formulario de ingrediente
  const resetIngredientForm = () => {
    setCurrentIngredient({
      ingredient: '',
      ingredientId: undefined,
      ingredientData: null,
      quantity: '',
      unit: '',
      displayQuantity: '',
      displayUnit: ''
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
    toast.success('Ingrediente eliminado');
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
      toast.success('Paso eliminado');
    }
  };

  // Añadir etiqueta
  const addTag = (tag?: string) => {
    const tagToAdd = (tag || currentTag).trim();
    if (!tagToAdd) return;
    
    // Validar que sea una etiqueta permitida
    if (!MEAL_TYPE_TAGS.includes(tagToAdd as any)) {
      toast.error('Esta etiqueta no está permitida');
      return;
    }
    
    if (formData.tags.includes(tagToAdd)) {
      toast.error('Esta etiqueta ya está añadida');
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      tags: [...prev.tags, tagToAdd]
    }));
    
    if (!tag) {
      setCurrentTag('');
    }
    
    toast.success(`Etiqueta "${tagToAdd}" añadida`);
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
    toast.success('Etiqueta eliminada');
  };

  // Sugerir etiquetas inteligentes
  const suggestSmartTags = () => {
    const suggestions = suggestTagsFromTitle(formData.title);
    const newTags = [...new Set([...formData.tags, ...suggestions])];
    
    setFormData(prev => ({ ...prev, tags: newTags }));
    
    if (suggestions.length > 0) {
      toast.success(`Se añadieron ${suggestions.length} etiquetas sugeridas`);
    } else {
      toast.info('No se encontraron sugerencias para este título');
    }
  };

  const handleCancel = () => {
    if (window.confirm('¿Estás seguro de que quieres cancelar? Los cambios no guardados se perderán.')) {
      navigate(`/recipes/${id}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast.error('El título es obligatorio');
      return;
    }

    if (formData.ingredients.length === 0) {
      toast.error('Debes añadir al menos un ingrediente');
      return;
    }

    const validSteps = formData.steps.filter(step => step.trim() !== '');
    if (validSteps.length === 0) {
      toast.error('Debes añadir al menos un paso');
      return;
    }

    setIsSubmitting(true);

    try {
      const recipeToSend = {
        ...formData,
        servings: Number(formData.servings),
        prepTime: Number(formData.prepTime),
        steps: formData.steps.filter(step => step.trim() !== ''),
        ingredients: formData.ingredients.map(ing => {
          const baseIngredient = {
            ingredient: ing.ingredientId || ing.ingredient,
            quantity: Number(ing.quantity),
            unit: ing.unit,
            displayQuantity: ing.displayQuantity || ing.quantity.toString(),
            displayUnit: ing.displayUnit || ing.unit,
            estimatedValue: Number(ing.estimatedValue || ing.quantity)
          };
          
          return baseIngredient;
        })
      };

      if (!id) {
        toast.error('ID de receta no válido');
        return;
      }

      await updateRecipe(id, recipeToSend);
      
      toast.success('¡Receta actualizada exitosamente!');
      navigate(`/recipes/${id}`);

    } catch (error: any) {
      console.error('Error actualizando receta:', error);
      const errorMessage = error.response?.data?.message || 'Error al actualizar la receta';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const difficultyOptions = [
    { value: 'Fácil', label: 'Fácil' },
    { value: 'Media', label: 'Media' },
    { value: 'Difícil', label: 'Difícil' },
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
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Receta no encontrada</h2>
          <p className="text-gray-600 mb-6">La receta que intentas editar no existe.</p>
          <button
            onClick={() => navigate('/recipes')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Volver a recetas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-md p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Sección 1: Información Básica */}
          <div className="space-y-4">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-blue-100 rounded-lg mr-3">
                <ChefHat className="h-6 w-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Información Básica</h2>
            </div>

            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Título de la Receta *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ej: Tortilla de patatas clásica"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Descripción
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Describe brevemente tu receta..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label htmlFor="servings" className="block text-sm font-medium text-gray-700 mb-2">
                  Porciones *
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
                  Dificultad *
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
                  Hacer receta pública
                </label>
                <p className="text-sm text-gray-500">
                  Las recetas públicas son visibles para todos los usuarios
                </p>
              </div>
            </div>
          </div>

          {/* Sección 2: Ingredientes */}
          <div className="border-t pt-6">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-green-100 rounded-lg mr-3">
                <Package className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                Ingredientes
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({formData.ingredients.length} añadidos)
                </span>
                {editingIndex !== null && (
                  <span className="ml-3 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                    <Edit2 className="h-3 w-3 mr-1" />
                    Editando ingrediente {editingIndex + 1}
                  </span>
                )}
              </h2>
            </div>

            {/* Input para añadir/editar ingredientes */}
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Buscador de ingredientes */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ingrediente *
                  </label>
                  <div className="relative">
                    <div className="relative">
                      <input
                        ref={ingredientInputRef}
                        type="text"
                        value={searchIngredient}
                        onChange={handleSearchChange}
                        placeholder="Busca un ingrediente..."
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

                    {/* Sugerencias de ingredientes */}
                    {showSuggestions && suggestedIngredients.length > 0 && (
                      <div 
                        ref={suggestionsRef}
                        className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto"
                      >
                        {suggestedIngredients.map((ing, index) => (
                          <div
                            key={ing.id || index}
                            onClick={() => selectIngredient(ing)}
                            className="px-3 py-2 hover:bg-green-50 cursor-pointer border-b border-gray-100 last:border-b-0 flex items-center justify-between"
                          >
                            <div>
                              <div className="font-medium text-gray-900">{ing.names.es}</div>
                              <div className="text-xs text-gray-500">
                                {ing.names.en}
                              </div>
                            </div>
                            {currentIngredient.ingredient === ing.names.es && (
                              <Check className="h-4 w-4 text-green-600" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Campo de cantidad */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cantidad *
                  </label>
                  <input
                    type="number"
                    value={currentIngredient.quantity}
                    onChange={(e) => setCurrentIngredient(prev => ({
                      ...prev,
                      quantity: e.target.value
                    }))}
                    placeholder="Ej: 10"
                    step="0.1"
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>

                {/* Selector de unidad/medida */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Medida *
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
                      <option value="">Selecciona...</option>
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

              {/* Botones de acción */}
              <div className="mt-3 flex justify-between items-center">
                {editingIndex !== null && (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Cancelar Edición
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
                        Guardar Cambios
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-1" />
                        Añadir Ingrediente
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Lista de ingredientes añadidos */}
            <div className="mt-4">
              {formData.ingredients.length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg">
                  <Package className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600">Añade ingredientes a tu receta</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Busca ingredientes y añade cantidades
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
                            {ing.ingredient}
                          </div>
                          <div className="text-sm text-gray-600">
                            {ing.quantity} {ing.unit}
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

          {/* Sección 3: Pasos */}
          <div className="border-t pt-6">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-purple-100 rounded-lg mr-3">
                <ListOrdered className="h-6 w-6 text-purple-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                Pasos de Preparación
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({formData.steps.filter(s => s.trim() !== '').length} pasos)
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
                      <h3 className="font-medium text-gray-900">Paso {index + 1}</h3>
                    </div>
                    {formData.steps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeStep(index)}
                        className="text-sm text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                  <textarea
                    value={step}
                    onChange={(e) => updateStep(index, e.target.value)}
                    placeholder={`Describe el paso ${index + 1}...`}
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
                Añadir Otro Paso
              </button>
            </div>
          </div>

          {/* Sección 4: Etiquetas (SELECCIÓN ÚNICA) */}
          <div className="border-t pt-6">
            <div className="flex items-center mb-6">
              <div className="p-2 bg-orange-100 rounded-lg mr-3">
                <TagIcon className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Etiquetas
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({formData.tags.length} seleccionadas)
                  </span>
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Selecciona las etiquetas que mejor describan tu receta
                </p>
              </div>
            </div>

            {/* Ayuda */}
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-start space-x-3">
                <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-blue-900">Etiquetas predefinidas</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Solo puedes seleccionar etiquetas de la lista. Esto ayuda a la IA a generar mejores planes.
                  </p>
                </div>
              </div>
            </div>

            {/* Botón de sugerencias automáticas */}
            <div className="mb-6">
              <button
                type="button"
                onClick={() => {
                  const suggestions = suggestTagsFromTitle(formData.title);
                  const newTags = [...new Set([...formData.tags, ...suggestions])].filter(tag => 
                    isValidTag(tag) && !formData.tags.includes(tag)
                  );
                  
                  if (newTags.length > 0) {
                    setFormData(prev => ({ 
                      ...prev, 
                      tags: [...prev.tags, ...newTags] 
                    }));
                    toast.success(`Se añadieron ${newTags.length} etiquetas sugeridas`);
                  } else {
                    toast.info('No se encontraron sugerencias para este título');
                  }
                }}
                disabled={!formData.title || formData.title.length < 3}
                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Sugerir etiquetas automáticamente
              </button>
            </div>

            {/* Tags organizados por categorías */}
            <div className="space-y-8">
              {Object.entries(TAG_CATEGORIES).map(([category, tags]) => (
                <div key={category}>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
                    {category}
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
                              // Quitar tag
                              setFormData(prev => ({
                                ...prev,
                                tags: prev.tags.filter(t => t !== tag)
                              }));
                              toast.success(`Etiqueta "${tag}" eliminada`);
                            } else {
                              // Añadir tag
                              setFormData(prev => ({
                                ...prev,
                                tags: [...prev.tags, tag]
                              }));
                              toast.success(`Etiqueta "${tag}" añadida`);
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
                          <span className="font-medium">{tag}</span>
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

            {/* Etiquetas seleccionadas */}
            <div className="mt-8 pt-6 border-t">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Etiquetas seleccionadas</h3>
                <span className="text-sm text-gray-500">
                  {formData.tags.length} de {MEAL_TYPE_TAGS.length}
                </span>
              </div>
              
              {formData.tags.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {formData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 rounded-lg border border-purple-200"
                    >
                      <span className="font-medium">{tag}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            tags: prev.tags.filter(t => t !== tag)
                          }));
                          toast.success(`Etiqueta "${tag}" eliminada`);
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
                  <p className="text-gray-600 font-medium">No hay etiquetas seleccionadas</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Selecciona etiquetas de las categorías de arriba
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex justify-end space-x-4 pt-6">
            <button
              type="button"
              onClick={handleCancel}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center"
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecipeEdit;