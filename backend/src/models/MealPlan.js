import mongoose from "mongoose";

import { MESSAGE_CODES } from '../messages/messageCodes.js';

const MealSchema = new mongoose.Schema(
  {
    recipe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recipe",
      required: [true, MESSAGE_CODES.RECIPE_NEEDED]
    },
    people: {
      type: Number,
      default: 4,
      min: [1, MESSAGE_CODES.MINIMUM_PEOPLE],
      max: [20, MESSAGE_CODES.MAX_PEOPLE]
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [200, MESSAGE_CODES.NOTES_TOO_LONG],
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
      required: [true, MESSAGE_CODES.DATE_REQUIRED],
      validate: {
        validator: function(v) {
          // Accept only dates from today to one year ahead
          const maxDate = new Date();
          maxDate.setFullYear(maxDate.getFullYear() + 1);
          return v <= maxDate;
        },
        message: MESSAGE_CODES.INVALID_DATE
      }
    },
    meals: {
      breakfast: [MealSchema],
      snack: [MealSchema],
      lunch: [MealSchema],
      afternoonSnack: [MealSchema],
      dinner: [MealSchema]
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Unique index to prevent duplicate meal plans for the same user and date
MealPlanSchema.index({ user: 1, date: 1 }, { unique: true });

// Single index to optimize queries by user and date
MealPlanSchema.index({ user: 1, date: 1 });

// Virtual for id
MealPlanSchema.virtual("id").get(function() {
  return this._id.toHexString();
});

// Virtual for day of the week
MealPlanSchema.virtual("dayOfWeek").get(function() {
  const days = [MESSAGE_CODES.SUNDAY, MESSAGE_CODES.MONDAY, MESSAGE_CODES.TUESDAY, MESSAGE_CODES.WEDNESDAY, MESSAGE_CODES.THURSDAY, MESSAGE_CODES.FRIDAY, MESSAGE_CODES.SATURDAY];
  return days[this.date.getDay()];
});

// Virtual for formatted date
MealPlanSchema.virtual("formattedDate").get(function() {
  return this.date.toISOString().split('T')[0]; // YYYY-MM-DD
});

export default mongoose.model("MealPlan", MealPlanSchema);