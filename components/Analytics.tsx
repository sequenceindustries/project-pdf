"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CONSENT_EVENT, GA_ID, readConsent, writeConsent, type Consent } from "@/lib/analytics";

/**
 * Loads the GA4 tag once, and only after the visitor allows analytics.
 * Also renders the consent banner. There is exactly one Google tag on the site.
 */

let loaded = false;

function loadGtag(id: string) {
  if (loaded) return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("consent", "default", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  window.gtag("js", new Date());
  window.gtag("config", id, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
}

function revoke() {
  // Stop further collection on this page and clear GA cookies for this site.
  window.gtag?.("consent", "update", { analytics_storage: "denied" });
  try {
    for (const c of document.cookie.split(";")) {
      const name = c.split("=")[0].trim();
      if (name === "_ga" || name.startsWith("_ga_")) {
        const host = location.hostname;
        document.cookie = `${name}=; Max-Age=0; path=/`;
        document.cookie = `${name}=; Max-Age=0; path=/; domain=.${host}`;
      }
    }
  } catch {}
}

export default function Analytics() {
  const [consent, setConsent] = useState<Consent | null | "unknown">("unknown");

  useEffect(() => {
    setConsent(readConsent());
    const onChange = (e: Event) => setConsent((e as CustomEvent<Consent | null>).detail);
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (!GA_ID) return;
    if (consent === "granted") {
      if (loaded) window.gtag?.("consent", "update", { analytics_storage: "granted" });
      else loadGtag(GA_ID);
    } else if (consent === "denied" && loaded) {
      revoke();
    }
  }, [consent]);

  if (!GA_ID || consent !== null) return null;

  return (
    <div
      role="region"
      aria-label="Analytics consent"
      className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-sm"
    >
      <div className="card-chunky p-4 shadow-[0_10px_30px_rgba(24,26,31,0.15)] sm:p-5">
        <p className="text-sm leading-6">
          Can we count visits with Google Analytics? It tells us which tools people use. It never
          sees your files, which stay on your device either way.{" "}
          <Link href="/privacy#analytics" className="font-semibold underline">
            Details
          </Link>
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => writeConsent("granted")}
            className="btn btn-primary flex-1 px-4 py-2 text-sm"
          >
            Allow
          </button>
          <button
            type="button"
            onClick={() => writeConsent("denied")}
            className="btn btn-outline flex-1 px-4 py-2 text-sm"
          >
            No thanks
          </button>
        </div>
      </div>
    </div>
  );
}

/** Footer control that reopens the banner so visitors can change their mind. */
export function ConsentSettingsButton({ className = "" }: { className?: string }) {
  if (!GA_ID) return null;
  return (
    <button type="button" onClick={() => writeConsent(null)} className={className}>
      Analytics settings
    </button>
  );
}
