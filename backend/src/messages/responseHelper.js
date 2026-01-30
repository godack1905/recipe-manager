import { ApiError } from './ApiError.js';

export const sendSuccess = (res, messageCode, data = {}, status = 200) => {
  return res.status(status).json({
    success: true,
    messageCode,
    data
  });
};

export const throwApiError = (statusCode, errorCode, details = null) => {
  throw new ApiError(statusCode, errorCode, details);
};
