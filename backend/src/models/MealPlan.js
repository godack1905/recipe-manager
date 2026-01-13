import mongoose from "mongoose";

const MealSchema = new mongoose.Schema(
  {
    recipe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recipe",
      required: [true, "La receta es requerida"]
    },
    people: {
      type: Number,
      default: 4,
      min: [1, "Debe haber al menos 1 persona"],
      max: [20, "No puede haber más de 20 personas"]
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [200, "Las notas no pueden exceder 200 caracteres"],
      default: ""
    }
  },
  { id: false }
);

const MealPlanSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    date: {
      type: Date,
      required: [true, "La fecha es requerida"],
      validate: {
        validator: function(v) {
          // Permitir fechas hasta 1 año en el futuro
          const maxDate = new Date();
          maxDate.setFullYear(maxDate.getFullYear() + 1);
          return v <= maxDate;
        },
        message: "La fecha no puede ser más de un año en el futuro"
      }
    },
    meals: {
      breakfast: MealSchema,
      snack: MealSchema,
      lunch: MealSchema,
      afternoonSnack: MealSchema,
      dinner: MealSchema
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Índice único por usuario y fecha
MealPlanSchema.index({ user: 1, date: 1 }, { unique: true });

// Índice para búsqueda por rango de fechas
MealPlanSchema.index({ user: 1, date: 1 });

// Virtual para día de la semana
MealPlanSchema.virtual("dayOfWeek").get(function() {
  const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  return days[this.date.getDay()];
});

// Virtual para formato de fecha legible
MealPlanSchema.virtual("formattedDate").get(function() {
  return this.date.toISOString().split('T')[0]; // YYYY-MM-DD
});

export default mongoose.model("MealPlan", MealPlanSchema);