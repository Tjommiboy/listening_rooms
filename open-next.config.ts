import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// All pages that touch the database are rendered per request, so no
// incremental cache is configured.
export default defineCloudflareConfig({});
