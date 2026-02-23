import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { MESSAGE_CODES } from '../messages/messageCodes.js';
import { sendSuccess, throwApiError } from '../messages/responseHelper.js';
import { ApiError } from '../messages/ApiError.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ingredientsPath = path.join(__dirname, "../data/ingredients.json");

// Get all ingredients with optional filtering
router.get("/", (req, res, next) => {
  try {
    const { query } = req.query;
    const data = JSON.parse(fs.readFileSync(ingredientsPath, "utf-8"));

    let results = data;

    if (query) {
      const q = query.toLowerCase();
      results = data.filter(i =>
        i.name && i.name.toLowerCase().includes(q)
      );
    }

    return sendSuccess(res, MESSAGE_CODES.INGREDIENTS_FETCHED, { count: results.length, ingredients: results }, 200);
    
  } catch (err) {
    if (err instanceof ApiError)
      return next(err);
    
    console.error("Error in getIngredients:", err);
    throwApiError(500, MESSAGE_CODES.INTERNAL_ERROR, { originalMessage: err.message });
}
});

router.post('/search-by-keys', (req, res, next) => {
  try {
    const { keys } = req.body;
    
    console.log('Buscando ingredientes con keys:', keys); // Para debugging
    
    // Validar que recibimos un array de keys
    if (!keys || !Array.isArray(keys) || keys.length === 0) {
      return throwApiError(400, MESSAGE_CODES.BAD_REQUEST, { 
        originalMessage: 'Se requiere un array de keys' 
      });
    }

    // Leer el archivo JSON
    const data = JSON.parse(fs.readFileSync(ingredientsPath, "utf-8"));
    
    // Filtrar ingredientes cuyas keys estén en el array recibido
    const ingredients = data.filter(ingredient => 
      keys.includes(ingredient.name) // Asumiendo que el campo se llama 'name'
    );

    console.log(`Encontrados ${ingredients.length} ingredientes de ${keys.length} keys buscadas`);

    // Devolver los resultados
    return sendSuccess(
      res, 
      MESSAGE_CODES.INGREDIENTS_FETCHED, 
      { 
        count: ingredients.length,
        ingredients: ingredients,
        searchedKeys: keys.length,
        foundKeys: ingredients.length
      }, 
      200
    );
    
  } catch (err) {
    if (err instanceof ApiError)
      return next(err);
    
    console.error("Error in search-by-keys:", err);
    throwApiError(500, MESSAGE_CODES.INTERNAL_ERROR, { originalMessage: err.message });
  }
});

// Obtain ingredients by category
router.get("/category/:category", (req, res, next) => {
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