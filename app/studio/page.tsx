"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import {
  ARTIST_PLAN_PRICE_KR,
  ARTIST_STORAGE_GB,
  PLATFORM_FEE_PERCENT,
} from "@/lib/pricing";
import { SAMPLE_ROOM_SLUG } from "@/lib/rooms";

// Demo only: remembers the test connected account in this browser so repeated
// clicks resume onboarding instead of creating a new Stripe account each time.
// In production this mapping belongs in the database, keyed by the signed-in artist.
const ACCOUNT_STORAGE_KEY = "listening-rooms:demo-stripe-account";

function readStoredAccount() {
  try {
    return window.localStorage.getItem(ACCOUNT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeAccount(account: string) {
  try {
    window.localStorage.setItem(ACCOUNT_STORAGE_KEY, account);
  } catch {
    // Storage unavailable (private mode); onboarding still works, it just won't resume.
  }
}

export default function StudioPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [connectState, setConnectState] = useState<
    "idle" | "loading" | "ready" | "pending" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("stripe_account");
    if (fromUrl?.startsWith("acct_")) storeAccount(fromUrl);
    // Only check status after returning from Stripe; a refresh means the link expired.
    if (params.get("connect") !== "return") return;
    const account = readStoredAccount();
    if (!account) return;
    fetch(`/api/connect/status?account=${encodeURIComponent(account)}`)
      .then((response) => response.json())
      .then(
        (data: {
          chargesEnabled?: boolean;
          payoutsEnabled?: boolean;
          error?: string;
        }) => {
          if (data.error) throw new Error(data.error);
          if (data.chargesEnabled && data.payoutsEnabled) {
            setConnectState("ready");
            setMessage(
              "Stripe payouts are connected. Your room can accept paid members once subscriptions are enabled.",
            );
          } else {
            setConnectState("pending");
            setMessage(
              "Stripe is reviewing or still needs information. Continue onboarding if it asks for more details.",
            );
          }
        },
      )
      .catch((error: Error) => {
        setConnectState("error");
        setMessage(error.message);
      });
  }, []);

  async function connectStripe() {
    setConnectState("loading");
    setMessage("");
    try {
      const response = await fetch("/api/connect/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: readStoredAccount() }),
      });
      const data = (await response.json()) as {
        url?: string;
        account?: string;
        error?: string;
      };
      if (!response.ok || !data.url)
        throw new Error(data.error ?? "Unable to start Stripe onboarding.");
      if (data.account) storeAccount(data.account);
      window.location.assign(data.url);
    } catch (error) {
      setConnectState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to start Stripe onboarding.",
      );
    }
  }

  return (
    <main className="min-h-screen bg-paper">
      <Navigation />
      <section className="mx-auto max-w-4xl px-5 py-16">
        <p className="text-xs font-bold tracking-[.16em] text-pine">
          CREATOR STUDIO · PREVIEW
        </p>
        <h1 className="serif mt-4 text-6xl tracking-[-.08em] md:text-7xl">
          Build your room.
        </h1>
        <p className="mt-5 max-w-xl leading-relaxed text-moss">
          File selection works locally. Stripe payout onboarding can be tested
          with a Stripe test key; secure uploads and storage allocation are the
          next backend phase.
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <label className="cursor-pointer rounded-xl border-2 border-dashed border-fern bg-sage p-10 text-center hover:border-pine focus-within:border-pine focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-pine">
            <input
              className="sr-only"
              type="file"
              accept="audio/*"
              multiple
              onChange={(event) =>
                setFiles(Array.from(event.target.files ?? []))
              }
            />
            <span aria-hidden="true" className="text-4xl">
              ↑
            </span>
            <strong className="mt-4 block">Choose recordings</strong>
            <span className="mt-2 block text-sm text-moss">
              Audio files only · {ARTIST_STORAGE_GB} GB plan limit
            </span>
          </label>
          <div className="rounded-xl bg-ink p-8 text-paper">
            <p className="text-xs font-bold tracking-[.16em] text-mist">
              YOUR PLAN
            </p>
            <p className="mt-5 text-4xl font-bold">
              {ARTIST_PLAN_PRICE_KR} kr{" "}
              <span className="text-base font-normal text-fog">/ month</span>
            </p>
            <p className="mt-4 text-sm leading-relaxed text-fog">
              {ARTIST_STORAGE_GB} GB storage · {PLATFORM_FEE_PERCENT}% platform
              fee on fan subscriptions.
            </p>
            <button
              onClick={connectStripe}
              disabled={connectState === "loading" || connectState === "ready"}
              className="mt-6 w-full bg-clay py-3 font-bold text-ink disabled:opacity-60"
            >
              {connectState === "loading"
                ? "Opening Stripe…"
                : connectState === "ready"
                  ? "Payouts connected"
                  : connectState === "pending"
                    ? "Continue Stripe onboarding →"
                    : "Connect payouts with Stripe →"}
            </button>
            {message && (
              <p
                role="status"
                className={`mt-4 text-sm leading-relaxed ${connectState === "error" ? "text-coral" : "text-fog"}`}
              >
                {message}
              </p>
            )}
          </div>
        </div>
        <section className="mt-8 rounded-xl border border-sand bg-white/40 p-7">
          <div className="flex justify-between">
            <h2 className="text-xl font-bold">Selected recordings</h2>
            <span className="text-sm text-moss">{files.length} chosen</span>
          </div>
          {files.length === 0 ? (
            <p className="mt-5 text-moss">
              Choose audio files to preview your upload list.
            </p>
          ) : (
            <ul className="mt-5 divide-y divide-sand">
              {files.map((file) => (
                <li
                  key={`${file.name}-${file.lastModified}`}
                  className="flex justify-between gap-4 py-3"
                >
                  <span className="truncate">{file.name}</span>
                  <span className="shrink-0 text-sm text-moss">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <Link
          href={`/room/${SAMPLE_ROOM_SLUG}`}
          className="mt-8 inline-block font-bold underline"
        >
          View the example artist room →
        </Link>
      </section>
    </main>
  );
}
