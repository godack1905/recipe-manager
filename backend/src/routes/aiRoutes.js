import express from 'express';
import axios from 'axios';

import { MESSAGE_CODES } from '../messages/messageCodes.js';
import { sendSuccess, throwApiError } from '../messages/responseHelper.js';

const router = express.Router();

// Principal endpoint with GROQ API integration
router.post('/generate-meal-plan', async (req, res) => {
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
      if (!aiPlan || Object.keys(aiPlan).length === 0) {
        throwApiError(500, MESSAGE_CODES.MEALPLAN_GENERATION_FAILED);
      }
      return sendSuccess(res, MESSAGE_CODES.MEALPLAN_GENERATED, { mealPlan: aiPlan, source: 'groq' }, 201);
    }

    // If GROQ fails, fallback to smart algorithm
    const smartPlan = generateSmartAlgorithmPlan(favoriteRecipes, preferences, selectedMealTypes);
    if (!smartPlan || Object.keys(smartPlan).length === 0) {
      throwApiError(500, MESSAGE_CODES.MEALPLAN_GENERATION_FAILED);
    }
    return sendSuccess(res, MESSAGE_CODES.MEALPLAN_GENERATED, { mealPlan: smartPlan, source: 'algorithm' }, 201);
    
  } catch (error) {
    
    // Emergency fallback: simple algorithm
    try {
      const { favoriteRecipes, preferences, selectedMealTypes } = req.body;
      const fallbackPlan = generateSimpleFallback(favoriteRecipes, preferences, selectedMealTypes);
      if (!fallbackPlan || Object.keys(fallbackPlan).length === 0) {
        throwApiError(500, MESSAGE_CODES.MEALPLAN_GENERATION_FAILED);
      }
      return sendSuccess(res, MESSAGE_CODES.MEALPLAN_GENERATED, { mealPlan: fallbackPlan, source: 'fallback' }, 201);
    } catch (err) {
      next(err);
    }
  }
});

