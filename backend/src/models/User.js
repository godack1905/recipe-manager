import mongoose from "mongoose";

import { MESSAGE_CODES } from "../messages/messageCodes.js";

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, MESSAGE_CODES.USERNAME_REQUIRED],
      unique: true,
      trim: true,
      minlength: [3, MESSAGE_CODES.USERNAME_TOO_SHORT],
      maxlength: [30, MESSAGE_CODES.USERNAME_TOO_LONG]
    },
    email: {
      type: String,
      required: [true, MESSAGE_CODES.EMAIL_REQUIRED],
      unique: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, MESSAGE_CODES.INVALID_EMAIL]
    },
    passwordHash: {
      type: String,
      required: true
    },
    favorites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Recipe"
      }
    ],
    profileImage: {
      type: String,
      default: ""
    },
    bio: {
      type: String,
      maxlength: [200, MESSAGE_CODES.BIO_TOO_LONG],
      default: ""
    }
  },
  { timestamps: true }
);

// indexes for faster lookups
UserSchema.index({ username: 1 });
UserSchema.index({ email: 1 });

// Method to hide sensitive info when converting to JSON
UserSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

export default mongoose.model("User", UserSchema);