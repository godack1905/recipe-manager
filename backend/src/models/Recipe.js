import mongoose from "mongoose";

import { MESSAGE_CODES } from "../messages/messageCodes.js";

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
      required: [true, MESSAGE_CODES.RECIPE_TITLE_REQUIRED],
      trim: true,
      minlength: [3, MESSAGE_CODES.RECIPE_TITLE_TOO_SHORT],
      maxlength: [100, MESSAGE_CODES.RECIPE_TITLE_TOO_LONG]
    },
    imageUrl: {
      type: String,
      default: ""
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, MESSAGE_CODES.RECIPE_DESCRIPTION_TOO_LONG]
    },
    servings: {
      type: Number,
      default: 4,
      min: [1, MESSAGE_CODES.MINIMUM_SERVINGS],
    },
    prepTime: {
      type: Number, // in minutes
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
      enum: [MESSAGE_CODES.EASY, MESSAGE_CODES.MEDIUM, MESSAGE_CODES.HARD],
      default: MESSAGE_CODES.MEDIUM
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

// Virtual for id
RecipeSchema.virtual("id").get(function() {
  return this._id.toHexString();
});

// Make sure virtual fields are serialized
RecipeSchema.set('toJSON', { virtuals: true });
RecipeSchema.set('toObject', { virtuals: true });

RecipeSchema.index({ title: "text", description: "text", tags: "text" });
RecipeSchema.index({ createdBy: 1, createdAt: -1 });
RecipeSchema.index({ isPublic: 1, createdAt: -1 });

export default mongoose.model("Recipe", RecipeSchema);