// Generate meal plan using GROQ API
async function generateWithGroq(recipes, preferences, selectedMealTypes) {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  
  // Verify API key
  if (!GROQ_API_KEY) {
    return null;
  }
  
  try {
    // Create meal plan in batches if duration is long
    const totalDays = preferences.duration;
    const batchSize = 7; // Generate one week at a time
    const allPlans = {};
    
    for (let batchStart = 0; batchStart < totalDays; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, totalDays);
      const batchDays = batchEnd - batchStart;
            
      const batchPrompt = buildStructuredGroqPrompt(recipes, {
        ...preferences,
        duration: batchDays
      }, selectedMealTypes, batchStart);
      
      const batchPlan = await callGroqWithRetry(batchPrompt, recipes, selectedMealTypes);
      
      if (!batchPlan) {
        return null;
      }
      
      // Merge batch plan into overall plan
      Object.assign(allPlans, batchPlan);
      
      // Small delay between batches to avoid rate limits
      if (batchEnd < totalDays) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Final validation of complete plan
    const validatedPlan = validateCompletePlan(allPlans, recipes, selectedMealTypes, preferences.duration);
    
    if (validatedPlan && Object.keys(validatedPlan).length === preferences.duration) {
      return validatedPlan;
    }
    
    return null;
    
  } catch (error) {
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
      breakfast: "SOLO recetas con tag 'desayuno'",
      lunch: "Solo recetas con tag 'comida' y tiene que ser o 1 receta con tag 'plato único' O 2 recetas: una con 'primer plato' y otra con 'segundo plato'",
      dinner: "Solo recetas con tag 'cena' y tiene que ser o 1 receta con tag 'plato único' O 2 recetas: una con 'primer plato' y otra con 'segundo plato'",
      snack: "SOLO recetas con tag 'merienda'"
    };
    return `• ${type}: ${rules[type] || "1 receta apropiada"}`;
  }).join('\n');
  
  // Obtener traducciones amigables para los tipos de comida
  const mealTranslations = {
    breakfast: "Desayuno",
    lunch: "Comida/Almuerzo", 
    dinner: "Cena",
    snack: "Tentempié",
    afternoonSnack: "Merienda"
  };
  
  const selectedMealsText = selectedMealTypes.map(type => 
    `${type} (${mealTranslations[type] || type})`
  ).join(', ');
  
  return `GENERA UN PLAN DE COMIDAS en formato JSON estricto. Sigue EXACTAMENTE estas reglas:

## INFORMACIÓN BÁSICA
- Días a planificar: ${preferences.duration} (${dates.join(', ')})
- Personas: ${preferences.people}
- Tiempo máximo de preparación: ${preferences.maxPrepTime || 60} minutos
- Comidas por día: ${selectedMealsText}

## ESTRUCTURA OBLIGATORIA POR DÍA (basada en TAGS):
${mealStructure}

## REGLAS ABSOLUTAS (NO IGNORAR NINGUNA):
1. Para LUNCH y DINNER: 
   - OPCIÓN A: 1 receta con tag "plato único" (solo 1 receta)
   - OPCIÓN B: 2 recetas - UNA con tag "primer plato" y OTRA con tag "segundo plato"

2. COMBINACIONES PROHIBIDAS EN COMIDAS Y CENAS(NUNCA usar):
   - 1 sola receta con tag 'primer plato'
   - 1 sola receta con tag 'segundo plato'  
   - 2 recetas con tag 'primer plato'
   - 2 recetas con tag 'segundo plato'
   - 2 recetas con tag 'plato único'
   - Mezclar receta con tag 'plato único' con recetas con tags 'primer plato' o 'segundo plato'

3. USO CORRECTO DE TAGS (OBLIGATORIO):
   - Tag "especial" → SOLO fines de semana
   - Tag "desayuno" → SOLO para breakfast
   - Tag "comida" → SOLO para lunch
   - Tag "cena" → SOLO para dinner
   - Tag "merienda" → SOLO para snack/afternoonSnack
   - Tag "plato único" → Para lunch o dinner, como ÚNICA receta
   - Tag "primer plato" → Para lunch o dinner, COMBINADO con un segundo plato
   - Tag "segundo plato" → Para lunch o dinner, COMBINADO con un primer plato

4. VARIEDAD NUTRICIONAL:
   - Varía ingredientes: no repetir la misma proteína o verdura 2 días seguidos, tampoco el mismo día (por ejemplo no recetas con patatas dos veces en un día)
   - Balance: incluye proteínas, verduras, carbohidratos
   - Fines de semana: puedes usar tags "especial" (solo puedes usarlas los fines de semana, pero si no hay disponibles, usa otras)

## RECETAS DISPONIBLES (${recipes.length}) CLASIFICADAS POR TAGS:

### 1. PARA DESAYUNO (breakfast) - tags: desayuno:
${categorizedRecipes.breakfast.map(r => formatRecipeForPrompt(r)).join('\n') || 'NINGUNA DISPONIBLE'}

### 2. PARA COMIDA (lunch)  - tags: comida:
${categorizedRecipes.lunch.map(r => formatRecipeForPrompt(r)).join('\n') || 'NINGUNA DISPONIBLE'}

### 3. PARA CENA (dinner) - tags: cena:
${categorizedRecipes.dinner.map(r => formatRecipeForPrompt(r)).join('\n') || 'NINGUNA DISPONIBLE'}

### 4. PARA MERIENDA (snack) - tags: merienda:
${categorizedRecipes.snacks.map(r => formatRecipeForPrompt(r)).join('\n') || 'NINGUNA DISPONIBLE'}

## EJEMPLOS CORRECTOS DE ESTRUCTURA:

### Ejemplo 1: Comida con 2 platos (primer plato + segundo plato)
"2026-01-29": {
  "lunch": [
    {"recipeId": "ID1", "notes": "Primer plato: Ensalada de tomate y queso"},
    {"recipeId": "ID2", "notes": "Segundo plato: Pollo al horno con patatas"}
  ]
}

### Ejemplo 2: Comida con plato único
"2026-01-30": {
  "lunch": [
    {"recipeId": "ID3", "notes": "Plato único: Paella de verduras"}
  ]
}

### Ejemplo 3: Cena con 2 platos
"2026-01-29": {
  "dinner": [
    {"recipeId": "ID4", "notes": "Primer plato: Crema de calabacín"},
    {"recipeId": "ID5", "notes": "Segundo plato: Pollo al limón"}
  ]
}

## FORMATO DE SALIDA EXACTO:
{
  "YYYY-MM-DD": {
    "mealType": [
      {"recipeId": "ID_RECETA", "notes": "Descripción apropiada (puede estar vacía)"}
    ]
  }
}

## GENERA EL PLAN PARA ${preferences.duration} DÍAS:
${dates.join(', ')}

IMPORTANTE FINAL:
• Cada día DEBE tener ${selectedMealTypes.length} tipos de comida: ${selectedMealTypes.join(', ')}
• Para lunch/dinner: O 1 receta (plato único) O 2 recetas (primer plato + segundo plato)
• Respeta estrictamente los tags de cada receta
• No inventes recetas, usa SOLO las proporcionadas

RESPUESTA: ÚNICAMENTE el objeto JSON, sin texto adicional, sin explicaciones.`;
}

