import {
  Body,
  Controller,
  HttpException,
  Logger,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization, User } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

const MODEL = 'claude-sonnet-4-6';

interface GenerateBody {
  prompt: string;
  format?: 'Reel' | 'Carousel' | 'Story' | 'Photo';
}

interface GeneratedScript {
  title: string;
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  caption: string;
}

@ApiTags('Creator')
@Controller('/creator/scripts')
export class CreatorScriptsController {
  private readonly logger = new Logger(CreatorScriptsController.name);

  constructor(private _prisma: PrismaService) {}

  @Post('/generate')
  async generate(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @Body() body: GenerateBody
  ) {
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

    const prompt = (body.prompt ?? '').trim();
    if (!prompt) {
      throw new HttpException('prompt is required', 400);
    }
    const format = body.format ?? 'Reel';

    const systemPrompt = [
      'You are the AI manager and head writer for a solo creator.',
      "You analyze the creator's audience profile and competitor content, then draft",
      'short, punchy social scripts in the creator\'s voice.',
      '',
      'Return STRICT JSON with this exact shape — no prose, no markdown fences:',
      '{',
      '  "title": "short headline, < 60 chars",',
      '  "hook": "first 3 seconds, < 140 chars, must stop the scroll",',
      '  "body": "main content as a single string with \\n line breaks between beats",',
      '  "cta": "one-line call to action",',
      '  "hashtags": ["#tag1", "#tag2", "..."],',
      '  "caption": "2-4 sentence caption to post under the video"',
      '}',
    ].join('\n');

    const creatorContext = {
      profile: {
        handle: '@ariavance',
        platform: 'instagram',
        followers: 128420,
        engagement: 5.8,
        bestTime: 'Tue/Thu 6:30 PM',
        topics: ['filmmaking', 'creator workflow', 'AI tools', 'gear'],
      },
      competitors: [
        { handle: '@matty.bts', engagement: 4.8, growth30d: 6.2 },
        { handle: '@sora.studio', engagement: 9.3, growth30d: 18.5 },
        { handle: '@frame.by.frame', engagement: 8.4, growth30d: 9.6 },
      ],
    };

    const userMessage = [
      `Format: ${format}`,
      `Prompt: ${prompt}`,
      '',
      `Creator profile + competitor benchmark (use to tune tone, hooks, hashtags):`,
      JSON.stringify(creatorContext, null, 2),
    ].join('\n');

    let generated: GeneratedScript;
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        this.logger.warn(`Anthropic ${res.status}: ${text.slice(0, 300)}`);
        throw new HttpException(
          { error: 'ANTHROPIC_REQUEST_FAILED', status: res.status, body: text.slice(0, 500) },
          502
        );
      }
      const payload = (await res.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      const text = payload.content?.find((c) => c.type === 'text')?.text ?? '';
      generated = JSON.parse(text);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      this.logger.error('Generation failed', e as Error);
      throw new HttpException(
        {
          error: 'ANTHROPIC_PARSE_FAILED',
          message: (e as Error).message,
        },
        502
      );
    }

    // Persist as a DRAFT Script so it shows up in the Scripts list.
    const composedBody = [
      `Hook: ${generated.hook}`,
      '',
      `Body:\n${generated.body}`,
      '',
      `CTA: ${generated.cta}`,
      '',
      `Caption: ${generated.caption}`,
      '',
      `Hashtags: ${generated.hashtags.join(' ')}`,
    ].join('\n');

    const saved = await this._prisma.script.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        title: generated.title,
        format,
        prompt,
        body: composedBody,
        status: 'DRAFT',
      },
    });

    return { script: saved, parsed: generated };
  }
}
