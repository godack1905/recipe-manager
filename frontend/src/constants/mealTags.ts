export const MEAL_TYPE_TAGS = [
  // Momentos del día
  'desayuno',
  'comida', 
  'merienda',
  'cena',
  
  // Tipos de plato (para combinar en comidas/cenas)
  'plato único',
  'primer plato',
  'segundo plato',
  'entrante',
  'postre',
  'acompañamiento',
  
  // Características
  'rápido',
  'fácil',
  'saludable',
  'vegetariano',
  'vegano',
  'económico',
  'especial',
  
  // Ingredientes principales
  'carne',
  'pollo',
  'pescado',
  'marisco',
  'verduras',
  'pasta',
  'arroz',
  'huevos',
  'legumbres',
  'queso',
  'fruta'
] as const;

export type MealTag = typeof MEAL_TYPE_TAGS[number];

// Grupos de tags para mostrar en categorías
export const TAG_CATEGORIES = {
  'Momento del día': ['desayuno', 'comida', 'merienda', 'cena'],
  'Tipo de plato': ['plato único', 'primer plato', 'segundo plato', 'entrante', 'postre', 'acompañamiento'],
  'Características': ['rápido', 'fácil', 'saludable', 'vegetariano', 'vegano', 'económico', 'especial'],
  'Ingredientes': ['carne', 'pollo', 'pescado', 'marisco', 'verduras', 'pasta', 'arroz', 'huevos', 'legumbres', 'queso', 'fruta']
} as const;

// Función para obtener sugerencias de tags basadas en el título
export function suggestTagsFromTitle(title: string): string[] {
  const titleLower = title.toLowerCase();
  const suggestions = new Set<string>();
  
  // Detectar momento del día
  if (titleLower.match(/(desayuno|tostada|yogur|cereal|avena|smoothie|batido)/)) {
    suggestions.add('desayuno');
    suggestions.add('rápido');
  }
  
  if (titleLower.match(/(almuerzo|comida|almorzar)/)) {
    suggestions.add('almuerzo');
  }
  
  if (titleLower.match(/(cena|cenar)/)) {
    suggestions.add('cena');
  }
  
  if (titleLower.match(/(merienda|snack|picar)/)) {
    suggestions.add('merienda');
  }
  
  // Detectar tipo de plato
  if (titleLower.match(/(plato único|plato principal|principal)/)) {
    suggestions.add('plato único');
  }
  
  if (titleLower.match(/(entrante|ensalada|sopa|crema|puré|caldo)/)) {
    suggestions.add('entrante');
    suggestions.add('primer plato');
  }
  
  if (titleLower.match(/(segundo|filete|chuleta|pescado|pollo|carne|guarnición)/)) {
    suggestions.add('segundo plato');
  }
  
  if (titleLower.match(/(postre|tarta|pastel|flan|helado|mousse|brownie)/)) {
    suggestions.add('postre');
  }
  
  // Detectar ingredientes
  if (titleLower.match(/(carne|ternera|cerdo|solomillo)/)) {
    suggestions.add('carne');
  }
  
  if (titleLower.match(/(pollo|pavo)/)) {
    suggestions.add('pollo');
  }
  
  if (titleLower.match(/(pescado|salmón|atún|merluza)/)) {
    suggestions.add('pescado');
  }
  
  if (titleLower.match(/(pasta|espagueti|macarrones)/)) {
    suggestions.add('pasta');
  }
  
  if (titleLower.match(/(arroz|paella|risotto)/)) {
    suggestions.add('arroz');
  }
  
  // Detectar características
  if (titleLower.match(/(rápido|express|fácil|sencillo)/)) {
    suggestions.add('rápido');
    suggestions.add('fácil');
  }
  
  if (titleLower.match(/(saludable|light|ensalada|verdura)/)) {
    suggestions.add('saludable');
  }
  
  // Limitar a máximo 5 sugerencias
  return Array.from(suggestions).slice(0, 5);
}

// Función para validar si un tag es válido
export function isValidTag(tag: string): boolean {
  return MEAL_TYPE_TAGS.includes(tag as MealTag);
}