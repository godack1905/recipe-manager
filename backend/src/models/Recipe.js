import mongoose from "mongoose";

const IngredientSchema = new mongoose.Schema(
  {
    ingredient: {
      type: String,
      required: true,
      trim: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    unit: {
      type: String,
      required: true,
      trim: true
    },
    displayQuantity: {
      type: String,
      default: ""
    },
    displayUnit: {
      type: String,
      default: ""
    },
    isAbstract: {
      type: Boolean,
      default: false
    },
    abstractMeasure: {
      type: String,
      default: null
    },
    estimatedValue: {
      type: Number,
      default: 0
    }
  },
  { id: false }
);

const RecipeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "El título es requerido"],
      trim: true,
      minlength: [3, "El título debe tener al menos 3 caracteres"],
      maxlength: [100, "El título no puede exceder 100 caracteres"]
    },
    imageUrl: {
      type: String,
      default: ""
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "La descripción no puede exceder 500 caracteres"]
    },
    servings: {
      type: Number,
      default: 4,
      min: [1, "Las porciones deben ser al menos 1"]
    },
    prepTime: {
      type: Number, // minutos
      min: 0
    },
    ingredients: [IngredientSchema],
    steps: [
      {
        type: String,
        trim: true,
        required: true
      }
    ],
    tags: [{
      type: String,
      trim: true
    }],
    difficulty: {
      type: String,
      enum: ["Fácil", "Media", "Difícil"],
      default: "Media"
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    isPublic: {
      type: Boolean,
      default: false
    }
  }, 
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual para id
RecipeSchema.virtual("id").get(function() {
  return this._id.toHexString();
});

// Asegurar que el virtual se incluya en JSON
RecipeSchema.set('toJSON', { virtuals: true });
RecipeSchema.set('toObject', { virtuals: true });

RecipeSchema.index({ title: "text", description: "text", tags: "text" });
RecipeSchema.index({ createdBy: 1, createdAt: -1 });
RecipeSchema.index({ isPublic: 1, createdAt: -1 });

export default mongoose.model("Recipe", RecipeSchema);