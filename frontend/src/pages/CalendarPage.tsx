import React, { useState, useEffect } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isToday, 
  addMonths, 
  subMonths,
  startOfWeek,
  endOfWeek,
  addDays
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useMealPlanStore } from '../store/mealPlanStore';
import { useRecipeStore } from '../store/recipeStore';
import MealPlanModal from '../components/MealPlanModal';
import AIGenerateModal from '../components/AIGenerateModal';

const CalendarPage = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [showAIGenerate, setShowAIGenerate] = useState(false);
  const { mealPlans, fetchMealPlans, upsertMealPlan } = useMealPlanStore();
  const { recipes, fetchRecipes } = useRecipeStore();

  useEffect(() => {
    // Load meal plans for current month +/- 1 month to have some buffer
    const start = format(subMonths(currentMonth, 1), 'yyyy-MM-dd');
    const end = format(addMonths(currentMonth, 1), 'yyyy-MM-dd');
    fetchMealPlans(start, end);
    fetchRecipes(); // Load recipes for AI generation
  }, [currentMonth, fetchMealPlans, fetchRecipes]);

  // Obtener las semanas del mes
  const getCalendarWeeks = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    
    // Empezar desde el lunes de la semana que contiene el primer día del mes
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    // Terminar en el domingo de la semana que contiene el último día del mes
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    
    // Obtener todos los días del rango calendario
    const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    
    // Dividir en semanas (arrays de 7 días)
    const weeks = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      weeks.push(calendarDays.slice(i, i + 7));
    }
    
    return weeks;
  };

  const getMealPlanForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return mealPlans.find(plan => {
      const planDate = new Date(plan.date);
      return format(planDate, 'yyyy-MM-dd') === dateStr;
    });
  };

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleDayClick = (date) => {
    setSelectedDate(date);
  };

  const handleAIGenerate = async (mealPlans) => {
    console.log('handleAIGenerate called with:', mealPlans);
    try {
      // Guardar cada plan de comida
      const promises = Object.entries(mealPlans).map(([date, meals]) => {
        console.log('Saving meal plan for date:', date, meals);
        return upsertMealPlan({ date, meals });
      });
      
      await Promise.all(promises);
      
      // Recargar los meal plans
      const start = format(subMonths(currentMonth, 1), 'yyyy-MM-dd');
      const end = format(addMonths(currentMonth, 1), 'yyyy-MM-dd');
      fetchMealPlans(start, end);
      
      setShowAIGenerate(false);
      alert(`¡Plan generado exitosamente para ${Object.keys(mealPlans).length} día(s)!`);
    } catch (error) {
      console.error('Error saving meal plans:', error);
      alert('Error al guardar el plan. Inténtalo de nuevo.');
    }
  };

  const calendarWeeks = getCalendarWeeks();

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Planificación de Comidas</h1>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => {
              console.log('Plan IA button clicked');
              setShowAIGenerate(true);
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
          >
            <Sparkles className="w-5 h-5" />
            <span>Plan IA</span>
          </button>
          <div className="flex items-center space-x-4">
            <button
              onClick={handlePrevMonth}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-semibold text-gray-700">
              {format(currentMonth, 'MMMM yyyy', { locale: es })}
            </h2>
            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-8">
        <div className="grid grid-cols-7 gap-2 mb-4">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
            <div key={day} className="p-4 text-center text-sm font-medium text-gray-500">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-rows-6 gap-2">
          {calendarWeeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-2">
              {week.map(day => {
                const mealPlan = getMealPlanForDate(day);
                const hasMeals = mealPlan && Object.values(mealPlan.meals).some(meals => meals.length > 0);
                const isCurrentMonth = isSameMonth(day, currentMonth);

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => handleDayClick(day)}
                    className={`
                      p-4 text-left border rounded-lg hover:bg-gray-50 transition-colors min-h-[120px]
                      ${isToday(day) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}
                      ${!isCurrentMonth ? 'text-gray-400 bg-gray-50' : 'text-gray-900'}
                    `}
                  >
                    <div className={`text-sm font-medium mb-2 ${isToday(day) ? 'text-blue-600' : ''}`}>
                      {format(day, 'd')}
                    </div>
                    {isCurrentMonth && hasMeals && (
                      <div className="space-y-1">
                        {Object.entries(mealPlan.meals).map(([mealType, meals]) =>
                          meals.length > 0 && (
                            <div key={mealType} className="text-xs text-gray-600 truncate">
                              {mealType === 'breakfast' && 'D'}
                              {mealType === 'snack' && 'A'}
                              {mealType === 'lunch' && 'C'}
                              {mealType === 'afternoonSnack' && 'M'}
                              {mealType === 'dinner' && 'N'}
                              : {meals.map(m => m.recipe?.title || 'Receta').slice(0, 2).join(', ')}{meals.length > 2 ? '...' : ''}
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {selectedDate && (
        <MealPlanModal
          date={selectedDate}
          onClose={() => setSelectedDate(null)}
        />
      )}

      {showAIGenerate && (
        <AIGenerateModal
          onClose={() => {
            console.log('Closing AI modal');
            setShowAIGenerate(false);
          }}
          onGenerate={handleAIGenerate}
          recipes={recipes}
        />
      )}
    </div>
  );
};

export default CalendarPage;