import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {};

export default nextConfig;

// Gives `next dev` local D1 and R2 bindings (stored under .wrangler/state),
// so the whole flow works on your machine without a Cloudflare account.
initOpenNextCloudflareForDev();
