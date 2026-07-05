import type { Breadcrumb } from "@sentry/nextjs";

// Strip secret-bearing query params (e.g. Gemini `?key=`) from breadcrumb URLs
// so an API key can never ride along into Sentry via an HTTP breadcrumb
// (§S key-in-URL). Belt-and-braces with sending keys in headers, not URLs.
const SECRET_PARAM = /([?&](?:key|token|api_key|apikey|access_token)=)[^&#]*/gi;

export function scrubSecretsFromBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  const url = breadcrumb?.data?.url;
  if (typeof url === "string" && breadcrumb.data) {
    breadcrumb.data.url = url.replace(SECRET_PARAM, "$1[REDACTED]");
  }
  return breadcrumb;
}
