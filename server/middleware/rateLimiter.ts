import { Request, Response, NextFunction } from 'express';
import { CONFIG } from '../../shared/config';
import { AppError } from '../errors/AppError';

// In-memory sliding window rate limiter per user/ip
interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

export function rateLimiter(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  // Use user id if authenticated, else IP address
  const key = req.user?.uid || req.ip || 'global';
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = CONFIG.API_RATE_LIMIT_PER_MINUTE;

  const current = rateLimitStore.get(key);

  if (!current || now > current.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return next();
  }

  if (current.count >= maxRequests) {
    const retryAfter = Math.ceil((current.resetAt - now) / 1000);
    _res.setHeader('Retry-After', retryAfter);
    return next(
      AppError.rateLimited(
        `Too many requests. You have reached the limit of ${maxRequests} requests per minute. Try again in ${retryAfter}s.`
      )
    );
  }

  current.count++;
  next();
}
