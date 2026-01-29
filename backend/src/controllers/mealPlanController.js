import MealPlan from "../models/MealPlan.js";
import Recipe from "../models/Recipe.js";

export const getMealPlans = async (req, res) => {
  try {
    const { start, end } = req.query;

    const query = { user: req.user.id };
    if (start && end) {
      query.date = { $gte: new Date(start), $lte: new Date(end) };
    }

    const plans = await MealPlan.find(query)
      .populate({
        path: 'meals.breakfast.recipe',
        select: 'title imageUrl servings prepTime difficulty'
      })
      .populate({
        path: 'meals.snack.recipe',
        select: 'title imageUrl servings prepTime difficulty'
      })
      .populate({
        path: 'meals.lunch.recipe',
        select: 'title imageUrl servings prepTime difficulty'
      })
      .populate({
        path: 'meals.afternoonSnack.recipe',
        select: 'title imageUrl servings prepTime difficulty'
      })
      .populate({
        path: 'meals.dinner.recipe',
        select: 'title imageUrl servings prepTime difficulty'
      })
      .sort({ date: 1 });

    res.json({
      success: true,
      count: plans.length,
      mealPlans: plans
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      success: false,
      error: "Error al obtener planes de comida" 
    });
  }
};

export const upsertMealPlan = async (req, res) => {
  try {
    const { date, meals } = req.body;

    if (!date) {
      return res.status(400).json({ 
        success: false,
        error: "La fecha es requerida" 
      });
    }

    const planDate = new Date(date);
    if (isNaN(planDate.getTime())) {
      return res.status(400).json({ 
        success: false,
        error: "Fecha no válida" 
      });
    }

    // Verificar si ya existe un plan para esta fecha
    const existingPlan = await MealPlan.findOne({
      user: req.user.id,
      date: planDate
    });

    let validatedMeals = {};
    
    // Si existe un plan, usar sus comidas como base
    if (existingPlan && existingPlan.meals) {
      validatedMeals = { ...existingPlan.meals.toObject() };
    }

    // Procesar solo las comidas que se envían en la petición
    if (meals) {
      const mealTypes = Object.keys(meals);
      
      for (const mealType of mealTypes) {
        const mealArray = meals[mealType];
        
        // Si se envía null o undefined, eliminar esa comida del plan
        if (mealArray === null || mealArray === undefined) {
          validatedMeals[mealType] = [];
          continue;
        }
        
        // Asegurarse de que sea un array
        if (!Array.isArray(mealArray)) {
          return res.status(400).json({ 
            success: false,
            error: `${mealType} debe ser un array de comidas` 
          });
        }
        
        validatedMeals[mealType] = [];
        
        for (const meal of mealArray) {
          // Si el meal es null o vacío, saltar
          if (!meal || !meal.recipe) {
            continue;
          }
          
          let recipe;
          
          // Buscar por ID (si es un ObjectId válido)
          if (meal.recipe.match(/^[0-9a-fA-F]{24}$/)) {
            recipe = await Recipe.findById(meal.recipe);
          } 
          // Si no es un ObjectId, buscar por título
          else {
            // Buscar receta por título (entre las públicas o del usuario)
            recipe = await Recipe.findOne({
              title: { $regex: new RegExp(meal.recipe, 'i') },
              $or: [
                { isPublic: true },
                { createdBy: req.user.id }
              ]
            });
          }

          if (!recipe) {
            return res.status(404).json({ 
              success: false,
              error: `Receta no encontrada para ${mealType}: "${meal.recipe}"` 
            });
          }

          // Verificar permisos
          if (!recipe.isPublic && recipe.createdBy.toString() !== req.user.id) {
            return res.status(403).json({ 
              success: false,
              error: `No tienes permiso para usar la receta "${recipe.title}"` 
            });
          }

          // Agregar la comida al array
          validatedMeals[mealType].push({
            recipe: recipe.id,
            people: Math.min(Math.max(meal.people || 4, 1), 20),
            notes: meal.notes?.trim() || ""
          });
        }
      }
    }

    // Filtrar comidas que sean arrays vacíos
    Object.keys(validatedMeals).forEach(key => {
      if (!validatedMeals[key] || validatedMeals[key].length === 0) {
        delete validatedMeals[key];
      }
    });

    const plan = await MealPlan.findOneAndUpdate(
      { user: req.user.id, date: planDate },
      { 
        user: req.user.id, 
        date: planDate,
        meals: validatedMeals 
      },
      { 
        upsert: true, 
        new: true,
        runValidators: true 
      }
    )
    .populate({
      path: 'meals.breakfast.recipe',
      select: 'title imageUrl servings prepTime difficulty'
    })
    .populate({
      path: 'meals.snack.recipe',
      select: 'title imageUrl servings prepTime difficulty'
    })
    .populate({
      path: 'meals.lunch.recipe',
      select: 'title imageUrl servings prepTime difficulty'
    })
    .populate({
      path: 'meals.afternoonSnack.recipe',
      select: 'title imageUrl servings prepTime difficulty'
    })
    .populate({
      path: 'meals.dinner.recipe',
      select: 'title imageUrl servings prepTime difficulty'
    });

    res.json({
      success: true,
      message: "Plan de comida guardado exitosamente",
      mealPlan: plan
    });
  } catch (err) {
    console.error("Error en upsertMealPlan:", err);
    
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({ 
        success: false,
        error: messages.join(', ') 
      });
    }
    
    if (err.code === 11000) {
      return res.status(400).json({ 
        success: false,
        error: "Ya existe un plan de comida para esta fecha" 
      });
    }
    
    res.status(400).json({ 
      success: false,
      error: err.message || "Error al guardar el plan de comida" 
    });
  }
};

