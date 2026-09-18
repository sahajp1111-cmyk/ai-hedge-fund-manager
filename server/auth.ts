import type { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { config } from './config.js';

declare global {
  namespace Express {
    interface Request { auth?: { subject: string; claims: JWTPayload } }
  }
}

const issuer = new URL(config.OIDC_ISSUER);
const jwks = createRemoteJWKSet(new URL('.well-known/jwks.json', issuer));

function bearerToken(request: Request): string | null {
  const header = request.header('authorization');
  if (!header) return null;
  const [scheme, token, extra] = header.trim().split(/\s+/);
  return scheme?.toLowerCase() === 'bearer' && token && !extra ? token : null;
}

export async function requireAuth(request: Request, response: Response, next: NextFunction) {
  const token = bearerToken(request);
  if (!token) return response.status(401).json({ error: 'unauthorized', message: 'A bearer access token is required.' });

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: config.OIDC_ISSUER,
      audience: config.OIDC_AUDIENCE,
      algorithms: ['RS256', 'ES256'],
      clockTolerance: 5,
    });
    if (!payload.sub) return response.status(401).json({ error: 'unauthorized', message: 'Token has no subject.' });
    request.auth = { subject: payload.sub, claims: payload };
    return next();
  } catch {
    return response.status(401).json({ error: 'unauthorized', message: 'The access token is invalid or expired.' });
  }
}

export function requireScope(scope: string) {
  return (request: Request, response: Response, next: NextFunction) => {
    const raw = request.auth?.claims.scope;
    const scopes = typeof raw === 'string' ? raw.split(' ') : [];
    if (!scopes.includes(scope)) return response.status(403).json({ error: 'forbidden', message: `Missing required scope: ${scope}` });
    return next();
  };
}