// FORMATO DE RECETA PARA EL PROMPT
function formatRecipeForPrompt(recipe) {
  const tags = recipe.tags || [];
  const cookingTime = recipe.cookingTime || 'no especificado';
  const ingredients = recipe.ingredients ? 
    recipe.ingredients.slice(0, 3).map(i => i.name || i).join(', ') + 
    (recipe.ingredients.length > 3 ? '...' : '') : 
    'no especificados';
  
  return `  • ID: "${recipe.id}" - "${recipe.title}" 
    Tags: ${tags.join(', ') || 'sin tags'}
    Tiempo: ${cookingTime} min | Ingredientes: ${ingredients}`;
}

// CATEGORIZAR RECETAS POR TAGS ESPECÍFICOS
function categorizeRecipesByTags(recipes) {
  const categorized = {
    breakfast: [],   // desayuno
    lunch: [],       // comida
    dinner: [],      // cena
    snacks: [],      // merienda
    unique: [],      // plato único
    starters: [],    // primer plato, entrante
    seconds: [],     // segundo plato
    desserts: [],    // postre
    sides: [],       // acompañamiento
    quick: [],       // rápido, fácil
    healthy: [],     // saludable
    vegetarian: [],  // vegetariano
    vegan: [],       // vegano
    cheap: [],       // económico
    special: []      // especial
  };
  
  recipes.forEach(recipe => {
    const tags = (recipe.tags || []).map(t => t.toLowerCase());
    
    // Categorizar por momento del día
    if (tags.includes('desayuno')) categorized.breakfast.push(recipe);
    if (tags.includes('comida')) categorized.lunch.push(recipe);
    if (tags.includes('cena')) categorized.dinner.push(recipe);
    if (tags.includes('merienda')) categorized.snacks.push(recipe);
    
    // Categorizar por tipo de plato
    if (tags.includes('plato único')) categorized.unique.push(recipe);
    if (tags.includes('primer plato') || tags.includes('entrante')) categorized.starters.push(recipe);
    if (tags.includes('segundo plato')) categorized.seconds.push(recipe);
    if (tags.includes('postre')) categorized.desserts.push(recipe);
    if (tags.includes('acompañamiento')) categorized.sides.push(recipe);
    
    // Categorizar por características
    if (tags.includes('rápido') || tags.includes('fácil')) categorized.quick.push(recipe);
    if (tags.includes('saludable')) categorized.healthy.push(recipe);
    if (tags.includes('vegetariano')) categorized.vegetarian.push(recipe);
    if (tags.includes('vegano')) categorized.vegan.push(recipe);
    if (tags.includes('económico')) categorized.cheap.push(recipe);
    if (tags.includes('especial')) categorized.special.push(recipe);
    
    // Si no tiene tags específicos de momento, asignar por defecto
    const hasMealTag = tags.some(t => 
      ['desayuno', 'comida', 'cena', 'merienda'].includes(t)
    );
    
    if (!hasMealTag) {
      // Asignar por tipo de plato o características
      if (tags.includes('plato único') || tags.includes('segundo plato')) {
        categorized.lunch.push(recipe);
      } else if (tags.includes('primer plato') || tags.includes('entrante')) {
        categorized.lunch.push(recipe);
      } else if (tags.includes('rápido') || tags.includes('fácil')) {
        categorized.quick.push(recipe);
      } else {
        // Por defecto, asignar a lunch
        categorized.lunch.push(recipe);
      }
    }
  });
  
  // Para cada categoría, si está vacía, añadir algunas recetas por defecto
  const essentialCategories = ['breakfast', 'lunch', 'dinner', 'unique', 'starters', 'seconds', 'snacks'];
  essentialCategories.forEach(category => {
    if (categorized[category].length === 0) {
      // Añadir hasta 5 recetas que podrían servir para esta categoría
      const suitableRecipes = recipes.filter(recipe => {
        if (category === 'breakfast') return true; // Cualquier receta puede ser desayuno
        if (category === 'snacks') return true;    // Cualquier receta puede ser merienda
        if (category === 'unique') return true;    // Cualquier receta puede ser plato único
        return true;
      }).slice(0, 5);
      
      categorized[category] = suitableRecipes;
    }
  });
  
  return categorized;
}

