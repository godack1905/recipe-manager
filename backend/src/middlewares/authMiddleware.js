import jwt from "jsonwebtoken";
import User from "../models/User.js";
import dotenv from "dotenv";
dotenv.config();

import { MESSAGE_CODES } from '../messages/messageCodes.js';
import { throwApiError } from '../messages/responseHelper.js';
import { ApiError } from '../messages/ApiError.js';

export const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throwApiError(401, MESSAGE_CODES.MISSING_TOKEN);
    }

    const token = authHeader.split(" ")[1];
    
    if (!token) {
      throwApiError(401, MESSAGE_CODES.INVALID_TOKEN);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findById(decoded.id).select("-passwordHash");
    
    if (!user) {
      throwApiError(401, MESSAGE_CODES.AUTH_UNAUTHORIZED);
    }

    req.user = user;
    next();
  } catch (err) {
    if (err instanceof ApiError) 
          return next(err);
    
    if (err.name === "JsonWebTokenError") {
      throwApiError(401, MESSAGE_CODES.INVALID_TOKEN);
    }
    
    if (err.name === "TokenExpiredError") {
      throwApiError(401, MESSAGE_CODES.EXPIRED_TOKEN);
    }
    
    throwApiError(500, MESSAGE_CODES.INTERNAL_ERROR, { originalMessage: err.message });
  }
};