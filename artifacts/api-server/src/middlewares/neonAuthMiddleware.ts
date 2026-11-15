import { createRemoteJWKSet, errors, jwtVerify } from "jose";
import type { RequestHandler } from "express";
import { logger } from "../lib/logger";

const authBaseUrl = process.env.NEON_AUTH_BASE_URL;
const jwksUrl = process.env.NEON_AUTH_JWKS_URL;

if (!authBaseUrl || !jwksUrl) {
  throw new Error("NEON_AUTH_BASE_URL and NEON_AUTH_JWKS_URL must be set.");
}

const issuer = new URL(authBaseUrl).origin;
const jwks = createRemoteJWKSet(new URL(jwksUrl));

export const requireNeonAuth: RequestHandler = async (req, res, next) => {
  const authorization = req.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    res.status(401).json({ error: "Sign in to access lead records." });
    return;
  }

  let ownerId: string;
  try {
    const { payload } = await jwtVerify(match[1], jwks, {
      algorithms: ["EdDSA"],
      issuer,
      audience: issuer,
    });
    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      res.status(401).json({ error: "Sign in to access lead records." });
      return;
    }
    ownerId = payload.sub;
  } catch (error) {
    if (error instanceof errors.JOSEError) {
      logger.warn(
        { event: "invalid_auth_token", reason: error.code },
        "Rejected a request with an invalid Neon Auth token",
      );
      res.status(401).json({ error: "Sign in to access lead records." });
      return;
    }
    logger.error(
      {
        event: "auth_token_verification_failed",
        errorType: error instanceof Error ? error.name : "UnknownError",
      },
      "Could not verify a Neon Auth token",
    );
    res.status(503).json({ error: "Authentication service is unavailable." });
    return;
  }

  res.locals.ownerId = ownerId;
  next();
};
