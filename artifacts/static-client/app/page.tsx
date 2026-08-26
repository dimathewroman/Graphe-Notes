"use client";

import dynamic from "next/dynamic";

const HostedHomePage = dynamic(() => import("@/app/page"), { ssr: false });

// Reuse the browser-safe hosted UI entrypoint. The static-client boundary guard
// proves its import graph never reaches hosted route or server-only owners. It
// runs only after the static HTML is loaded in a browser, never during export.
export default function StaticClientHomePage() {
  return <HostedHomePage />;
}
