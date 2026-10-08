"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/I18nProvider";

type State = "idle" | "loading" | "active" | "pending" | "error";

/**
 * Starts a Vipps agreement and checks it when the user comes back.
 * Fans: <SubscribeButton slug="..." />. Bands: <SubscribeButton plan />.
 */
export function SubscribeButton({
  slug,
  plan = false,
  signedIn,
  hasAccess,
  demoMembership = false,
  label,
}: {
  slug?: string;
  plan?: boolean;
  signedIn: boolean;
  hasAccess: boolean;
  demoMembership?: boolean;
  label?: string;
}) {
  const router = useRouter();
  const t = useT().subscribe;
  const [state, setState] = useState<State>(hasAccess ? "active" : "idle");
  const [message, setMessage] = useState("");
  const query = plan ? "plan=band" : `slug=${encodeURIComponent(slug ?? "")}`;

  // After approving in the Vipps app, the user lands back with ?vipps=retur.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("vipps") !== "retur")
      return;
    let cancelled = false;
    let tries = 0;
    const check = () => {
      fetch(`/api/vipps/status?${query}`)
        .then(
          (response) =>
            response.json() as Promise<{ status?: string; error?: string }>,
        )
        .then((data) => {
          if (cancelled) return;
          if (data.error) throw new Error(data.error);
          if (data.status === "ACTIVE") {
            setState("active");
            setMessage(t.welcome);
            router.refresh();
          } else if (data.status === "PENDING" && tries++ < 10) {
            setState("pending");
            setMessage(t.waiting);
            setTimeout(check, 2000);
          } else if (data.status === "PENDING") {
            setMessage(t.notYet);
          } else {
            setState("error");
            setMessage(t.rejected);
          }
        })
        .catch((error: Error) => {
          setState("error");
          setMessage(error.message);
        });
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [query, router, t]);

  async function post(url: string, body: unknown) {
    setState("loading");
    setMessage("");
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? t.generic);
      return data;
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : t.generic);
      return null;
    }
  }

  async function subscribe() {
    const data = await post(
      "/api/vipps/agreement",
      plan ? { plan: "band" } : { slug },
    );
    if (data?.url) window.location.assign(data.url);
  }

  async function demoJoin() {
    const data = await post("/api/demo/membership", { slug });
    if (data) {
      setState("active");
      router.refresh();
    }
  }

  if (!signedIn) {
    const next = plan ? "/studio" : `/room/${slug}`;
    return (
      <a
        href={`/logg-inn?next=${encodeURIComponent(next)}`}
        className="mt-6 block w-full bg-[#ff5b24] py-3 text-center font-bold text-white"
      >
        {t.loginToContinue}
      </a>
    );
  }

  return (
    <>
      <button
        onClick={subscribe}
        disabled={state === "loading" || state === "active"}
        className="mt-6 w-full bg-[#ff5b24] py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === "loading"
          ? t.opening
          : state === "active"
            ? plan
              ? t.planActive
              : t.member
            : (label ?? (plan ? t.orderPlan : t.join))}
      </button>
      {demoMembership && !plan && state !== "active" && (
        <button
          onClick={demoJoin}
          className="mt-3 w-full border border-dashed border-current/40 py-2 text-sm"
        >
          {t.demoJoin}
        </button>
      )}
      {message && (
        <p
          role="status"
          className={`mt-4 text-sm leading-relaxed ${state === "error" ? "text-red-700 dark:text-coral" : "opacity-80"}`}
        >
          {message}
        </p>
      )}
    </>
  );
}
