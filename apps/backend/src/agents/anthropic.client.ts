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
  const cleaned = extractJson(raw);
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

/**
 * Extract a JSON object/array from a Claude completion, tolerating common
 * "wrapping" failure modes:
 *   - ```json ... ``` fenced block (anywhere in the text)
 *   - ``` ... ``` fenced block without the `json` tag
 *   - Leading or trailing prose ("Here is the JSON:\n{...}\nLet me know...")
 *   - Truncated response where the closing fence is missing
 *
 * Strategy: prefer a fenced block when one is present; otherwise slice from the
 * first `{`/`[` to the matching final `}`/`]`. Anything outside that span is
 * conversational fluff the model added despite the system prompt.
 */
export function extractJson(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  // 1. Full ```json ... ``` block (with closing fence). Not anchored — the
  //    block may follow leading prose like "Sure, here's the JSON:".
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) return fenced[1].trim();

  // 2. Opening fence but truncated — model started with ```json then ran out
  //    of tokens before the closing fence. Strip the opener and continue.
  const opener = trimmed.match(/^```(?:json)?\s*\n?/i);
  const stripped = opener ? trimmed.slice(opener[0].length).trim() : trimmed;

  // 3. Slice from first `{`/`[` to last `}`/`]`. Catches the "Here's the JSON:
  //    { ... } Hope this helps!" case where there's no fence at all but prose
  //    bookends the JSON. Works because JSON.parse needs a balanced top-level
  //    object/array and that's exactly what these bounds capture.
  const firstObj = stripped.indexOf('{');
  const firstArr = stripped.indexOf('[');
  const start =
    firstObj === -1
      ? firstArr
      : firstArr === -1
      ? firstObj
      : Math.min(firstObj, firstArr);
  if (start < 0) return stripped;

  const lastObj = stripped.lastIndexOf('}');
  const lastArr = stripped.lastIndexOf(']');
  const end = Math.max(lastObj, lastArr);
  if (end <= start) return stripped;

  return stripped.slice(start, end + 1);
}
