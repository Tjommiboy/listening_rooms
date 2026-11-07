import type { OrgInfo } from "@/lib/payout-rules";

// Brønnøysund's open register of organisations (Enhetsregisteret).
// Free, no key: https://data.brreg.no/enhetsregisteret/api/dokumentasjon/
// Used to check a band's organisation number before it applies to Vipps.

const BASE_URL = "https://data.brreg.no/enhetsregisteret/api";

type Lookup =
  | { found: true; org: OrgInfo }
  | { found: false }
  | { unavailable: true };

function name(person: unknown): string | null {
  const navn = (person as { navn?: Record<string, unknown> } | null)?.navn;
  if (!navn) return null;
  const parts = [navn.fornavn, navn.mellomnavn, navn.etternavn].filter(
    (part): part is string => typeof part === "string" && part.length > 0,
  );
  return parts.length ? parts.join(" ") : null;
}

/** The owner of a sole proprietorship, else the general manager, if listed. */
function ownerFrom(roles: unknown): string | null {
  const groups = (roles as { rollegrupper?: unknown[] } | null)?.rollegrupper;
  if (!Array.isArray(groups)) return null;
  for (const code of ["INNH", "DAGL"]) {
    for (const group of groups) {
      const list = (group as { roller?: unknown[] }).roller;
      if (!Array.isArray(list)) continue;
      for (const role of list) {
        const r = role as {
          type?: { kode?: string };
          fratraadt?: boolean;
          avregistrert?: boolean;
          person?: unknown;
        };
        if (r.type?.kode !== code || r.fratraadt || r.avregistrert) continue;
        const found = name(r.person);
        if (found) return found;
      }
    }
  }
  return null;
}

async function get(path: string) {
  return fetch(`${BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
}

/** Looks up an organisation number (9 digits, already validated). */
export async function lookupOrg(orgNumber: string): Promise<Lookup> {
  try {
    const response = await get(`/enheter/${orgNumber}`);
    if (response.status === 404 || response.status === 400)
      return { found: false };
    if (response.status === 410) {
      // Deleted from the register.
      return {
        found: true,
        org: {
          name: "",
          form: "",
          ownerName: null,
          deleted: true,
          bankrupt: false,
          windingUp: false,
        },
      };
    }
    if (!response.ok) return { unavailable: true };
    const data = (await response.json()) as Record<string, unknown>;
    let ownerName: string | null = null;
    const roles = await get(`/enheter/${orgNumber}/roller`).catch(() => null);
    if (roles?.ok) ownerName = ownerFrom(await roles.json().catch(() => null));
    return {
      found: true,
      org: {
        name: typeof data.navn === "string" ? data.navn : "",
        form:
          typeof (data.organisasjonsform as { kode?: unknown })?.kode ===
          "string"
            ? (data.organisasjonsform as { kode: string }).kode
            : "",
        ownerName,
        deleted: typeof data.slettedato === "string",
        bankrupt: data.konkurs === true,
        windingUp:
          data.underAvvikling === true ||
          data.underTvangsavviklingEllerTvangsopplosning === true,
      },
    };
  } catch {
    return { unavailable: true };
  }
}
