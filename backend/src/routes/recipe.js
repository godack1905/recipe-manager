import express from "express";
import {
  createRecipe,
  getRecipes,
  getRecipeById,
  updateRecipe,
  deleteRecipe,
  toggleFavorite,
  getUserFavorites
} from "../controllers/recipeController.js";

import { auth } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(auth);

router.get("/", getRecipes);
router.get("/:id", getRecipeById);
router.post("/", createRecipe);
router.put("/:id", updateRecipe);
router.delete("/:id", deleteRecipe);
router.post("/:id/favorite", toggleFavorite);
router.get("/user/favorites", getUserFavorites);

export default router;