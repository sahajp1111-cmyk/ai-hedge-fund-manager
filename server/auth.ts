import type { NextFunction, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { config } from "./config.js";

declare global {
  namespace Express {
    interface Request {
      auth?: { subject: string; claims: JWTPayload };
    }
  }
}

const jwks = config.OIDC_ISSUER
  ? createRemoteJWKSet(
      new URL(
        config.OIDC_JWKS_URI ??
          new URL(".well-known/jwks.json", config.OIDC_ISSUER).href,
      ),
    )
  : undefined;

function bearerToken(request: Request): string | null {
  const header = request.header("authorization");
  if (!header) return null;
  const [scheme, token, extra] = header.trim().split(/\s+/);
  return scheme?.toLowerCase() === "bearer" && token && !extra ? token : null;
}

export async function requireAuth(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  if (!config.authEnabled) {
    request.auth = {
      subject: "local-owner",
      claims: {
        scope: "research:read research:write portfolio:read portfolio:write",
      },
    };
    return next();
  }
  const token = bearerToken(request);
  if (!token)
    return response.status(401).json({
      error: "unauthorized",
      message: "A bearer access token is required.",
    });

  try {
    const { payload } = await jwtVerify(token, jwks!, {
      issuer: config.OIDC_ISSUER,
      audience: config.OIDC_AUDIENCE,
      algorithms: ["RS256", "ES256"],
      clockTolerance: 5,
    });
    if (!payload.sub)
      return response
        .status(401)
        .json({ error: "unauthorized", message: "Token has no subject." });
    if (config.OWNER_SUB && payload.sub !== config.OWNER_SUB)
      return response.status(403).json({ error: "owner_access_required" });
    request.auth = { subject: payload.sub, claims: payload };
    return next();
  } catch {
    return response.status(401).json({
      error: "unauthorized",
      message: "The access token is invalid or expired.",
    });
  }
}

export function requireScope(scope: string) {
  return (request: Request, response: Response, next: NextFunction) => {
    const raw = request.auth?.claims.scope;
    const scopes = typeof raw === "string" ? raw.split(" ") : [];
    if (!scopes.includes(scope))
      return response.status(403).json({
        error: "forbidden",
        message: `Missing required scope: ${scope}`,
      });
    return next();
  };
}
