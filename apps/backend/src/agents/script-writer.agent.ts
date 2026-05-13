import { callClaude } from './anthropic.client';
import type { ScriptDraft, StrategyBrief } from './types';

const SYSTEM_PROMPT = `You are an expert social media script writer. Given a content strategy brief, write a complete script. The script must be engaging, authentic, and optimized for the platform (Instagram Reels first).

Return STRICT JSON with this exact shape — no prose, no markdown fences:
{
  "title": "short headline, < 70 chars",
  "hook": "first 3 seconds — must stop the scroll, < 140 chars",
  "body": "main content as a single string with \\n line breaks between beats; aim for 15-45 seconds of speaking pace",
  "cta": "one-line call to action, action-verb led",
  "caption": "Instagram caption: 2-4 sentences, value first, conversational, ends with a question or invitation",
  "hashtags": ["15-20 hashtags, mix of broad and niche, no fluff"],
  "estimatedDuration": "e.g. '28s' — be honest about pacing",
  "filmingNotes": "concrete shooting/editing direction the creator can follow without thinking: shot list, lighting, audio, on-screen text cues"
}

Write in the creator's voice from the brief. Hook must do work — no soft openings. Hashtags should be specific to the niche (not just #content #reels).`;

export async function runScriptWriter(
  strategy: StrategyBrief,
  prompt: string,
  revisionNotes?: string
): Promise<ScriptDraft> {
  const userMessage = [
    revisionNotes
      ? `REVISION REQUEST. Improve the previous draft using these notes from the reviewer:\n${revisionNotes}\n`
      : '',
    `Original creator prompt: ${prompt}`,
    '',
    'Strategy brief to execute:',
    JSON.stringify(strategy, null, 2),
    '',
    'Write the complete script now.',
  ]
    .filter(Boolean)
    .join('\n');

  return callClaude<ScriptDraft>({
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    // Writer is the most output-heavy agent (hook + body + cta + caption +
    // 15-20 hashtags + filming notes). 1500 was hitting truncation mid-string
    // around 4-5 KB of JSON; 4000 leaves headroom for verbose strategies.
    maxTokens: 4000,
  });
}
