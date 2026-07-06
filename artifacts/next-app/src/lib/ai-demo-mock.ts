// Demo-AI harness. AI is normally disabled in demo mode (and the whole e2e suite
// runs in demo mode), so there is no automated way to exercise AI-in-the-editor.
// When NEXT_PUBLIC_ENABLE_DEMO_AI is set (dev/CI only — never production), demo
// mode routes AI actions to a deterministic MOCK that never contacts a real
// provider and needs no auth. That opens the door for end-to-end tests of the
// AI → editor path, and is the foundation the streaming work will build on.
//
// Safety: the flag is a build-time NEXT_PUBLIC var that is unset in production,
// so the mock branch in /api/ai/generate is dead code there. The mock only ever
// returns canned strings — no auth, no DB, no user data, no real key.

/** True only when the demo-AI harness flag is set (dev/CI). */
export function isDemoAiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_DEMO_AI === "1";
}

/** Header the demo client sends so the route serves the mock instead of 401ing. */
export const DEMO_AI_HEADER = "x-graphe-demo-ai";

/**
 * Deterministic canned AI text. Includes the action name so tests can assert a
 * stable, recognizable result without depending on any real model output.
 */
export function mockAiText(action?: string): string {
  return `Mock AI response${action ? ` for ${action}` : ""}.`;
}

/** The full canned /api/ai/generate response body (current non-streaming shape). */
export function mockGenerateBody(action?: string) {
  return {
    result: mockAiText(action),
    model: "mock",
    tokensUsed: { inputTokens: 0, outputTokens: 0 },
  };
}
