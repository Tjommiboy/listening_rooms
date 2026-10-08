/** Only allow same-site relative paths after login (no open redirects). */
export function safeNext(value: unknown, fallback = "/") {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\")
    ? value
    : fallback;
}

export function appOrigin(requestOrigin: string) {
  return process.env.NEXT_PUBLIC_APP_URL ?? requestOrigin;
}
