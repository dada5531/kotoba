import Anthropic from "@anthropic-ai/sdk";

export const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const MODELS = {
  // Locked per project brief.
  default: "claude-sonnet-4-6",
  cheap: "claude-haiku-4-5-20251001",
  heavy: "claude-opus-4-7",
} as const;

export type ClaudeModel = (typeof MODELS)[keyof typeof MODELS];

interface GenerateJsonOpts<T> {
  model?: ClaudeModel;
  system: string;
  user: string;
  maxTokens?: number;
  validate: (raw: unknown) => T;
}

export async function generateJSON<T>(opts: GenerateJsonOpts<T>): Promise<T> {
  const model = opts.model ?? MODELS.default;
  const baseSystem =
    opts.system +
    "\n\nReturn ONLY a single JSON value. No prose, no markdown, no code fences. The first character must be { or [.";

  const attempt = async (extraNote?: string) => {
    const res = await claude.messages.create({
      model,
      max_tokens: opts.maxTokens ?? 1024,
      system: baseSystem + (extraNote ? `\n\n${extraNote}` : ""),
      messages: [{ role: "user", content: opts.user }],
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return text;
  };

  const tryParse = (text: string): unknown => {
    const stripped = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    return JSON.parse(stripped);
  };

  let lastErr: unknown;
  for (let i = 0; i < 2; i++) {
    try {
      const text = await attempt(
        i === 0 ? undefined : "Your previous reply was not valid JSON. Output JSON only.",
      );
      const raw = tryParse(text);
      return opts.validate(raw);
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(
    `Claude generateJSON failed: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
  );
}

export async function generateText(opts: {
  model?: ClaudeModel;
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const res = await claude.messages.create({
    model: opts.model ?? MODELS.default,
    max_tokens: opts.maxTokens ?? 1024,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}
