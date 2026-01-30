export class ApiError extends Error {
  constructor(statusCode, errorCode, details = null) {
    super(errorCode);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}
