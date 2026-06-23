type OpenAiMessage = {
  role: "system" | "user";
  content: string;
};

type OpenAiChatResponse = {
  choices?: {
    message?: {
      content?: string;
    };
  }[];
  error?: {
    message?: string;
  };
};

export function hasOpenAiApiKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}
export async function generateOpenAiText(args: {
  messages: OpenAiMessage[];
  maxTokens?: number;
}) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      mode: "unconfigured",
      text: null,
      error: "OPENAI_API_KEY is not configured.",
    };
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      messages: args.messages,
      temperature: 0.2,
      max_tokens: args.maxTokens ?? 450,
    }),
  });
  const payload = (await response.json()) as OpenAiChatResponse;

  if (!response.ok) {
    return {
      mode: "openai",
      text: null,
      error: payload.error?.message ?? "OpenAI request failed.",
    };
  }

  return {
    mode: "openai",
    text: payload.choices?.[0]?.message?.content?.trim() ?? null,
    error: null,
  };
}
