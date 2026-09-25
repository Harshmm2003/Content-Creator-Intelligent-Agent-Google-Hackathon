import { ErrorCode, ErrorCodeType } from '../../shared/types';

export class AppError extends Error {
  public readonly code: ErrorCodeType;
  public readonly statusCode: number;
  public readonly details?: unknown;
  public readonly retryable: boolean;
  public readonly currentDocument?: unknown;

  constructor(opts: {
    code: ErrorCodeType;
    message: string;
    statusCode?: number;
    details?: unknown;
    retryable?: boolean;
    currentDocument?: unknown;
  }) {
    super(opts.message);
    this.name = 'AppError';
    this.code = opts.code;
    this.statusCode = opts.statusCode ?? AppError.defaultStatus(opts.code);
    this.details = opts.details;
    this.retryable = opts.retryable ?? false;
    this.currentDocument = opts.currentDocument;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  private static defaultStatus(code: ErrorCodeType): number {
    switch (code) {
      case ErrorCode.VALIDATION_ERROR:
        return 400;
      case ErrorCode.UNAUTHENTICATED:
        return 401;
      case ErrorCode.FORBIDDEN:
        return 403;
      case ErrorCode.NOT_FOUND:
        return 404;
      case ErrorCode.CONFLICT:
        return 409;
      case ErrorCode.UNPROCESSABLE:
        return 422;
      case ErrorCode.RATE_LIMITED:
      case ErrorCode.AI_RATE_LIMITED:
        return 429;
      case ErrorCode.UPSTREAM_ERROR:
        return 502;
      case ErrorCode.AI_UNAVAILABLE:
        return 503;
      case ErrorCode.AI_INVALID_OUTPUT:
      case ErrorCode.INTERNAL:
      default:
        return 500;
    }
  }

  static validation(message: string, details?: unknown) {
    return new AppError({
      code: ErrorCode.VALIDATION_ERROR,
      message,
      statusCode: 400,
      details,
    });
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError({
      code: ErrorCode.VALIDATION_ERROR,
      message,
      statusCode: 400,
      details,
    });
  }

  static unauthenticated(message = 'Authentication required') {
    return new AppError({
      code: ErrorCode.UNAUTHENTICATED,
      message,
      statusCode: 401,
    });
  }

  static forbidden(message = 'Access forbidden') {
    return new AppError({
      code: ErrorCode.FORBIDDEN,
      message,
      statusCode: 403,
    });
  }

  static notFound(message = 'Resource not found') {
    return new AppError({
      code: ErrorCode.NOT_FOUND,
      message,
      statusCode: 404,
    });
  }

  static conflict(message: string, currentDocument?: unknown) {
    return new AppError({
      code: ErrorCode.CONFLICT,
      message,
      statusCode: 409,
      currentDocument,
    });
  }

  static rateLimited(message = 'Rate limit exceeded. Please try again shortly.') {
    return new AppError({
      code: ErrorCode.RATE_LIMITED,
      message,
      statusCode: 429,
      retryable: true,
    });
  }

  static aiInvalidOutput(message: string, details?: unknown) {
    return new AppError({
      code: ErrorCode.AI_INVALID_OUTPUT,
      message,
      statusCode: 500,
      details,
    });
  }
}
