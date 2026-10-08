import { isProduction } from "@/lib/cf";

// Test-only switches. All of them are off in production builds.

/** Lets you sign in with just a name, without Vipps Login. */
export function devLoginEnabled() {
  return !isProduction() && process.env.ALLOW_DEMO_LOGIN === "true";
}

/** Lets a band upload before its 49 kr band plan is paid. */
export function demoBandPlanEnabled() {
  return !isProduction() && process.env.ALLOW_DEMO_BAND_PLAN === "true";
}

/** Grants a fan membership without Vipps (for testing playback locally). */
export function demoMembershipEnabled() {
  return !isProduction() && process.env.ALLOW_DEMO_MEMBERSHIP === "true";
}
