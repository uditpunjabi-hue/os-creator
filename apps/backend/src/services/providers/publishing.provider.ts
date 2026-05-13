import { Injectable, Logger } from '@nestjs/common';

export type PostKind = 'IMAGE' | 'CAROUSEL' | 'REEL' | 'STORY';
export type Platform = 'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'x';

export interface ScheduledPost {
  id: string;
  influencerId: string;
  influencerName: string;
  caption: string;
  kind: PostKind;
  platforms: Platform[];
  scheduledAt: string;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED';
}

export interface CreateScheduledPostInput {
  influencerId: string;
  influencerName: string;
  caption: string;
  kind: PostKind;
  platforms: Platform[];
  scheduledAt: string;
}

export interface PublishingProvider {
  listPosts(orgId: string): Promise<ScheduledPost[]>;
  schedulePost(orgId: string, input: CreateScheduledPostInput): Promise<ScheduledPost>;
  deletePost(orgId: string, postId: string): Promise<{ ok: boolean }>;
}

@Injectable()
export class MockPublishingProvider implements PublishingProvider {
  private readonly logger = new Logger(MockPublishingProvider.name);
  private readonly postsByOrg = new Map<string, ScheduledPost[]>();

  async listPosts(orgId: string): Promise<ScheduledPost[]> {
    return [...(this.postsByOrg.get(orgId) ?? [])].sort((a, b) =>
      a.scheduledAt.localeCompare(b.scheduledAt)
    );
  }

  async schedulePost(orgId: string, input: CreateScheduledPostInput): Promise<ScheduledPost> {
    const post: ScheduledPost = {
      id: `pub-${Date.now()}`,
      ...input,
      status: 'SCHEDULED',
    };
    if (!this.postsByOrg.has(orgId)) this.postsByOrg.set(orgId, []);
    this.postsByOrg.get(orgId)!.push(post);
    this.logger.log(`[mock publishing] scheduled ${post.id} on ${input.platforms.join(',')} (Ayrshare disabled)`);
    return post;
  }

  async deletePost(orgId: string, postId: string) {
    const list = this.postsByOrg.get(orgId) ?? [];
    const idx = list.findIndex((p) => p.id === postId);
    if (idx >= 0) list.splice(idx, 1);
    return { ok: idx >= 0 };
  }
}

export const PUBLISHING_PROVIDER_TOKEN = 'PUBLISHING_PROVIDER';
