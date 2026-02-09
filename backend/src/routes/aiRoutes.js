import express from 'express';
import axios from 'axios';

import { MESSAGE_CODES } from '../messages/messageCodes.js';
import { sendSuccess, throwApiError } from '../messages/responseHelper.js';

const router = express.Router();

// Principal endpoint with GROQ API integration
router.post('/generate-meal-plan', async (req, res, next) => {
  try {
    const { favoriteRecipes, preferences, selectedMealTypes } = req.body;

    // Basic validations
    if (!favoriteRecipes?.length) {
      throwApiError(400, MESSAGE_CODES.NO_FAVORITE_RECIPES);
    }

    if (!selectedMealTypes?.length) {
      throwApiError(400, MESSAGE_CODES.MEAL_TYPE_REQUIRED);
    }


    // Try generating with GROQ API first
    const aiPlan = await generateWithGroq(favoriteRecipes, preferences, selectedMealTypes);
    
    if (aiPlan && Object.keys(aiPlan).length > 0) {
      return sendSuccess(res, MESSAGE_CODES.MEALPLAN_GENERATED, { mealPlan: aiPlan, source: 'groq' }, 201);
    }

    throwApiError(500, MESSAGE_CODES.MEALPLAN_GENERATION_FAILED);
    
  } catch (error) {
    next(error);
  }
});

// Generate meal plan using GROQ API
async function generateWithGroq(recipes, preferences, selectedMealTypes) {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) return null;

  try {
    const prompt = buildStructuredGroqPrompt(
      recipes,
      preferences,
      selectedMealTypes
    );

    const plan = await callGroqWithRetry(
      prompt,
      recipes,
      selectedMealTypes
    );

    if (!plan || Object.keys(plan).length === 0) {
      return null;
    }

    return validateCompletePlan(
      plan,
      recipes,
      selectedMealTypes,
      preferences.duration
    );

  } catch (error) {
    console.error('GROQ generation failed:', error.message);
    return null;
  }
}

