import Recipe from "../models/Recipe.js";
import User from "../models/User.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";


import { MESSAGE_CODES } from '../messages/messageCodes.js';
import { sendSuccess, throwApiError } from '../messages/responseHelper.js';
import { ApiError } from '../messages/ApiError.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ingredientsPath = path.join(__dirname, "../data/ingredients.json");
const ingredientsData = JSON.parse(fs.readFileSync(ingredientsPath, "utf-8"));

// Function to get ingredient ID by name and validate unit
const getIngredientId = (identifier, unit) => {

  ingredient = ingredientsData.find(
    i =>
      i.names.es.toLowerCase() === identifier.toLowerCase() ||
      i.names.en.toLowerCase() === identifier.toLowerCase()
  );

  if (!ingredient) {
    throw new Error(`Ingrediente no encontrado: ${identifier}`);
  }

  // Validar unidad permitida si se proporciona y no es medida abstracta
  if (unit && !ingredient.allowedUnits.includes(unit)) {
    throw new Error(
      `Unidad '${unit}' no permitida para ${ingredient.names.es}. Unidades permitidas: ${ingredient.allowedUnits.join(
        ", "
      )}`
    );
  }

  return ingredient.id;
};

// Function to process ingredients list
const processIngredients = (ingredients) => {
  return ingredients.map((ing) => {
    let ingredientId;
    
    // Si es medida abstracta, obtener la unidad base
    let finalUnit = ing.unit;
    let finalQuantity = ing.quantity;
    let displayQuantity = ing.displayQuantity || ing.quantity.toString();
    let displayUnit = ing.displayUnit || ing.unit;
    
    // Try to get ingredient ID with provided unit
    try {
      ingredientId = getIngredientId(ing.ingredient, finalUnit);
    } catch (error) {
      // If fails get ID without unit
      ingredientId = getIngredientId(ing.ingredient, null);
    }
    
    return {
      ingredient: ingredientId,
      quantity: finalQuantity,
      unit: finalUnit,
      displayQuantity: displayQuantity,
      displayUnit: displayUnit
    };
  });
};

export const createRecipe = async (req, res) => {
  try {
    const processedIngredients = processIngredients(req.body.ingredients);

    const recipe = await Recipe.create({
      ...req.body,
      ingredients: processedIngredients,
      createdBy: req.user.id
    });

    return sendSuccess(res, MESSAGE_CODES.RECIPE_CREATED, { recipe }, 201);
  } catch (err) {
    if (err instanceof ApiError) 
      return next(err);

    console.error("Error in createRecipe:", err);
    throwApiError(500, MESSAGE_CODES.INTERNAL_ERROR, { originalMessage: err.message });
  }
};

export const getRecipes = async (req, res) => {
  try {
    const { search } = req.query;
    
    let query = {
      $or: [
        { isPublic: true },
        { createdBy: req.user.id }
      ]
    };

    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    // We obtain all the recipes matching the query
    const recipes = await Recipe.find(query)
      .populate("createdBy", "username")
      .sort({ createdAt: -1 });

    const total = recipes.length;

    return sendSuccess(res, MESSAGE_CODES.RECIPES_FOUND, { recipes, total }, 200);
  } catch (err) {
    if (err instanceof ApiError) 
      return next(err);

    console.error("Error in getRecipes:", err);
    throwApiError(500, MESSAGE_CODES.INTERNAL_ERROR, { originalMessage: err.message });
  }
};

export const getRecipeById = async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id)
      .populate("createdBy", "username email");

    if (!recipe) {
      throwApiError(404, MESSAGE_CODES.RECIPE_NOT_FOUND);
    }

    if (!recipe.isPublic && recipe.createdBy.id.toString() !== req.user.id) {
      throwApiError(403, MESSAGE_CODES.AUTH_UNAUTHORIZED);
    }

    const recipeObj = recipe.toObject ? recipe.toObject() : recipe;
    if (Array.isArray(recipeObj.ingredients)) {
      recipeObj.ingredients = recipeObj.ingredients.map((ing) => {
        const ingData = ingredientsData.find(i => i.id === ing.ingredient);
        const name = ingData ? (ingData.names && (ingData.names.es || ingData.names.en)) : null;
        const category = ingData ? (ingData.category || 'Sin categoría') : null;

        return {
          ingredient: ing.ingredient,
          ingredientName: name,
          category,
          quantity: ing.quantity,
          unit: ing.unit,
          // Campos extendidos
          displayQuantity: ing.displayQuantity || ing.quantity.toString(),
          displayUnit: ing.displayUnit || ing.unit,
          isAbstract: ing.isAbstract || false,
          abstractMeasure: ing.abstractMeasure || null,
          estimatedValue: ing.estimatedValue || ing.quantity
        };
      });
    }

    return sendSuccess(res, MESSAGE_CODES.RECIPE_RETRIEVED, recipeObj);
  } catch (err) {
    if (err instanceof ApiError) 
      return next(err);

    console.error("Error in getRecipeById:", err);
    throwApiError(500, MESSAGE_CODES.INTERNAL_ERROR, { originalMessage: err.message });
  }
};

