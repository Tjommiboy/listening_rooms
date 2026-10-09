import { devLoginEnabled } from "@/lib/demo";
import type { User } from "@/lib/session";

/**
 * Platform admins (can download the TONO report for all bands).
 * Set ADMIN_USER_IDS to a comma-separated list of user ids. Locally, with
 * test login switched on, every signed-in user counts as admin.
 */
export function isAdmin(user: User | null) {
  if (!user) return false;
  if (devLoginEnabled()) return true;
  const ids = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return ids.includes(user.id);
}
