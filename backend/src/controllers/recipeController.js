import Recipe from "../models/Recipe.js";
import User from "../models/User.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Para __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Leer ingredientes una vez al iniciar
const ingredientsPath = path.join(__dirname, "../data/ingredients.json");
const ingredientsData = JSON.parse(fs.readFileSync(ingredientsPath, "utf-8"));

// Tabla de equivalencias para medidas abstractas
const abstractMeasureEquivalents = {
  'chorrito': { baseUnit: 'ml', value: 10 },
  'pizca': { baseUnit: 'g', value: 0.5 },
  'al-gusto': { baseUnit: 'g', value: 5 },
  'puñado': { baseUnit: 'g', value: 30 },
  'chorro': { baseUnit: 'ml', value: 25 },
  'cucharada-colmada': { baseUnit: 'g', value: 15 },
  'cucharada-rasa': { baseUnit: 'g', value: 10 },
  'pizca-grande': { baseUnit: 'g', value: 2 },
  'vaso': { baseUnit: 'ml', value: 200 },
  'taza': { baseUnit: 'ml', value: 250 }
};

const getIngredientId = (identifier, unit) => {
  // Primero por ID
  let ingredient = ingredientsData.find(i => i.id === identifier);

  if (!ingredient) {
    // Si no es un ID, buscar por nombre
    ingredient = ingredientsData.find(
      i =>
        i.names.es.toLowerCase() === identifier.toLowerCase() ||
        i.names.en.toLowerCase() === identifier.toLowerCase()
    );
  }

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

// Función para procesar ingredientes (nueva)
const processIngredients = (ingredients) => {
  return ingredients.map((ing) => {
    let ingredientId;
    
    // Si es medida abstracta, obtener la unidad base
    let finalUnit = ing.unit;
    let finalQuantity = ing.quantity;
    let isAbstract = ing.isAbstract || false;
    let abstractMeasure = ing.abstractMeasure || null;
    let displayQuantity = ing.displayQuantity || ing.quantity.toString();
    let displayUnit = ing.displayUnit || ing.unit;
    let estimatedValue = ing.estimatedValue || ing.quantity;
    
    if (isAbstract && abstractMeasure) {
      // Para medidas abstractas, usamos la unidad base
      const equivalent = abstractMeasureEquivalents[abstractMeasure];
      if (equivalent) {
        finalUnit = equivalent.baseUnit;
        // Convertir si es necesario (ej: 2 chorritos = 20ml)
        finalQuantity = parseFloat(ing.displayQuantity || 1) * equivalent.value;
        estimatedValue = finalQuantity;
      }
    }
    
    // Obtener el ID del ingrediente
    try {
      ingredientId = getIngredientId(ing.ingredient, finalUnit);
    } catch (error) {
      // Si falla con la unidad base, intentar con la unidad original
      ingredientId = getIngredientId(ing.ingredient, null);
    }
    
    return {
      ingredient: ingredientId,
      quantity: finalQuantity,
      unit: finalUnit,
      // Campos extendidos
      displayQuantity: displayQuantity,
      displayUnit: displayUnit,
      isAbstract: isAbstract,
      abstractMeasure: abstractMeasure,
      estimatedValue: estimatedValue
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

    res.status(201).json(recipe);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
};

export const getRecipes = async (req, res) => {
  try {
    const { search, limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let query = {
      $or: [
        { isPublic: true },
        { createdBy: req.user.id }
      ]
    };

    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    const recipes = await Recipe.find(query)
      .populate("createdBy", "username")
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Recipe.countDocuments(query);

    res.json({
      recipes,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener recetas" });
  }
};

export const getRecipeById = async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id)
      .populate("createdBy", "username email");

    if (!recipe) return res.status(404).json({ error: "Receta no encontrada" });

    if (!recipe.isPublic && recipe.createdBy.id.toString() !== req.user.id) {
      return res.status(403).json({ error: "No tienes permiso para ver esta receta" });
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

    res.json(recipeObj);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener la receta" });
  }
};

export const updateRecipe = async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) return res.status(404).json({ error: "Receta no encontrada" });

    if (recipe.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ error: "No eres el dueño de esta receta" });
    }

    // Si se actualizan ingredientes, procesarlos
    if (req.body.ingredients) {
      req.body.ingredients = processIngredients(req.body.ingredients);
    }

    Object.assign(recipe, req.body);
    await recipe.save();

    res.json(recipe);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
};

export const deleteRecipe = async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) return res.status(404).json({ error: "Receta no encontrada" });

    if (recipe.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ error: "No eres el dueño de esta receta" });
    }

    await recipe.deleteOne();
    res.json({ message: "Receta eliminada exitosamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar la receta" });
  }
};

export const getUserFavorites = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('favorites');
    
    res.json({
      success: true,
      favorites: user.favorites || []
    });
  } catch (err) {
    console.error('Error al obtener favoritos:', err);
    res.status(500).json({ 
      success: false,
      error: 'Error al obtener recetas favoritas' 
    });
  }
};

export const toggleFavorite = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const recipeId = req.params.id;
    
    // Verificar que la receta existe
    const recipe = await Recipe.findById(recipeId);
    if (!recipe) {
      return res.status(404).json({ error: "Receta no encontrada" });
    }
    
    const index = user.favorites.indexOf(recipeId);
    if (index === -1) {
      // Añadir a favoritos
      user.favorites.push(recipeId);
      await user.save();
      res.json({ 
        message: "Receta añadida a favoritos",
        isFavorite: true,
        favorites: user.favorites 
      });
    } else {
      // Quitar de favoritos
      user.favorites.splice(index, 1);
      await user.save();
      res.json({ 
        message: "Receta eliminada de favoritos",
        isFavorite: false,
        favorites: user.favorites 
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar favoritos" });
  }
};

// Función para generar lista de compras (nueva)
export const generateShoppingList = async (req, res) => {
  try {
    const { startDate, endDate, mealPlanIds } = req.body;
    
    // Aquí implementarías la lógica para:
    // 1. Obtener recetas de planes de comida en el rango de fechas
    // 2. Sumar ingredientes (usando quantity para medidas abstractas)
    // 3. Convertir a unidades estándar
    // 4. Agrupar por ingrediente
    
    res.json({
      success: true,
      shoppingList: [], // Tu lista de compras generada
      estimatedTotal: 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al generar lista de compras" });
  }
};