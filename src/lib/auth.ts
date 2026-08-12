import type { MiddlewareHandler } from "hono";

export type AppVariables = {
  /** Null/anonymous when no Authorization header is present (Phase 1 default). */
  userId: string | null;
};

type AppEnv = {
  Bindings: Env;
  Variables: AppVariables;
};

/**
 * Optional auth hook for future login.
 * - Missing Authorization → anonymous (userId = null)
 * - Bearer JWT → use `sub` when present (verification comes later with real auth)
 * - Bearer opaque token → treat token as user id placeholder
 */
export function resolveUserIdFromAuthHeader(
  authorization: string | undefined | null,
): string | null {
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  if (!token) return null;

  // Soft-parse JWT shape so wiring Clerk/Auth0 later is a drop-in.
  const parts = token.split(".");
  if (parts.length === 3) {
    try {
      const payloadJson = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
      const payload = JSON.parse(payloadJson) as { sub?: unknown };
      if (payload.sub != null && String(payload.sub).trim()) {
        return String(payload.sub).trim();
      }
    } catch {
      // fall through to opaque token
    }
  }

  return token;
}

export const optionalAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const userId = resolveUserIdFromAuthHeader(c.req.header("Authorization"));
  c.set("userId", userId);
  await next();
};

export function dbUserId(userId: string | null | undefined): string {
  return userId?.trim() || "anonymous";
}
