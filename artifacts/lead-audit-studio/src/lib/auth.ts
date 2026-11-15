import { createInternalNeonAuth } from "@neon/auth";
import { BetterAuthReactAdapter } from "@neon/auth/react/adapters";

const authUrl = import.meta.env.VITE_NEON_AUTH_URL;

if (!authUrl) {
  throw new Error("Missing VITE_NEON_AUTH_URL in the app environment.");
}

// The React client type omits Neon Auth's JWT getter, so use the SDK wrapper that exposes it.
const neonAuth = createInternalNeonAuth(authUrl, {
  adapter: BetterAuthReactAdapter({
    fetchOptions: { credentials: "include" },
  }),
});

export const authClient = neonAuth.adapter;
export const getAuthToken = () => neonAuth.getJWTToken();
