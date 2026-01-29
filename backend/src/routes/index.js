import express from "express";
import authRoutes from "./auth.js";
import recipeRoutes from "./recipe.js";
import mealPlanRoutes from "./mealPlan.js";
import ingredientsRoutes from "./ingredients.js";
import aiRoutes from "./aiRoutes.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/recipes", recipeRoutes);
router.use("/meal-plans", mealPlanRoutes);
router.use("/ingredients", ingredientsRoutes);
router.use("/aiRoutes", aiRoutes);

export default router;