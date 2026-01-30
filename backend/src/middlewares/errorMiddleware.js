import { ApiError } from '../messages/ApiError.js';
import { MESSAGE_CODES } from '../messages/messageCodes.js';

export const errorMiddleware = (err, req, res, next) => {
  console.error(err);

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      errorCode: err.errorCode,
      details: err.details,
    });
  }

  return res.status(500).json({
    success: false,
    errorCode: MESSAGE_CODES.INTERNAL_ERROR,
  });
};
