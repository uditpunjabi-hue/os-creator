import 'server-only';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-6';

export interface CallClaudeArgs {
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
  model?: string;
}

export class ClaudeError extends Error {
  constructor(public status: number, message: string, public detail?: unknown) {
    super(message);
  }
}

/**
 * Strict JSON helper: sends the messages, expects the model to return ONE
 * JSON object as the only assistant text block, parses it tolerantly.
 */
export async function callClaude<T>({
  systemPrompt,
  userMessage,
  maxTokens = 1024,
  model = DEFAULT_MODEL,
}: CallClaudeArgs): Promise<T> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ClaudeError(
      503,
      'AI script generation is not configured. Set ANTHROPIC_API_KEY in env.'
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
    console.warn(`Anthropic ${res.status} (${model}): ${text.slice(0, 300)}`);
    throw new ClaudeError(502, `Anthropic ${res.status}`, text.slice(0, 500));
  }

  const payload = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const raw = payload.content?.find((c) => c.type === 'text')?.text ?? '';
  const cleaned = extractJson(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    console.warn(`Failed to parse model JSON: ${cleaned.slice(0, 400)}`);
    throw new ClaudeError(502, (e as Error).message, cleaned.slice(0, 500));
  }
}

/**
 * Tolerate the three common JSON-wrapping failures Claude exhibits:
 *   1. ```json ... ``` fenced block (anywhere in the text — also handles
 *      leading prose like "Sure, here's the JSON:")
 *   2. Opening fence + truncated body (token cap hit before closing fence)
 *   3. No fence but bookending prose ("Here's the JSON: {...} hope this helps!")
 */
export function extractJson(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) return fenced[1].trim();

  const opener = trimmed.match(/^```(?:json)?\s*\n?/i);
  const stripped = opener ? trimmed.slice(opener[0].length).trim() : trimmed;

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
