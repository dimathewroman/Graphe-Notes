import { type NextRequest, NextResponse } from "next/server";
import { AiCompleteBody, AiCompleteResponse } from "@workspace/api-zod";
import { getAuthUser } from "@/lib/auth-server";

export async function POST(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = AiCompleteBody.safeParse(body);
  if (!parsed.success) {
    console.error("[AI] Validation failed:", parsed.error.message);
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { provider, apiKey, model, prompt, systemPrompt, noteContext } = parsed.data;
  console.log(
    `[AI] Request: provider=${provider} model=${model} keyLen=${apiKey.length} keyStart=${apiKey.slice(0, 8)}...`,
  );

  const systemMessage = [
    systemPrompt ??
      "You are a helpful AI assistant for a notes app. Help users write, organize, and improve their notes.",
    noteContext ? `\n\nCurrent note context:\n${noteContext}` : "",
  ].join("");

  try {
    if (provider === "openai") {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemMessage },
            { role: "user", content: prompt },
          ],
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        return NextResponse.json({ error: `OpenAI error: ${err}` }, { status: 500 });
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
        usage?: { total_tokens?: number };
      };
      const result = data.choices[0]?.message?.content ?? "";
      const tokensUsed = data.usage?.total_tokens ?? null;

      return NextResponse.json(AiCompleteResponse.parse({ result, tokensUsed }));
    } else if (provider === "anthropic") {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 2000,
          system: systemMessage,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!response.ok) {
        let errMsg = `Anthropic ${response.status}`;
        try {
          const rawBody = await response.text();
          console.error(`[AI] Anthropic error ${response.status}:`, rawBody);
          const errBody = JSON.parse(rawBody) as {
            error?: { type?: string; message?: string };
          };
          const type = errBody.error?.type ?? "";
          const msg = errBody.error?.message ?? "";
          if (type === "authentication_error") {
            errMsg = "Anthropic authentication failed — check your API key in Settings → AI.";
          } else if (type === "permission_error" || response.status === 403) {
            errMsg =
              "Anthropic permission denied — your key may lack API access or credits.";
          } else if (type === "not_found_error" && msg.startsWith("model:")) {
            errMsg = `Invalid Anthropic model "${model}" — open Settings → AI and select a valid model from the list.`;
          } else if (msg) {
            errMsg = `Anthropic: ${msg}`;
          }
        } catch {
          // leave default message
        }
        return NextResponse.json({ error: errMsg }, { status: 500 });
      }

      console.log("[AI] Anthropic success");
      const data = (await response.json()) as {
        content: Array<{ text: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      const result = data.content[0]?.text ?? "";
      const tokensUsed = data.usage
        ? (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0)
        : null;

      return NextResponse.json(AiCompleteResponse.parse({ result, tokensUsed }));
    } else if (provider === "google") {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemMessage }] },
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 2000 },
          }),
        },
      );

      if (!response.ok) {
        const err = await response.text();
        return NextResponse.json({ error: `Google AI error: ${err}` }, { status: 500 });
      }

      const data = (await response.json()) as {
        candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
        usageMetadata?: { totalTokenCount?: number };
      };
      const result = data.candidates[0]?.content?.parts[0]?.text ?? "";
      const tokensUsed = data.usageMetadata?.totalTokenCount ?? null;

      return NextResponse.json(AiCompleteResponse.parse({ result, tokensUsed }));
    } else {
      return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `AI request failed: ${message}` }, { status: 500 });
  }
}
