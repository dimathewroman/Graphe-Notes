import { Router, type IRouter } from "express";
import { AiCompleteBody, AiCompleteResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/ai/complete", async (req, res): Promise<void> => {
  const parsed = AiCompleteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { provider, apiKey, model, prompt, systemPrompt, noteContext } = parsed.data;

  const systemMessage = [
    systemPrompt ?? "You are a helpful AI assistant for a notes app. Help users write, organize, and improve their notes.",
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
        res.status(500).json({ error: `OpenAI error: ${err}` });
        return;
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
        usage?: { total_tokens?: number };
      };
      const result = data.choices[0]?.message?.content ?? "";
      const tokensUsed = data.usage?.total_tokens ?? null;

      res.json(AiCompleteResponse.parse({ result, tokensUsed }));
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
        const err = await response.text();
        res.status(500).json({ error: `Anthropic error: ${err}` });
        return;
      }

      const data = await response.json() as {
        content: Array<{ text: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      const result = data.content[0]?.text ?? "";
      const tokensUsed = data.usage
        ? (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0)
        : null;

      res.json(AiCompleteResponse.parse({ result, tokensUsed }));
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
        }
      );

      if (!response.ok) {
        const err = await response.text();
        res.status(500).json({ error: `Google AI error: ${err}` });
        return;
      }

      const data = await response.json() as {
        candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
        usageMetadata?: { totalTokenCount?: number };
      };
      const result = data.candidates[0]?.content?.parts[0]?.text ?? "";
      const tokensUsed = data.usageMetadata?.totalTokenCount ?? null;

      res.json(AiCompleteResponse.parse({ result, tokensUsed }));
    } else {
      res.status(400).json({ error: `Unknown provider: ${provider}` });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `AI request failed: ${message}` });
  }
});

export default router;
