import { type NextRequest, NextResponse } from "next/server";

const FALLBACK_MODELS: Record<string, string[]> = {
  openai: [
    "o3-mini",
    "o1",
    "o1-mini",
    "o1-preview",
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-4",
    "gpt-3.5-turbo",
  ],
  anthropic: [
    "claude-opus-4-5",
    "claude-sonnet-4-5",
    "claude-haiku-3-5",
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229",
    "claude-3-sonnet-20240229",
    "claude-3-haiku-20240307",
  ],
  google: [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.0-pro-exp",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-1.0-pro",
  ],
};

async function fetchOpenAIModels(apiKey: string): Promise<string[]> {
  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = (await res.json()) as { data: { id: string }[] };
  return data.data
    .map((m) => m.id)
    .filter((id) => /^(o[0-9]|gpt-|chatgpt-)/.test(id))
    .sort((a, b) => b.localeCompare(a));
}

async function fetchAnthropicModels(apiKey: string): Promise<string[]> {
  const res = await fetch("https://api.anthropic.com/v1/models?limit=100", {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`[models] Anthropic ${res.status}:`, body);
    throw new Error(`Anthropic ${res.status}`);
  }
  const raw = await res.json();
  console.log("[models] Anthropic raw response:", JSON.stringify(raw).slice(0, 500));
  const data = raw as { data: { id: string }[] };
  return data.data.map((m) => m.id).sort((a, b) => b.localeCompare(a));
}

async function fetchGoogleModels(apiKey: string): Promise<string[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
  );
  if (!res.ok) throw new Error(`Google ${res.status}`);
  const data = (await res.json()) as {
    models: { name: string; supportedGenerationMethods?: string[] }[];
  };
  return (data.models ?? [])
    .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""))
    .filter((id) => id.startsWith("gemini"))
    .sort((a, b) => b.localeCompare(a));
}

async function handleModels(provider: string | null, apiKey: string | null) {
  if (!provider || !FALLBACK_MODELS[provider]) {
    return NextResponse.json({ error: "Invalid or missing provider" }, { status: 400 });
  }

  if (!apiKey || !apiKey.trim()) {
    return NextResponse.json({ models: FALLBACK_MODELS[provider], source: "fallback" });
  }

  try {
    let models: string[];
    if (provider === "openai") {
      models = await fetchOpenAIModels(apiKey);
    } else if (provider === "anthropic") {
      models = await fetchAnthropicModels(apiKey);
    } else {
      models = await fetchGoogleModels(apiKey);
    }
    return NextResponse.json({ models, source: "live" });
  } catch (err) {
    console.warn(`[models] Failed to fetch from ${provider}:`, (err as Error).message);
    return NextResponse.json({ models: FALLBACK_MODELS[provider], source: "fallback" });
  }
}

export async function GET(request: NextRequest) {
  const provider = request.nextUrl.searchParams.get("provider");
  const apiKey = request.nextUrl.searchParams.get("apiKey");
  return handleModels(provider, apiKey);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { provider?: string; apiKey?: string };
  return handleModels(body.provider ?? null, body.apiKey ?? null);
}
