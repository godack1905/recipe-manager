import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useMealPlanStore } from '../../store/mealPlanStore';
import { useRecipeStore } from '../../store/recipeStore';
import RecipeSelector from '../recipes/RecipeSelector';
import { t } from 'i18next';

interface MealPlanModalProps {
  date: Date;
  onClose: () => void;
}

interface Meal {
  recipe: string;
  people: number;
  notes: string;
}

interface MealsData {
  breakfast: Meal[];
  snack: Meal[];
  lunch: Meal[];
  afternoonSnack: Meal[];
  dinner: Meal[];
}

const MealPlanModal: React.FC<MealPlanModalProps> = ({ date, onClose }) => {
  const { mealPlans, upsertMealPlan, deleteMealPlan, loading } = useMealPlanStore();
  const { recipes, fetchRecipes } = useRecipeStore();

  const mealTypes = [
    { key: 'breakfast', label: t("mealPlan.breakfast") },
    { key: 'snack', label: t("mealPlan.snack") },
    { key: 'lunch', label: t("mealPlan.lunch") },
    { key: 'afternoonSnack', label: t("mealPlan.afternoonSnack") },
    { key: 'dinner', label: t("mealPlan.dinner") },
  ];

  const [meals, setMeals] = useState<MealsData>({
    breakfast: [],
    snack: [],
    lunch: [],
    afternoonSnack: [],
    dinner: [],
  });
  const [isEditing, setIsEditing] = useState(false);
  const [originalMeals, setOriginalMeals] = useState<MealsData | null>(null);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  useEffect(() => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const existingPlan = mealPlans.find(plan => {
      const planDate = new Date(plan.date);
      return format(planDate, 'yyyy-MM-dd') === dateStr;
    });
    if (existingPlan) {
      const convertedMeals = {
        breakfast: existingPlan.meals.breakfast.map(meal => ({ ...meal, recipe: meal.recipe.id })),
        snack: existingPlan.meals.snack.map(meal => ({ ...meal, recipe: meal.recipe.id })),
        lunch: existingPlan.meals.lunch.map(meal => ({ ...meal, recipe: meal.recipe.id })),
        afternoonSnack: existingPlan.meals.afternoonSnack.map(meal => ({ ...meal, recipe: meal.recipe.id })),
        dinner: existingPlan.meals.dinner.map(meal => ({ ...meal, recipe: meal.recipe.id })),
      };
      // Defer state updates to avoid synchronous setState in effect
      setTimeout(() => {
        setMeals(convertedMeals);
        setOriginalMeals(convertedMeals);
        setIsEditing(false);
      }, 0);
    } else {
      const emptyMeals = {
        breakfast: [],
        snack: [],
        lunch: [],
        afternoonSnack: [],
        dinner: [],
      };
      setTimeout(() => {
        setMeals(emptyMeals);
        setOriginalMeals(null);
        setIsEditing(true);
      }, 0);
    }
  }, [date, mealPlans]);

  const handleAddMeal = (mealType: keyof MealsData) => {
    setMeals(prev => ({
      ...prev,
      [mealType]: [...prev[mealType], { recipe: '', people: 4, notes: '' }]
    }));
  };

  const handleRemoveMeal = (mealType: keyof MealsData, index: number) => {
    setMeals(prev => ({
      ...prev,
      [mealType]: prev[mealType].filter((_, i) => i !== index)
    }));
  };

  const handleMealChange = (mealType: keyof MealsData, index: number, field: keyof Meal, value: string | number) => {
    setMeals(prev => ({
      ...prev,
      [mealType]: prev[mealType].map((meal, i) =>
        i === index ? { ...meal, [field]: value } : meal
      )
    }));
  };

  const handleEdit = () => {
    setOriginalMeals(meals);
    setIsEditing(true);
  };

  const handleCancel = () => {
    if (originalMeals) {
      setMeals(originalMeals);
    }
    setIsEditing(false);
  };

  const handleDeletePlan = async () => {
    if (confirm(t("mealPlan.deleteConfirm"))) {
      await deleteMealPlan(format(date, 'yyyy-MM-dd'));
      onClose();
    }
  };

  const hasMeals = Object.values(meals).some(arr => arr.length > 0);

  const handleSave = async () => {
    try {
      await upsertMealPlan({
        date: format(date, 'yyyy-MM-dd'),
        meals: Object.fromEntries(
          Object.entries(meals).map(([key, value]) => [
            key,
            value.filter(meal => meal.recipe)
          ])
        )
      });
      setIsEditing(false);
      setOriginalMeals(meals);
    } catch (err) {
      console.error('Error saving meal plan:', err);
      // Inform the user
      // toast could be used here, but keep simple
    }
  };

  const hasChanges = () => {
    if (!originalMeals) return Object.values(meals).some(arr => arr.length > 0);
    return JSON.stringify(meals) !== JSON.stringify(originalMeals);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">
            {t("mealPlan.title", { 
              date: format(date, 'EEEE, d \'de\' MMMM \'de\' yyyy', { locale: es })
            })}
          </h2>
          <div className="flex items-center space-x-2">
            {hasMeals && !isEditing && (
              <>
                <button
                  onClick={handleEdit}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                  title={t("mealPlan.edit")}
                >
                  <Edit className="w-5 h-5" />
                </button>
                <button
                  onClick={handleDeletePlan}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  title={t("mealPlan.deletePlan")}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {isEditing ? (
            <div className="space-y-6">
              {mealTypes.map(({ key, label }) => (
                <div key={key} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">{label}</h3>
                    <button
                      onClick={() => handleAddMeal(key as keyof MealsData)}
                      className="flex items-center space-x-2 px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{t("mealPlan.add")}</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {meals[key as keyof MealsData].map((meal, index) => (
                      <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1 space-y-2">
                          <RecipeSelector
                            value={meal.recipe}
                            onChange={(recipeId) => handleMealChange(key as keyof MealsData, index, 'recipe', recipeId)}
                            recipes={recipes}
                          />
                          <div className="flex space-x-2">
                            <div className="flex-1">
                              <label className="block text-sm font-medium text-gray-700">
                                {t("mealPlan.people")}
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="20"
                                value={meal.people}
                                onChange={(e) => handleMealChange(key as keyof MealsData, index, 'people', parseInt(e.target.value) || 4)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-sm font-medium text-gray-700">
                                {t("mealPlan.notes")}
                              </label>
                              <input
                                type="text"
                                value={meal.notes}
                                onChange={(e) => handleMealChange(key as keyof MealsData, index, 'notes', e.target.value)}
                                placeholder={t("mealPlan.notesPlaceholder")}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveMeal(key as keyof MealsData, index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {meals[key as keyof MealsData].length === 0 && (
                      <p className="text-gray-500 text-center py-4">
                        {t("mealPlan.noMealsPlanned")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {hasMeals ? (
                mealTypes.map(({ key, label }) => {
                  const mealsForType = meals[key as keyof MealsData];
                  if (mealsForType.length === 0) return null;
                  
                  return (
                    <div key={key} className="border rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">{label}</h3>
                      <div className="space-y-3">
                        {mealsForType.map((meal, index) => {
                          const recipeObj = recipes.find(r => r.id === meal.recipe);
                          return <div key={index} className="p-3 bg-gray-50 rounded-lg">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h4 className="font-medium text-gray-900">
                                  {recipeObj?.title || t("mealPlan.recipeNotFound")}
                                </h4>
                                <p className="text-sm text-gray-600">
                                  {t("mealPlan.forPeople", { people: meal.people })}
                                </p>
                                {meal.notes && (
                                  <p className="text-sm text-gray-500 mt-1">
                                    {t("mealPlan.note")}: {meal.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>;
                        })}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500 mb-4">
                    {t("mealPlan.noMealsForDay")}
                  </p>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    {t("mealPlan.addMeals")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 p-6 border-t bg-gray-50">
          {isEditing ? (
            <>
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {t("mealPlan.cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={loading || !hasChanges()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? t("mealPlan.saving") : t("mealPlan.save")}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {t("mealPlan.close")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MealPlanModal;