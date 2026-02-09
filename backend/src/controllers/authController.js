import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

import { MESSAGE_CODES } from '../messages/messageCodes.js';
import { sendSuccess, throwApiError } from '../messages/responseHelper.js';
import { ApiError } from '../messages/ApiError.js';



export const register = async (req, res, next) => {
  const { username, email, password } = req.body;

  try {
    // Validation of required fields
    if (!username || !email || !password) {
      throwApiError(400, MESSAGE_CODES.MISSING_FIELDS);
    }

    // Verify if user or email already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      throwApiError(409, MESSAGE_CODES.EXISTING_USER);
    }

    // Hash password and create user
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      email,
      passwordHash: hash
    });

    return sendSuccess(res, MESSAGE_CODES.USER_CREATED, { userId: user.id }, 201);
  } catch (err) {
    if (err instanceof ApiError) 
      return next(err);

    console.error("Error in register:", err);
    throwApiError(500, MESSAGE_CODES.INTERNAL_ERROR, { originalMessage: err.message });
  }
};

export const login = async (req, res, next) => {
  const { email, password } = req.body;

  // Basic validation
  if (!email || !password) {
    throwApiError(400, MESSAGE_CODES.MISSING_FIELDS);
  }

  try {
    const user = await User.findOne({ email });
    if (!user) throwApiError(401, MESSAGE_CODES.AUTH_UNAUTHORIZED);

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throwApiError(401, MESSAGE_CODES.AUTH_UNAUTHORIZED);

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return sendSuccess(res, MESSAGE_CODES.LOGIN_SUCCESS, {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (err) {
    if (err instanceof ApiError) 
      return next(err);

    console.error("Error in login:", err);
    throwApiError(500, MESSAGE_CODES.INTERNAL_ERROR, { originalMessage: err.message });
  }
};