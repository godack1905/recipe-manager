import MealPlan from "../models/MealPlan.js";
import Recipe from "../models/Recipe.js";

import { MESSAGE_CODES } from '../messages/messageCodes.js';
import { sendSuccess, throwApiError } from '../messages/responseHelper.js';
import { ApiError } from '../messages/ApiError.js';

export const getMealPlans = async (req, res, next) => {
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

    return sendSuccess(res, MESSAGE_CODES.MEALPLANS_RETRIEVED, {
      count: plans.length,
      mealPlans: plans
    });
  } catch (err) {
    if (err instanceof ApiError) 
      return next(err);

    console.error("Error in getMealPlans:", err);
    throwApiError(500, MESSAGE_CODES.INTERNAL_ERROR, { originalMessage: err.message });
  }
};

export const upsertMealPlan = async (req, res, next) => {
  try {
    const { date, meals } = req.body;

    if (!date) {
      throwApiError(400, MESSAGE_CODES.DATE_REQUIRED);
    }

    const planDate = new Date(date);
    if (isNaN(planDate.getTime())) {
      throwApiError(400, MESSAGE_CODES.INVALID_DATE);
    }

    // Verify if a meal plan already exists for the date
    const existingPlan = await MealPlan.findOne({
      user: req.user.id,
      date: planDate
    });

    let validatedMeals = {};
    
    // If plan exists, start with its meals
    if (existingPlan && existingPlan.meals) {
      validatedMeals = { ...existingPlan.meals.toObject() };
    }

    // Validate and process the incoming meals
    if (meals) {
      const mealTypes = Object.keys(meals);
      
      for (const mealType of mealTypes) {
        const mealArray = meals[mealType];
        
        // If the meal array is null or undefined, set to empty array
        if (mealArray === null || mealArray === undefined) {
          validatedMeals[mealType] = [];
          continue;
        }
        
        // Make sure it's an array
        if (!Array.isArray(mealArray)) {
          throwApiError(400, MESSAGE_CODES.INVALID_MEAL_TYPE);
        }
        
        validatedMeals[mealType] = [];
        
        for (const meal of mealArray) {
          // Skip if meal or recipe is missing
          if (!meal || !meal.recipe) {
            continue;
          }
          
          let recipe;
          
          // Search recipe by ID or title
          if (meal.recipe.match(/^[0-9a-fA-F]{24}$/)) {
            recipe = await Recipe.findById(meal.recipe);
          } 
          // If not a valid ID, search by title
          else {
            recipe = await Recipe.findOne({
              title: { $regex: new RegExp(meal.recipe, 'i') },
              $or: [
                { isPublic: true },
                { createdBy: req.user.id }
              ]
            });
          }

          if (!recipe) {
            throwApiError(404, MESSAGE_CODES.RECIPE_NOT_FOUND);
          }

          // Verify permissions
          if (!recipe.isPublic && recipe.createdBy.toString() !== req.user.id) {
            throwApiError(403, MESSAGE_CODES.AUTH_UNAUTHORIZED);
          }

          // Add validated meal
          validatedMeals[mealType].push({
            recipe: recipe.id,
            people: Math.min(Math.max(meal.people || 4, 1), 20),
            notes: meal.notes?.trim() || ""
          });
        }
      }
    }

    // Remove empty meal types
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

    return sendSuccess(res, MESSAGE_CODES.MEALPLAN_ADDED, {
      mealPlan: plan
    });

  } catch (err) {

    // If it's already an ApiError, rethrow it
    if (err instanceof ApiError) {
      return next(err);
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message).join(', ');
      throwApiError(400, MESSAGE_CODES.VALIDATION_ERROR, { messages });
    }

    // Duplicate key error
    if (err.code === 11000) {
      throwApiError(400, MESSAGE_CODES.DUPLICATE_MEALPLAN);
    }

    // Other errors
    throwApiError(500, MESSAGE_CODES.INTERNAL_ERROR, { originalMessage: err.message });
  }
};

export const deleteMealPlan = async (req, res, next) => {
  try {
    const { date } = req.params;
    
    if (!date) {
      throwApiError(400, MESSAGE_CODES.DATE_REQUIRED);
    }

    const planDate = new Date(date);
    if (isNaN(planDate.getTime())) {
      throwApiError(400, MESSAGE_CODES.INVALID_DATE);
    }

    const result = await MealPlan.deleteOne({
      user: req.user.id,
      date: planDate
    });

    if (result.deletedCount === 0) {
      throwApiError(400, MESSAGE_CODES.MEALPLAN_NOT_FOUND);
    }

    return sendSuccess(res, MESSAGE_CODES.MEALPLAN_DELETED);

  } catch (err) {
    if (err instanceof ApiError) 
      return next(err);

    console.error("Error in deleteMealPlan:", err);
    throwApiError(500, MESSAGE_CODES.INTERNAL_ERROR, { originalMessage: err.message });
  }
};

export const updateMeal = async (req, res, next) => {
  try {
    const { date, mealType } = req.params;
    const { recipe, people, notes } = req.body;

    if (!date || !mealType) {
      throwApiError(400, MESSAGE_CODES.MISSING_FIELDS);
    }

    const planDate = new Date(date);
    if (isNaN(planDate.getTime())) {
      throwApiError(400, MESSAGE_CODES.INVALID_DATE);
    }

    // Validation of mealType
    const validMealTypes = ['breakfast', 'lunch', 'dinner', 'snack', 'afternoonSnack'];
    if (!validMealTypes.includes(mealType)) {
      throwApiError(400, MESSAGE_CODES.INVALID_MEAL_TYPE);
    }

    // Search recipe if provided
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
        throwApiError(404, MESSAGE_CODES.RECIPE_NOT_FOUND);
      }

      // Verify permissions
      if (!recipeDoc.isPublic && recipeDoc.createdBy.toString() !== req.user.id) {
        throwApiError(403, MESSAGE_CODES.AUTH_UNAUTHORIZED);
      }
    }

    // Find or create meal plan
    let plan = await MealPlan.findOne({
      user: req.user.id,
      date: planDate
    });

    if (!plan) {
      plan = new MealPlan({
        user: req.user.id,
        date: planDate,
        meals: {}
      });
    }

    // Update the specific meal
    if (recipe === null || recipe === undefined) {
      // Delete the meal from the plan
      plan.meals[mealType] = undefined;
    } else {
      // Update or add the meal
      plan.meals[mealType] = {
        recipe: recipeDoc.id,
        people: people || 4,
        notes: notes || ""
      };
    }

    // Delete mealType if it's undefined
    if (plan.meals[mealType] === undefined) {
      delete plan.meals[mealType];
    }

    await plan.save();
    
    // Populate the meal plan before returning
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

    return sendSuccess(res, MESSAGE_CODES.MEALPLAN_UPDATED, { mealPlan: plan });
  } catch (err) {
    if (err instanceof ApiError) 
      return next(err);

    console.error("Error in updateMeal:", err);
    throwApiError(500, MESSAGE_CODES.INTERNAL_ERROR, { originalMessage: err.message });
  }
};