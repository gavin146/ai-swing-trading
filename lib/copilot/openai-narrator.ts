import { generateOpenAiText } from "../openai";
import { assertServerOnlyModule } from "./server-only";
import {
  buildCopilotNarrationPrompt,
  type CopilotNarrationResult,
  type CopilotNarrator,
  type DailyCopilotReportInput,
  RuleBasedCopilotNarrator,
  validateCopilotNarrative,
} from "./reporting";

export type CopilotOpenAiResponse = {
  error: string | null;
  mode: string;
  text: string | null;
};

export type CopilotOpenAiClient = (args: {
  maxTokens?: number;
  messages: Array<{ role: "system" | "user"; content: string }>;
}) => Promise<CopilotOpenAiResponse>;

export type CopilotNarrationCache = {
  get(inputHash: string): CopilotNarrationResult | null;
  set(inputHash: string, result: CopilotNarrationResult): void;
};

export type OpenAICopilotNarratorOptions = {
  cache?: CopilotNarrationCache;
  client?: CopilotOpenAiClient;
  enabled?: boolean;
  env?: Record<string, string | undefined>;
  fallbackNarrator?: CopilotNarrator;
  model?: string;
  promptVersion?: string;
  timeoutMs?: number;
};

export class MemoryCopilotNarrationCache implements CopilotNarrationCache {
  private readonly values = new Map<string, CopilotNarrationResult>();

  get(inputHash: string) {
    return this.values.get(inputHash) ?? null;
  }

  set(inputHash: string, result: CopilotNarrationResult) {
    this.values.set(inputHash, result);
  }
}

const defaultPromptVersion = "openai-copilot-narrator.v1";
const defaultTimeoutMs = 8_000;

function envFlag(env: Record<string, string | undefined>, name: string) {
  return env[name]?.trim().toLowerCase() === "true";
}

function sanitizeError(value: unknown) {
  const text = value instanceof Error ? value.message : String(value ?? "Unknown OpenAI narration error.");
  return text.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]").slice(0, 240);
}

function parseOpenAiNarrative(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as { narrative?: unknown };
    return typeof parsed.narrative === "string" ? parsed.narrative.trim() : "";
  } catch {
    return cleaned;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error("OpenAI narration timed out.")), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

export class OpenAICopilotNarrator implements CopilotNarrator {
  private readonly cache?: CopilotNarrationCache;
  private readonly client: CopilotOpenAiClient;
  private readonly enabled: boolean;
  private readonly fallbackNarrator: CopilotNarrator;
  private readonly model: string;
  private readonly promptVersion: string;
  private readonly timeoutMs: number;

  constructor(options: OpenAICopilotNarratorOptions = {}) {
    assertServerOnlyModule("OpenAICopilotNarrator");

    const env = options.env ?? process.env;
    this.cache = options.cache;
    this.client = options.client ?? generateOpenAiText;
    this.enabled = options.enabled ?? envFlag(env, "COPILOT_AI_NARRATION_ENABLED");
    this.fallbackNarrator = options.fallbackNarrator ?? new RuleBasedCopilotNarrator();
    this.model = options.model ?? env.OPENAI_MODEL ?? "gpt-4.1-mini";
    this.promptVersion = options.promptVersion ?? defaultPromptVersion;
    this.timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
  }

  private async fallback(input: DailyCopilotReportInput, error: string): Promise<CopilotNarrationResult> {
    const fallback = await this.fallbackNarrator.narrate(input);

    return {
      narrative: fallback.narrative,
      metadata: {
        fallbackNarratorId: fallback.metadata.narratorId,
        inputHash: input.inputHash,
        model: this.model,
        narratorId: "openai_copilot",
        outputStatus: "fallback",
        promptVersion: this.promptVersion,
        sanitizedError: sanitizeError(error),
      },
    };
  }

  async narrate(input: DailyCopilotReportInput): Promise<CopilotNarrationResult> {
    const cached = this.cache?.get(input.inputHash);
    if (cached) {
      return {
        ...cached,
        metadata: {
          ...cached.metadata,
          outputStatus: "cached",
        },
      };
    }

    if (!this.enabled) {
      return this.fallback(input, "OpenAI Copilot narration is disabled.");
    }

    const prompt = buildCopilotNarrationPrompt(input);

    try {
      const response = await withTimeout(
        this.client({
          maxTokens: 900,
          messages: [
            {
              role: "system",
              content:
                "You are SwingFi Copilot's narration layer. You may only rewrite the supplied structured evidence into clearer wording. You must not calculate or invent any ticker, price, percentage, date, target, stop, account value, return, severity, or factual claim. Return strict JSON only.",
            },
            {
              role: "user",
              content: JSON.stringify({
                promptVersion: this.promptVersion,
                ...prompt,
              }),
            },
          ],
        }),
        this.timeoutMs,
      );

      if (response.error || !response.text) {
        return this.fallback(input, response.error ?? "OpenAI returned no narration.");
      }

      const narrative = parseOpenAiNarrative(response.text);
      const validation = validateCopilotNarrative(narrative, input);

      if (!validation.ok) {
        return this.fallback(input, validation.reason);
      }

      const result: CopilotNarrationResult = {
        metadata: {
          inputHash: input.inputHash,
          model: this.model,
          narratorId: "openai_copilot",
          outputStatus: "success",
          promptVersion: this.promptVersion,
        },
        narrative,
      };

      this.cache?.set(input.inputHash, result);

      return result;
    } catch (error) {
      return this.fallback(input, sanitizeError(error));
    }
  }
}