// GROQ API call with retries and multiple models
async function callGroqWithRetry(prompt, recipes, selectedMealTypes, maxRetries = 3) {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  const models = [
    "llama-3.1-70b-versatile",     // First model (the best option)
    "llama-3.3-70b-versatile",     // Powerful alternative
    "llama-3.1-8b-instant",        // Faster, smaller model
  ];
  
  for (let retry = 0; retry < maxRetries; retry++) {
    for (const model of models) {
      try {
        
        const response = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            model: model,
            messages: [{
              role: "user",
              content: prompt
            }],
            temperature: 0.2,
            max_tokens: 3000,
            response_format: { type: "json_object" }
          },
          {
            timeout: 30000,
            headers: {
              'Authorization': `Bearer ${GROQ_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        const resultText = response.data?.choices?.[0]?.message?.content;
        
        if (!resultText) {
          continue;
        }
        
        
        const parsedPlan = parseAndValidateBatch(resultText, recipes, selectedMealTypes);
        
        if (parsedPlan) {
          return parsedPlan;
        }
        
      } catch (error) {
        
        if (error.response?.status === 429) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    if (retry < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return null;
}

// STRUCTURED PROMPT BUILDING
function buildStructuredGroqPrompt(recipes, preferences, selectedMealTypes, dayOffset = 0) {
  // Categorize recipes by tags
  const categorizedRecipes = categorizeRecipesByTags(recipes);
  
  // Generate date list
  const today = new Date();
  const dates = [];
  for (let i = 0; i < preferences.duration; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + dayOffset + i);
    dates.push(date.toISOString().split('T')[0]);
  }
  
  const mealStructure = selectedMealTypes.map(type => {
    const rules = {
      breakfast: "Only recipes with 'breakfast' tag",
      lunch: "Only recipes with 'lunch' tag, and has to be [one recipe with 'uniqueDish' tag] OR [one recipe with 'firstCourse' tag and one with 'secondCourse' tag]",
      dinner: "Only recipes with 'dinner' tag, and has to be [one recipe with 'uniqueDish' tag] OR [one recipe with 'firstCourse' tag and one with 'secondCourse' tag]",
      snack: "Only recipes with 'snack' tag"
    };
    return `• ${type}: ${rules[type] || "1 receta apropiada"}`;
  }).join('\n');
  
  const selectedMealsText = selectedMealTypes.map(type => 
    `${type} (${type})`
  ).join(', ');
  
  return `GENERATE A MEAL PLAN in strict JSON format. Follow these rules EXACTLY:

## BASIC INFORMATION
- Days to plan: ${preferences.duration} (${dates.join(', ')})
- People: ${preferences.people}
- Max cooking time: ${preferences.maxPrepTime || 60} minutos
- Meals per day: ${selectedMealsText}

## MANDATORY STRUCTURE PER DAY (tag based):
${mealStructure}

## ABSOLUTE RULES (DO NOT IGNORE ANY):
1. For LUNCH and DINNER: 
   - OPTION A: 1 recipe tagged “single dish” (only 1 recipe)
   - OPTION B: 2 recipes - ONE tagged “first course” and ANOTHER tagged “second course”

2. PROHIBITED COMBINATIONS FOR LUNCH AND DINNER (NEVER use):
   - 1 recipe tagged 'firstCourse'
   - 1 recipe tagged 'secondCourse'
   - 2 recipes tagged 'firstCourse'
   - 2 recipes tagged 'secondCourse'
   - 2 recipes tagged 'uniqueDish'
   - Mixing recipes tagged 'uniqueDish' with recipes tagged 'firstCourse' or 'secondCourse'

3. CORRECT USE OF TAGS (MANDATORY):
   - Tag 'special' → ONLY on weekends
   - Tag 'breakfast' → ONLY for breakfast
   - 'lunch' tag → ONLY for lunch
   - 'dinner' tag → ONLY for dinner
   - 'snack' tag → ONLY for snack/afternoon snack
   - 'uniqueDish' tag → For lunch or dinner, as the ONLY recipe
   - 'firstCourse' tag → For lunch or dinner, COMBINED with a second course
   - 'secondCourse' tag → For lunch or dinner, COMBINED with a first course

4. INGREDIENT VARIETY AND BALANCE RULES (MANDATORY):

   - Each recipe includes a list of ingredients. The model MUST reason about them intelligently.
   - Distinguish between:
     - MAIN INGREDIENTS: ingredients that define the dish (e.g. salmon, chicken, beef, potatoes, green beans, rice, pasta).
     - SECONDARY / COMMON INGREDIENTS: ingredients that are frequently used and do NOT define the dish (e.g. olive oil, salt, pepper, garlic, onion, basic spices).

   - Variety rules apply ONLY to MAIN INGREDIENTS.

   - DO NOT consider secondary/common ingredients when checking variety.
   - Repeating olive oil, salt, spices, garlic, etc. is always allowed.

   - Variety constraints:
     - Do NOT repeat the same MAIN protein (e.g. salmon, chicken, beef, eggs) on consecutive days (or same day).
     - Do NOT repeat the same MAIN vegetable or carbohydrate (e.g. potatoes, rice, pasta, green beans) on consecutive days (or same day).
     - Do NOT repeat the same MAIN ingredient more than once within the same day.

   - Balance rules:
     - Each day should include a balance of protein, vegetables, and carbohydrates.
     - Avoid days dominated by a single type of ingredient (e.g. only meat-heavy or only carb-heavy meals).

   - The model MUST infer MAIN INGREDIENTS from the ingredient lists.
   - Do NOT assume all ingredients are equally important.

## AVAILABLE RECIPES (${recipes.length}) SORTED BY TAGS:

### 1. FOR BREAKFAST - tags: breakfast:
${categorizedRecipes.breakfast.map(r => formatRecipeForPrompt(r)).join('\n') || 'NONE AVAILABLE'}

### 2. FOR LUNCH  - tags: food:
${categorizedRecipes.lunch.map(r => formatRecipeForPrompt(r)).join('\n') || 'NONE AVAILABLE'}

### 3. FOR DINNER - tags: dinner:
${categorizedRecipes.dinner.map(r => formatRecipeForPrompt(r)).join('\n') || 'NONE AVAILABLE'}

### 4. FOR SNACK TIME - tags: snack:
${categorizedRecipes.snacks.map(r => formatRecipeForPrompt(r)).join('\n') || 'NONE AVAILABLE'}

## CORRECT STRUCTURE EXAMPLES:

### Example 1: Meal with 2 courses (first course + second course)
"2026-01-29": {
  "lunch": [
    {"recipeId": "ID1"},
    {"recipeId": "ID2"}
  ]
}

### Example 2: Meal with a single course
"2026-01-30": {
  "lunch": [
    {"recipeId": "ID3"}
  ]
}

### Example 3: Dinner with 2 courses
"2026-01-29": {
  "dinner": [
    {"recipeId": "ID4"},
    {"recipeId": "ID5"}
  ]
}

## EXACT OUTPUT FORMAT:
{
  "YYYY-MM-DD": {
    "mealType": [
      {"recipeId": "RECIPE_ID"}
    ]
  }
}

## GENERATE THE MEAL PLAN FOR ${preferences.duration} DAYS:
${dates.join(', ')}

IMPORTANT FINAL NOTE:
• Each day MUST have ${selectedMealTypes.length} types of food: ${selectedMealTypes.join(", ")}
• For lunch/dinner: Either 1 recipe (uniqueDish) OR 2 recipes (firstCourse + secondCourse)
• Strictly adhere to the tags for each recipe
• Do not invent recipes, use ONLY those provided

ANSWER: ONLY the JSON object, no additional text, no explanations.`;
}

// Recipe format for prompt 
function formatRecipeForPrompt(recipe) {
  const tags = recipe.tags || [];
  const cookingTime = recipe.cookingTime || 'nonSpecify';
  const ingredients = recipe.ingredients
  ?.map(i => `${i.name} - ${i.quantity}${i.unit}`)
  .join(', ') || 'none';
  
  return `  • ID: "${recipe.id}" 
    Tags: ${tags.join(', ') || 'without tags'}
    Time: ${cookingTime} min | Ingredients: ${ingredients}`;
}

// Categorize recipes by tags
function categorizeRecipesByTags(recipes) {
  const categorized = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snacks: [],
  };
  
  recipes.forEach(recipe => {
    const tags = (recipe.tags || []).map(t => t.toLowerCase());
    
    // Categorize by meal type
    if (tags.includes('breakfast')) categorized.breakfast.push(recipe);
    if (tags.includes('lunch')) categorized.lunch.push(recipe);
    if (tags.includes('dinner')) categorized.dinner.push(recipe);
    if (tags.includes('snack')) categorized.snacks.push(recipe);
  
  });
  
  return categorized;
}

// Parse and validate batch
function parseAndValidateBatch(text, recipes, selectedMealTypes) {
  try {
    const cleanedText = cleanGroqResponse(text);
    if (!cleanedText || cleanedText === '{}') return null;
    
    const parsed = JSON.parse(cleanedText);
    return validateBatchPlan(parsed, recipes, selectedMealTypes);
    
  } catch (error) {
    console.error('Error:', error.message);
    return null;
  }
}

// Validate batch plan
function validateBatchPlan(plan, recipes, selectedMealTypes) {
  if (!plan || typeof plan !== 'object') return null;
  
  const validPlan = {};
  const recipeMap = recipes.reduce((map, recipe) => {
    map[recipe.id] = recipe;
    return map;
  }, {});
  
  let validDays = 0;
  
  Object.entries(plan).forEach(([dateStr, dayPlan]) => {
    // Validate date
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return;
    
    if (!dayPlan || typeof dayPlan !== 'object') return;
    
    // Verify all requested meals
    const hasAllMeals = selectedMealTypes.every(mealType => 
      dayPlan[mealType] && Array.isArray(dayPlan[mealType]) && dayPlan[mealType].length > 0
    );
    
    if (!hasAllMeals) {
      return;
    }
    
    // Verify structure
    let isValidDay = true;
    const validatedDay = {};
    
    selectedMealTypes.forEach(mealType => {
      const items = dayPlan[mealType];
      const validItems = items.filter(
        item => item && item.recipeId && recipeMap[item.recipeId]
      );

      if (!Array.isArray(items)) {
        isValidDay = false;
        return;
      }
      
      if (validItems.length === 0) {
        isValidDay = false;
        return;
      }
      
      // Validar estructura para lunch/dinner
      if (mealType === 'lunch' || mealType === 'dinner') {
        if (validItems.length !== 1 && validItems.length !== 2) {
          isValidDay = false;
          return;
        }
      }
      
      validatedDay[mealType] = validItems;
    });
    
    if (isValidDay && Object.keys(validatedDay).length === selectedMealTypes.length) {
      validPlan[dateStr] = validatedDay;
      validDays++;
    }
  });
  
  return validDays > 0 ? validPlan : null;
}

// Final complete validation
function validateCompletePlan(plan, recipes, selectedMealTypes, expectedDays) {
  if (!plan || Object.keys(plan).length !== expectedDays) {
    return null;
  }
  
  // Sort dates
  const sortedDates = Object.keys(plan).sort();
  const finalPlan = {};
  const recipeMap = recipes.reduce((map, recipe) => {
    map[recipe.id] = recipe;
    return map;
  }, {});
  
  let issues = 0;
  
  sortedDates.forEach((dateStr, index) => {
    const dayPlan = plan[dateStr];
    finalPlan[dateStr] = {};
    
    selectedMealTypes.forEach(mealType => {
      const items = dayPlan[mealType];
      
      if (!items || !Array.isArray(items)) {
        issues++;
        // Create an empty array
        finalPlan[dateStr][mealType] = [];
        return;
      }
      
      // Make sure it is a correct structer
      const validItems = items.filter(item => 
        item && item.recipeId && recipeMap[item.recipeId]
      ).map(item => {
        return {
          recipeId: item.recipeId,
          notes: ""
        };
      });
      
      if (validItems.length === 0) {
        issues++;
        finalPlan[dateStr][mealType] = [];
      } else {
        finalPlan[dateStr][mealType] = validItems;
      }
    });
  });
  
  if (issues > expectedDays * 3) {
    return null;
  }
  
  return finalPlan;
}

// Clean Groq response
function cleanGroqResponse(text) {
  if (!text) return '{}';
  
  let cleaned = text.trim();
  
  const codeBlockMatch = cleaned.match(/```(?:json)?\n([\s\S]*?)\n```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1];
  }
  
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  
  if (firstBrace === -1 || lastBrace === -1) {
    return '{}';
  }
  
  cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  
  cleaned = cleaned
    .replace(/'/g, '"')
    .replace(/\\"/g, '"')
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']')
    .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ');
  
  return cleaned;
}
export default router;