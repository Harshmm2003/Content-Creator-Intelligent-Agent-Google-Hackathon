import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from './AppError';
import { ApiErrorResponse, ErrorCode } from '../../shared/types';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const reqId = (req.headers['x-request-id'] as string) || 'req-unknown';

  if (err instanceof AppError) {
    const errorBody: ApiErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        retryable: err.retryable,
        currentDocument: err.currentDocument,
      },
    };
    console.error(`[${reqId}] AppError (${err.statusCode}): ${err.code} - ${err.message}`, err.details || '');
    res.status(err.statusCode).json(errorBody);
    return;
  }

  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const path = issue.path.join('.') || 'root';
      fieldErrors[path] = fieldErrors[path] || [];
      fieldErrors[path].push(issue.message);
    }

    const errorBody: ApiErrorResponse = {
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Invalid request data',
        details: fieldErrors,
      },
    };
    console.error(`[${reqId}] ZodValidationError:`, fieldErrors);
    res.status(400).json(errorBody);
    return;
  }

  // Unknown internal errors - Architecture Rule: generic message to user, full details to logs
  console.error(`[${reqId}] Internal Unhandled Error:`, err);
  const errorBody: ApiErrorResponse = {
    error: {
      code: ErrorCode.INTERNAL,
      message: 'An unexpected internal error occurred. Please try again.',
      retryable: true,
    },
  };
  res.status(500).json(errorBody);
}
