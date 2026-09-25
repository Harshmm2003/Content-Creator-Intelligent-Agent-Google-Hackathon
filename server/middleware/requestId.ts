import { Request, Response, NextFunction } from 'express';

let reqCounter = 0;

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const incomingId = req.headers['x-request-id'] as string;
  const requestId = incomingId || `req-${Date.now()}-${++reqCounter}`;
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}
