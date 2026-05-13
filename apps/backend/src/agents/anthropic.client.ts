import { HttpException, Logger } from '@nestjs/common';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-6';

export interface CallClaudeArgs {
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
  model?: string;
}

const logger = new Logger('AnthropicClient');

/**
 * Strict JSON helper: sends the messages, expects the model to return ONE
 * JSON object as the only assistant text block, and parses it. Strips markdown
 * code fences if the model wraps the output (a common failure mode even with
 * explicit "no fences" instructions in the system prompt).
 */
export async function callClaude<T>({
  systemPrompt,
  userMessage,
  maxTokens = 1024,
  model = DEFAULT_MODEL,
}: CallClaudeArgs): Promise<T> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new HttpException(
      {
        error: 'ANTHROPIC_API_KEY_NOT_CONFIGURED',
        message:
          'AI script generation is not configured. Set ANTHROPIC_API_KEY in .env and restart the backend.',
      },
      503
    );
  }

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.warn(`Anthropic ${res.status} (${model}): ${text.slice(0, 300)}`);
    throw new HttpException(
      {
        error: 'ANTHROPIC_REQUEST_FAILED',
        status: res.status,
        body: text.slice(0, 500),
      },
      502
    );
  }

  const payload = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const raw = payload.content?.find((c) => c.type === 'text')?.text ?? '';
  const cleaned = stripJsonFence(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    logger.warn(`Failed to parse model JSON output: ${cleaned.slice(0, 400)}`);
    throw new HttpException(
      {
        error: 'ANTHROPIC_PARSE_FAILED',
        message: (e as Error).message,
        rawSnippet: cleaned.slice(0, 500),
      },
      502
    );
  }
}

function stripJsonFence(s: string): string {
  const trimmed = s.trim();
  // Match ```json ... ``` or ``` ... ``` with the JSON body inside.
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fence ? fence[1].trim() : trimmed;
}