export const deleteMealPlan = async (req, res) => {
  try {
    const { date } = req.params;
    
    if (!date) {
      return res.status(400).json({ 
        success: false,
        error: "La fecha es requerida" 
      });
    }

    const planDate = new Date(date);
    if (isNaN(planDate.getTime())) {
      return res.status(400).json({ 
        success: false,
        error: "Fecha no válida" 
      });
    }

    const result = await MealPlan.deleteOne({
      user: req.user.id,
      date: planDate
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ 
        success: false,
        error: "No se encontró un plan de comida para esta fecha" 
      });
    }

    res.json({
      success: true,
      message: "Plan de comida eliminado exitosamente"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      success: false,
      error: "Error al eliminar plan de comida" 
    });
  }
};

export const updateMeal = async (req, res) => {
  try {
    const { date, mealType } = req.params;
    const { recipe, people, notes } = req.body;

    if (!date || !mealType) {
      return res.status(400).json({ 
        success: false,
        error: "Fecha y tipo de comida son requeridos" 
      });
    }

    const planDate = new Date(date);
    if (isNaN(planDate.getTime())) {
      return res.status(400).json({ 
        success: false,
        error: "Fecha no válida" 
      });
    }

    // Tipos de comida válidos
    const validMealTypes = ['breakfast', 'lunch', 'dinner', 'snack', 'afternoonSnack'];
    if (!validMealTypes.includes(mealType)) {
      return res.status(400).json({ 
        success: false,
        error: `Tipo de comida no válido. Usa: ${validMealTypes.join(', ')}` 
      });
    }

    // Buscar receta si se proporciona
    let recipeDoc = null;
    if (recipe) {
      if (recipe.match(/^[0-9a-fA-F]{24}$/)) {
        recipeDoc = await Recipe.findById(recipe);
      } else {
        recipeDoc = await Recipe.findOne({
          title: { $regex: new RegExp(recipe, 'i') },
          $or: [
            { isPublic: true },
            { createdBy: req.user.id }
          ]
        });
      }

      if (!recipeDoc) {
        return res.status(404).json({ 
          success: false,
          error: `Receta no encontrada: "${recipe}"` 
        });
      }

      // Verificar permisos
      if (!recipeDoc.isPublic && recipeDoc.createdBy.toString() !== req.user.id) {
        return res.status(403).json({ 
          success: false,
          error: `No tienes permiso para usar la receta "${recipeDoc.title}"` 
        });
      }
    }

    // Encontrar o crear el plan
    let plan = await MealPlan.findOne({
      user: req.user.id,
      date: planDate
    });

    if (!plan) {
      // Crear nuevo plan si no existe
      plan = new MealPlan({
        user: req.user.id,
        date: planDate,
        meals: {}
      });
    }

    // Actualizar o eliminar la comida específica
    if (recipe === null || recipe === undefined) {
      // Eliminar esta comida del plan
      plan.meals[mealType] = undefined;
    } else {
      // Actualizar o crear la comida
      plan.meals[mealType] = {
        recipe: recipeDoc.id,
        people: people || 4,
        notes: notes || ""
      };
    }

    // Eliminar comidas undefined
    if (plan.meals[mealType] === undefined) {
      delete plan.meals[mealType];
    }

    await plan.save();
    
    // Populate para devolver información completa
    await plan.populate({
      path: 'meals.breakfast.recipe',
      select: 'title imageUrl servings prepTime difficulty'
    });
    await plan.populate({
      path: 'meals.snack.recipe',
      select: 'title imageUrl servings prepTime difficulty'
    });
    await plan.populate({
      path: 'meals.lunch.recipe',
      select: 'title imageUrl servings prepTime difficulty'
    });
    await plan.populate({
      path: 'meals.afternoonSnack.recipe',
      select: 'title imageUrl servings prepTime difficulty'
    });
    await plan.populate({
      path: 'meals.dinner.recipe',
      select: 'title imageUrl servings prepTime difficulty'
    });

    res.json({
      success: true,
      message: `Comida ${mealType} actualizada exitosamente`,
      mealPlan: plan
    });
  } catch (err) {
    console.error("Error en updateMeal:", err);
    res.status(400).json({ 
      success: false,
      error: err.message || "Error al actualizar la comida" 
    });
  }
};