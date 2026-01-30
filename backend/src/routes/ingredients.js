import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { MESSAGE_CODES } from '../messages/messageCodes.js';
import { sendSuccess, throwApiError } from '../messages/responseHelper.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ingredientsPath = path.join(__dirname, "../data/ingredients.json");

// Get all ingredients with optional filtering
router.get("/", (req, res) => {
  try {
    const { query, lang = "es", limit = 20 } = req.query;
    const data = JSON.parse(fs.readFileSync(ingredientsPath, "utf-8"));

    let results = data;

    if (query) {
      const q = query.toLowerCase();
      results = data.filter(i =>
        i.names[lang] && i.names[lang].toLowerCase().includes(q)
      );
    }

    // Limit results
    results = results.slice(0, parseInt(limit));

    return sendSuccess(res, MESSAGE_CODES.INGREDIENTS_FETCHED, { count: results.length, ingredients: results }, 200);
    
  } catch (err) {
    if (err instanceof ApiError)
      return next(err);
    
    console.error("Error in getIngredients:", err);
    throwApiError(500, MESSAGE_CODES.INTERNAL_ERROR, { originalMessage: err.message });
}
});

// Get ingredient by ID
router.get("/:id", (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(ingredientsPath, "utf-8"));
    const ingredient = data.find(i => i.id === req.params.id);

    if (!ingredient) {
      throwApiError(404, MESSAGE_CODES.INGREDIENT_NOT_FOUND);
    }

    sendSuccess(res, MESSAGE_CODES.INGREDIENT_FETCHED, { ingredient }, 200);
  } catch (err) {
    if (err instanceof ApiError)
      return next(err);
    
    console.error("Error in getIngredientsById:", err);
    throwApiError(500, MESSAGE_CODES.INTERNAL_ERROR, { originalMessage: err.message });
  }
});

// Obtener ingredientes por categoría
router.get("/category/:category", (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(ingredientsPath, "utf-8"));
    const ingredients = data.filter(i => 
      i.categoria.toLowerCase() === req.params.category.toLowerCase()
    );

    sendSuccess(res, MESSAGE_CODES.INGREDIENTS_FETCHED, { count: ingredients.length, ingredients }, 200);
  } catch (err) {
    if (err instanceof ApiError)
      return next(err);
    
    console.error("Error in getIngredientsByCategory:", err);
    throwApiError(500, MESSAGE_CODES.INTERNAL_ERROR, { originalMessage: err.message });
  }
});

export default router;