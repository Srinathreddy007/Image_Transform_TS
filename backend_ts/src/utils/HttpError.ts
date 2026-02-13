/**
 * Custom HTTP error class for typed error handling.
 *
 * Use this instead of `any` when throwing errors from route handlers.
 * The error middleware will catch it and send the appropriate response.
 */

export class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
    // Maintains proper stack trace for where our error was thrown 
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HttpError);
    }
  }
}