// PARSEAR Y VALIDAR LOTE
function parseAndValidateBatch(text, recipes, selectedMealTypes) {
  try {
    const cleanedText = cleanGroqResponse(text);
    if (!cleanedText || cleanedText === '{}') return null;
    
    const parsed = JSON.parse(cleanedText);
    return validateBatchPlan(parsed, recipes, selectedMealTypes);
    
  } catch (error) {
    console.error('❌ Error parseando lote:', error.message);
    return null;
  }
}

// VALIDAR LOTE CON REGLAS ESTRICTAS BASADAS EN TAGS
function validateBatchPlan(plan, recipes, selectedMealTypes) {
  if (!plan || typeof plan !== 'object') return null;
  
  const validPlan = {};
  const recipeMap = recipes.reduce((map, recipe) => {
    map[recipe.id] = recipe;
    return map;
  }, {});
  
  let validDays = 0;
  
  Object.entries(plan).forEach(([dateStr, dayPlan]) => {
    // Validar fecha
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return;
    
    if (!dayPlan || typeof dayPlan !== 'object') return;
    
    // Verificar que tiene TODAS las comidas solicitadas
    const hasAllMeals = selectedMealTypes.every(mealType => 
      dayPlan[mealType] && Array.isArray(dayPlan[mealType]) && dayPlan[mealType].length > 0
    );
    
    if (!hasAllMeals) {
      console.log(`⚠️ ${dateStr}: Faltan tipos de comida`);
      return;
    }
    
    // Validar estructura de cada comida
    let isValidDay = true;
    const validatedDay = {};
    
    selectedMealTypes.forEach(mealType => {
      const items = dayPlan[mealType];
      if (!Array.isArray(items)) {
        isValidDay = false;
        return;
      }
      
      // Validar cada item
      const validItems = items.filter(item => {
        if (!item || !item.recipeId) return false;
        if (!recipeMap[item.recipeId]) return false;
        
        const recipe = recipeMap[item.recipeId];
        const tags = (recipe.tags || []).map(t => t.toLowerCase());
        
        // Validar tags según el tipo de comida
        if (mealType === 'breakfast' && !tags.includes('desayuno')) {
          console.log(`⚠️ ${dateStr} breakfast: Receta ${recipe.id} no tiene tag 'desayuno'`);
          // No invalidamos, solo advertimos
        }
        
        if (mealType === 'lunch' || mealType === 'dinner') {
          // Verificar estructura de plato único vs primer+segundo
          if (items.length === 1 && !tags.includes('plato único')) {
            console.log(`⚠️ ${dateStr} ${mealType}: Plato único debería tener tag 'plato único'`);
          }
          
          if (items.length === 2) {
            const isFirstPlate = tags.includes('primer plato') || tags.includes('entrante');
            const isSecondPlate = tags.includes('segundo plato');
            const isUnique = tags.includes('plato único');
            
            if (isUnique) {
              console.log(`⚠️ ${dateStr} ${mealType}: Plato único no debe combinarse con otros`);
            }
          }
        }
        
        if (mealType === 'snack' || mealType === 'afternoonSnack') {
          if (!tags.includes('merienda')) {
            // No invalidamos, solo advertimos
          }
        }
        
        return true;
      });
      
      if (validItems.length === 0) {
        isValidDay = false;
        return;
      }
      
      // Validar estructura para lunch/dinner
      if (mealType === 'lunch' || mealType === 'dinner') {
        if (validItems.length !== 1 && validItems.length !== 2) {
          console.log(`⚠️ ${dateStr} ${mealType}: Debe tener 1 o 2 recetas, tiene ${validItems.length}`);
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
  
  console.log(`📊 Lote validado: ${validDays} días correctos`);
  return validDays > 0 ? validPlan : null;
}

// VALIDACIÓN COMPLETA FINAL
function validateCompletePlan(plan, recipes, selectedMealTypes, expectedDays) {
  if (!plan || Object.keys(plan).length !== expectedDays) {
    console.log(`❌ Plan incompleto: esperados ${expectedDays} días, obtenidos ${Object.keys(plan).length}`);
    return null;
  }
  
  // Ordenar fechas
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
        console.log(`⚠️ ${dateStr}: ${mealType} no es array`);
        issues++;
        // Crear array vacío para reparar
        finalPlan[dateStr][mealType] = [];
        return;
      }
      
      // Asegurar estructura correcta
      const validItems = items.filter(item => 
        item && item.recipeId && recipeMap[item.recipeId]
      ).map(item => {
        const recipe = recipeMap[item.recipeId];
        
        // Generar nota inteligente basada en tags
        let note = item.notes;
        if (!note) {
          const tags = recipe.tags || [];
          if (mealType === 'lunch' || mealType === 'dinner') {
            if (tags.includes('plato único')) {
              note = `Plato único: ${recipe.title.substring(0, 25)}`;
            } else if (tags.includes('primer plato') || tags.includes('entrante')) {
              note = `Primer plato: ${recipe.title.substring(0, 25)}`;
            } else if (tags.includes('segundo plato')) {
              note = `Segundo plato: ${recipe.title.substring(0, 25)}`;
            } else {
              note = `${mealType === 'lunch' ? 'Almuerzo' : 'Cena'}: ${recipe.title.substring(0, 25)}`;
            }
          } else {
            note = `${mealType === 'breakfast' ? 'Desayuno' : 
                    mealType === 'dinner' ? 'Cena' : 
                    mealType === 'snack' ? 'Merienda' : 'Tentempié'}: ${recipe.title.substring(0, 25)}`;
          }
        }
        
        return {
          recipeId: item.recipeId,
          notes: note
        };
      });
      
      if (validItems.length === 0) {
        console.log(`⚠️ ${dateStr}: ${mealType} sin recetas válidas`);
        issues++;
        finalPlan[dateStr][mealType] = [];
      } else {
        // Para lunch/dinner: reparar estructura si es necesario
        if ((mealType === 'lunch' || mealType === 'dinner') && validItems.length > 2) {
          console.log(`🔧 ${dateStr}: ${mealType} tiene ${validItems.length} recetas, reduciendo a 2`);
          validItems.splice(2); // Mantener solo las primeras 2
        }
        
        finalPlan[dateStr][mealType] = validItems;
      }
    });
  });
  
  if (issues > expectedDays * 3) {
    console.log(`❌ Demasiados problemas: ${issues} issues`);
    return null;
  }
  
  console.log(`✅ Plan final validado: ${Object.keys(finalPlan).length} días, ${issues} issues reparados`);
  return finalPlan;
}

// LIMPIAR RESPUESTA DE GROQ
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

// ALGORITMO INTELIGENTE (sin IA) - OPTIMIZADO CON TAGS
function generateSmartAlgorithmPlan(recipes, preferences, selectedMealTypes) {
  console.log('🧠 Usando algoritmo inteligente mejorado...');
  
  const plan = {};
  const today = new Date();
  
  // Clasificar recetas por tags
  const categorized = categorizeRecipesByTags(recipes);
  
  // Mezclar cada categoría
  Object.values(categorized).forEach(arr => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  });
  
  // Generar plan
  for (let day = 0; day < preferences.duration; day++) {
    const date = new Date(today);
    date.setDate(date.getDate() + day);
    const dateStr = date.toISOString().split('T')[0];
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const isWeekday = !isWeekend;
    
    plan[dateStr] = {};
    
    selectedMealTypes.forEach((mealType, index) => {
      let recipePool = [];
      let notesPrefix = '';
      
      switch(mealType) {
        case 'breakfast':
          recipePool = categorized.breakfast.length > 0 ? categorized.breakfast : 
                      categorized.quick.length > 0 ? categorized.quick : recipes;
          notesPrefix = 'Desayuno';
          break;
          
        case 'lunch':
          // Alternar entre plato único y menú completo
          const useUnique = day % 3 === 0; // Cada 3 días, plato único
          
          if (useUnique) {
            recipePool = categorized.unique.length > 0 ? categorized.unique : 
                        categorized.lunch.length > 0 ? categorized.lunch : recipes;
            notesPrefix = 'Plato único';
          } else {
            // Para menú completo, necesitamos starter + second
            // Esto se maneja de forma especial
            recipePool = categorized.lunch.length > 0 ? categorized.lunch : recipes;
            notesPrefix = 'Menú completo';
          }
          break;
          
        case 'dinner':
          recipePool = categorized.dinner.length > 0 ? categorized.dinner : 
                      (isWeekday ? categorized.quick : categorized.special).length > 0 ? 
                      (isWeekday ? categorized.quick : categorized.special) : recipes;
          notesPrefix = 'Cena';
          break;
          
        case 'snack':
        case 'afternoonSnack':
          recipePool = categorized.snacks.length > 0 ? categorized.snacks : 
                      categorized.breakfast.length > 0 ? categorized.breakfast : 
                      categorized.quick.length > 0 ? categorized.quick : recipes;
          notesPrefix = mealType === 'snack' ? 'Merienda' : 'Tentempié';
          break;
          
        default:
          recipePool = recipes;
          notesPrefix = mealType;
      }
      
      if (recipePool.length === 0) {
        recipePool = recipes;
      }
      
      // Selección inteligente evitando repeticiones
      const recipeIndex = (day * selectedMealTypes.length + index) % recipePool.length;
      const recipe = recipePool[recipeIndex];
      
      if (recipe) {
        // Para lunch con menú completo (primer+segundo)
        if (mealType === 'lunch' && notesPrefix === 'Menú completo') {
          const starter = categorized.starters.length > 0 ? 
                         categorized.starters[day % categorized.starters.length] : 
                         recipe;
          const second = categorized.seconds.length > 0 ? 
                        categorized.seconds[(day + 1) % categorized.seconds.length] : 
                        recipe;
          
          plan[dateStr][mealType] = [
            {
              recipeId: starter.id,
              notes: `Primer plato: ${starter.title.substring(0, 20)}`
            },
            {
              recipeId: second.id,
              notes: `Segundo plato: ${second.title.substring(0, 20)}`
            }
          ];
        } else {
          plan[dateStr][mealType] = [{
            recipeId: recipe.id,
            notes: `${notesPrefix}: ${recipe.title.substring(0, 25)} (día ${day + 1})`
          }];
        }
      }
    });
  }
  
  console.log('📊 Plan algoritmo:', Object.keys(plan).length, 'días');
  return plan;
}

// FALLBACK SIMPLE
function generateSimpleFallback(recipes, preferences, selectedMealTypes) {
  const plan = {};
  const today = new Date();
  
  const shuffled = [...recipes].sort(() => Math.random() - 0.5);
  
  for (let day = 0; day < preferences.duration; day++) {
    const date = new Date(today);
    date.setDate(date.getDate() + day);
    const dateStr = date.toISOString().split('T')[0];
    
    plan[dateStr] = {};
    
    selectedMealTypes.forEach((mealType, index) => {
      const recipeIndex = (day * selectedMealTypes.length + index) % shuffled.length;
      const recipe = shuffled[recipeIndex];
      
      if (recipe) {
        plan[dateStr][mealType] = [{
          recipeId: recipe.id,
          notes: `${mealType} día ${day + 1}`
        }];
      }
    });
  }
  
  return plan;
}

export default router;