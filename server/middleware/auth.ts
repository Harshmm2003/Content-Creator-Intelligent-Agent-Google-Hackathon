import { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import firebaseConfig from '../../firebase-applet-config.json';
import { AppError } from '../errors/AppError';

export interface AuthenticatedUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      requestId?: string;
    }
  }
}

const projectId = firebaseConfig.projectId;
const jwks = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

export async function authenticateToken(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(AppError.unauthenticated('Authorization header missing or not Bearer'));
    return;
  }

  const token = authHeader.split('Bearer ')[1].trim();
  if (!token) {
    next(AppError.unauthenticated('Token missing'));
    return;
  }

  // Support demo / mock test tokens in development or test runs
  if (process.env.DEMO_MODE === 'true' && token.startsWith('demo-token-')) {
    const demoEmail = token.replace('demo-token-', '') || 'demo@cciagent.dev';
    req.user = {
      uid: `demo-${demoEmail}`,
      email: demoEmail,
      displayName: 'Demo Marketer',
    };
    next();
    return;
  }

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });

    const uid = payload.sub as string;
    const email = (payload.email as string) || '';
    const displayName = (payload.name as string) || (email ? email.split('@')[0] : 'User');
    const photoURL = (payload.picture as string) || null;

    if (!uid || !email) {
      next(AppError.unauthenticated('Invalid token claims: uid and email required'));
      return;
    }

    req.user = {
      uid,
      email,
      displayName,
      photoURL,
    };
    next();
  } catch (err: unknown) {
    console.error(`[Auth] Failed to verify token for project ${projectId}:`, err);
    next(AppError.unauthenticated('Invalid or expired Firebase ID token'));
  }
}
