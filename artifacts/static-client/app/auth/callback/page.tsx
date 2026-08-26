"use client";

import dynamic from "next/dynamic";

const HostedAuthCallbackPage = dynamic(() => import("@/app/auth/callback/page"), {
  ssr: false,
});

export default function StaticClientAuthCallbackPage() {
  return <HostedAuthCallbackPage />;
}
