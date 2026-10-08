// Vipps Login (OpenID Connect) — lets fans and bands sign in with Vipps.
// Docs: https://developer.vippsmobilepay.com/docs/APIs/login-api/
// Uses the same client_id/client_secret as the payment APIs. The redirect URI
// (<APP_URL>/api/auth/vipps/callback) must be added in the Vipps portal.

const BASE_URL =
  process.env.VIPPS_ENV === "production"
    ? "https://api.vipps.no"
    : "https://apitest.vipps.no";

const DISCOVERY = `${BASE_URL}/access-management-1.0/access/.well-known/openid-configuration`;
export const VIPPS_LOGIN_SCOPES = "openid name phoneNumber email";

type Discovery = {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
};

let cached: Discovery | null = null;

async function discover(): Promise<Discovery> {
  if (cached) return cached;
  const response = await fetch(DISCOVERY);
  if (!response.ok)
    throw new Error(`Vipps Login discovery failed (${response.status}).`);
  cached = (await response.json()) as Discovery;
  return cached;
}

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} er ikke satt.`);
  return value;
}

export function vippsLoginConfigured() {
  return Boolean(
    process.env.VIPPS_CLIENT_ID && process.env.VIPPS_CLIENT_SECRET,
  );
}

export async function authorizationUrl(input: {
  redirectUri: string;
  state: string;
  nonce: string;
}) {
  const { authorization_endpoint } = await discover();
  const url = new URL(authorization_endpoint);
  url.search = new URLSearchParams({
    client_id: env("VIPPS_CLIENT_ID"),
    response_type: "code",
    scope: VIPPS_LOGIN_SCOPES,
    state: input.state,
    nonce: input.nonce,
    redirect_uri: input.redirectUri,
  }).toString();
  return url.toString();
}

export type VippsUserInfo = {
  sub: string;
  name?: string;
  phone_number?: string;
  email?: string;
};

/** Exchanges the authorization code and returns the user's Vipps profile. */
export async function exchangeCode(input: {
  code: string;
  redirectUri: string;
}): Promise<VippsUserInfo> {
  const { token_endpoint, userinfo_endpoint } = await discover();
  const basic = btoa(`${env("VIPPS_CLIENT_ID")}:${env("VIPPS_CLIENT_SECRET")}`);
  const tokenResponse = await fetch(token_endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
    }),
  });
  if (!tokenResponse.ok)
    throw new Error(`Vipps Login token failed (${tokenResponse.status}).`);
  const { access_token } = (await tokenResponse.json()) as {
    access_token: string;
  };
  // The profile comes straight from Vipps over TLS with our access token,
  // so it does not need separate id_token signature checks.
  const userResponse = await fetch(userinfo_endpoint, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!userResponse.ok)
    throw new Error(`Vipps Login userinfo failed (${userResponse.status}).`);
  const info = (await userResponse.json()) as VippsUserInfo;
  if (!info.sub) throw new Error("Vipps Login returnerte ingen bruker.");
  return info;
}