export const updateRecipe = async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      throwApiError(404, MESSAGE_CODES.RECIPE_NOT_FOUND);
    }

    if (recipe.createdBy.toString() !== req.user.id) {
      throwApiError(403, MESSAGE_CODES.AUTH_UNAUTHORIZED);
    }

    // If ingredients are being updated, process them
    if (req.body.ingredients) {
      req.body.ingredients = processIngredients(req.body.ingredients);
    }

    Object.assign(recipe, req.body);
    await recipe.save();

    return sendSuccess(res, MESSAGE_CODES.RECIPE_UPDATED, recipe);
  } catch (err) {
    if (err instanceof ApiError) 
      return next(err);

    console.error("Error in updateRecipe:", err);
    throwApiError(500, MESSAGE_CODES.INTERNAL_ERROR, { originalMessage: err.message });
  }
};

export const deleteRecipe = async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      throwApiError(404, MESSAGE_CODES.RECIPE_NOT_FOUND);S
    }

    if (recipe.createdBy.toString() !== req.user.id) {
      throwApiError(403, MESSAGE_CODES.AUTH_UNAUTHORIZED);
    }

    await recipe.deleteOne();
    return sendSuccess(res, MESSAGE_CODES.RECIPE_DELETED);
  } catch (err) {
    if (err instanceof ApiError) 
      return next(err);

    console.error("Error in deleteRecipe:", err);
    throwApiError(500, MESSAGE_CODES.INTERNAL_ERROR, { originalMessage: err.message });
  }
};

export const getUserFavorites = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('favorites');
    
    return sendSuccess(res, MESSAGE_CODES.USER_FAVORITES_RETRIEVED, { favorites: user.favorites });
  } catch (err) {
    if (err instanceof ApiError) 
      return next(err);

    console.error("Error in getUserFavorites:", err);
    throwApiError(500, MESSAGE_CODES.INTERNAL_ERROR, { originalMessage: err.message });
  }
};

export const toggleFavorite = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const recipeId = req.params.id;
    
    // Verify recipe exists
    const recipe = await Recipe.findById(recipeId);
    if (!recipe) {
      throwApiError(404, MESSAGE_CODES.RECIPE_NOT_FOUND);
    }
    
    const index = user.favorites.indexOf(recipeId);
    if (index === -1) {
      // Add to favorites
      user.favorites.push(recipeId);
      await user.save();
      return sendSuccess(res, MESSAGE_CODES.USER_FAVORITES_UPDATED, { favorites: user.favorites });
    } else {
      // Delete from favorites
      user.favorites.splice(index, 1);
      await user.save();
      return sendSuccess(res, MESSAGE_CODES.USER_FAVORITES_UPDATED, { favorites: user.favorites });
    }
  } catch (err) {
    if (err instanceof ApiError) 
      return next(err);

    console.error("Error in toggleFavorite:", err);
    throwApiError(500, MESSAGE_CODES.INTERNAL_ERROR, { originalMessage: err.message });
  }
};

// Function to generate shopping list from meal plans (future implementation)
export const generateShoppingList = async (req, res) => {
  try {
    const { startDate, endDate, mealPlanIds } = req.body;
    
    // Here would go the logic to generate the shopping list based on meal plans
    // 1. Obtain recipes from meal plans within date range or specified IDs
    // 2. Add up ingredient quantities
    // 4. Return the shopping list
    
    return sendSuccess(res, MESSAGE_CODES.SHOPPING_LIST_GENERATED, { shoppingList: [] });
  } catch (err) {
    if (err instanceof ApiError) 
      return next(err);

    console.error("Error in generateShoppingList:", err);
    throwApiError(500, MESSAGE_CODES.INTERNAL_ERROR, { originalMessage: err.message });
  }
};