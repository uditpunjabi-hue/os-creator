import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcrypt';

const prisma = new PrismaClient();

const SEED_EMAIL = 'opnclaw123@gmail.com';
const SEED_PASSWORD = 'illuminati123';

const stages = ['LEAD', 'PROPOSAL_SENT', 'NEGOTIATING', 'CONTRACT', 'PAYMENT', 'COMPLETED'] as const;
type Stage = (typeof stages)[number];

const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

async function clearManagerData(orgId: string) {
  // Order matters: child rows first.
  await prisma.dealActivity.deleteMany({ where: { organizationId: orgId } });
  await prisma.payment.deleteMany({ where: { organizationId: orgId } });
  await prisma.paymentReminder.deleteMany({ where: { organizationId: orgId } });
  await prisma.brandCommercial.deleteMany({ where: { organizationId: orgId } });
  await prisma.contract.deleteMany({ where: { organizationId: orgId } });
  await prisma.deal.deleteMany({ where: { organizationId: orgId } });
  await prisma.scheduledPost.deleteMany({ where: { organizationId: orgId } });
  await prisma.contentPiece.deleteMany({ where: { organizationId: orgId } });
  await prisma.script.deleteMany({ where: { organizationId: orgId } });
  await prisma.influencer.deleteMany({ where: { organizationId: orgId } });
  await prisma.competitor.deleteMany({ where: { organizationId: orgId } });
  await prisma.emailTemplate.deleteMany({ where: { organizationId: orgId } });
  await prisma.rateCard.deleteMany({ where: { organizationId: orgId } });
}

async function upsertUserAndOrg() {
  const passwordHash = hashSync(SEED_PASSWORD, 10);
  const org = await prisma.organization.upsert({
    where: { id: 'seed-org-illuminati' },
    update: { name: 'Illuminati Media' },
    create: {
      id: 'seed-org-illuminati',
      name: 'Illuminati Media',
      description: 'Demo org for the Illuminati Creator OS',
    },
  });

  const user = await prisma.user.upsert({
    where: { email_providerName: { email: SEED_EMAIL, providerName: 'LOCAL' } },
    update: { password: passwordHash, name: 'Aria', lastName: 'Vance', activated: true },
    create: {
      email: SEED_EMAIL,
      password: passwordHash,
      providerName: 'LOCAL',
      name: 'Aria',
      lastName: 'Vance',
      bio: 'Creator, founder of Illuminati Media. AI-managed solo studio.',
      timezone: 330, // +5:30 IST
      activated: true,
      isSuperAdmin: true,
      userMode: 'CREATOR',
    },
  });

  await prisma.userOrganization.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
    update: { role: 'ADMIN', disabled: false },
    create: { userId: user.id, organizationId: org.id, role: 'ADMIN' },
  });

  return { org, user };
}

async function seedCompetitors(orgId: string) {
  const competitors = [
    { handle: '@matty.bts', platform: 'instagram', followers: 412_000, engagement: 4.8, growth30d: 6.2 },
    { handle: '@maya.films', platform: 'instagram', followers: 268_400, engagement: 6.1, growth30d: 3.4 },
    { handle: '@adamtheeditor', platform: 'tiktok', followers: 1_240_000, engagement: 7.9, growth30d: 12.1 },
    { handle: '@sora.studio', platform: 'instagram', followers: 89_700, engagement: 9.3, growth30d: 18.5 },
    { handle: '@nicotravels', platform: 'instagram', followers: 351_200, engagement: 3.6, growth30d: -1.8 },
    { handle: '@hellojulesco', platform: 'youtube', followers: 612_000, engagement: 5.2, growth30d: 2.7 },
    { handle: '@frame.by.frame', platform: 'tiktok', followers: 184_300, engagement: 8.4, growth30d: 9.6 },
  ];
  await prisma.competitor.createMany({
    data: competitors.map((c) => ({ ...c, organizationId: orgId })),
    skipDuplicates: true,
  });
}

async function seedRateCard(orgId: string) {
  await prisma.rateCard.upsert({
    where: { organizationId: orgId },
    update: {},
    create: {
      organizationId: orgId,
      reelRate: 4_200,
      storyRate: 1_500,
      carouselRate: 2_800,
      ugcRate: 3_200,
      brandIntegRate: 6_500,
      exclusivityRate: 2_000,
      currency: 'USD',
      notes: 'Tiered by deliverable. Multi-post discounts negotiable. Exclusivity priced separately per category.',
    },
  });
}

async function seedScripts(orgId: string, userId: string) {
  const scripts = [
    { title: '5 lighting mistakes that ruin reels', status: 'PUBLISHED', format: 'Reel', body: 'Hook: Your reel looks amateur because of THIS one light\n\nBody: Walk through 5 mistakes...\n\nCTA: Comment "LIGHT" and I send my setup PDF.' },
    { title: 'Behind the scenes — Bloom campaign', status: 'APPROVED', format: 'Reel', body: 'Hook: We shot a 6-figure campaign in 1 day. Here\'s how.\n\nBody: BTS clips of director chair, monitors, lighting.\n\nCTA: Follow for week 2.' },
    { title: 'Q: My gear list at $1k', status: 'IN_REVIEW', format: 'Carousel', body: 'Slide 1: Camera\nSlide 2: Lens\nSlide 3: Audio\nSlide 4: Light\nSlide 5: Tripod\nSlide 6: Why I picked each' },
    { title: 'Three product unboxings in 60s', status: 'SCHEDULED', format: 'Reel', body: 'Fast-cut unboxing format. Music: trending audio. End with question.' },
    { title: 'Why your hook fails in 3 seconds', status: 'DRAFT', format: 'Reel', body: 'Hook: People scroll past your content because of THIS\n\nBody: Walk through 3 hook formulas with examples...\n\nCTA: Save this for your next post.' },
    { title: 'Day in the life: solo creator + AI manager', status: 'DRAFT', format: 'Reel', body: 'Vlog-style. Wake up, check Illuminati inbox, AI surfaces deals, approve scripts, shoot.' },
    { title: 'How I price brand deals (real numbers)', status: 'REJECTED', format: 'Carousel', feedback: 'Sharing pricing publicly could undercut future negotiations. Rework as principles, not numbers.', body: 'Slide 1: Reels start at $4,200\nSlide 2: Carousel + Story bundle: $5k\nSlide 3: Exclusivity adds 50%' },
    { title: 'Reading mean comments', status: 'IDEA' as never, format: 'Reel', body: 'TBD' },
    { title: 'My morning routine (no BS edition)', status: 'PUBLISHED', format: 'Reel', body: 'Wake 6:30, coffee, journaling, then content sprint until 10.' },
    { title: 'The one prompt that changed my workflow', status: 'APPROVED', format: 'Reel', body: 'Hook: One AI prompt that 10x\'d my output\n\nBody: Reveal prompt template + walk through example.\n\nCTA: Reply "PROMPT" for the full PDF.' },
  ];

  for (const s of scripts) {
    if ((s.status as string) === 'IDEA') continue; // ContentPiece-only seed; skip from Script.
    await prisma.script.create({
      data: {
        organizationId: orgId,
        userId,
        title: s.title,
        body: s.body,
        format: s.format,
        status: s.status as any,
        feedback: (s as any).feedback ?? null,
      },
    });
  }
}

async function seedContentPieces(orgId: string) {
  const approvedScripts = await prisma.script.findMany({
    where: { organizationId: orgId, status: { in: ['APPROVED', 'SCHEDULED', 'PUBLISHED'] } },
    take: 6,
  });

  const pieces: Array<{
    title: string;
    status: 'IDEA' | 'FILMING' | 'EDITING' | 'READY' | 'SCHEDULED' | 'PUBLISHED';
    scriptId?: string;
  }> = [
    { title: 'Reading mean comments', status: 'IDEA' },
    { title: 'Behind the scenes — Bloom campaign', status: 'FILMING', scriptId: approvedScripts[0]?.id },
    { title: 'The one prompt that changed my workflow', status: 'EDITING', scriptId: approvedScripts[1]?.id },
    { title: 'My morning routine (no BS edition)', status: 'READY', scriptId: approvedScripts[2]?.id },
    { title: 'Three product unboxings in 60s', status: 'SCHEDULED', scriptId: approvedScripts[3]?.id },
    { title: '5 lighting mistakes that ruin reels', status: 'PUBLISHED', scriptId: approvedScripts[4]?.id },
  ];

  for (const p of pieces) {
    await prisma.contentPiece.create({
      data: {
        organizationId: orgId,
        scriptId: p.scriptId ?? null,
        title: p.title,
        status: p.status,
        format: 'Reel',
        hook: 'Your reel looks amateur because of THIS one light',
        body: 'Walk through the mistakes with quick visuals.',
        cta: 'Comment "LIGHT" for the setup PDF.',
        caption: 'Save this before your next shoot.',
        hashtags: ['#contentcreator', '#filmmaking', '#reels', '#lightingtips'],
        checklist: {
          film: p.status !== 'IDEA',
          edit: ['EDITING', 'READY', 'SCHEDULED', 'PUBLISHED'].includes(p.status),
          captions: ['READY', 'SCHEDULED', 'PUBLISHED'].includes(p.status),
          finalReview: ['SCHEDULED', 'PUBLISHED'].includes(p.status),
        },
        scheduledAt: p.status === 'SCHEDULED' ? daysFromNow(2) : null,
        publishedAt: p.status === 'PUBLISHED' ? daysFromNow(-3) : null,
      },
    });
  }
}

async function seedInfluencerSelf(orgId: string, name: string) {
  return prisma.influencer.create({
    data: {
      organizationId: orgId,
      name,
      handle: '@ariavance',
      platform: 'instagram',
      followers: 128_420,
      engagement: 5.8,
      email: SEED_EMAIL,
      notes: 'The creator (self). All deals flow through this profile.',
    },
  });
}

async function seedDealsAndActivities(orgId: string, influencerId: string) {
  const deals: Array<{
    brand: string;
    offer: number;
    floor: number;
    ceiling: number;
    stage: Stage;
    deadlineDays: number | null;
    notes: string;
  }> = [
    { brand: 'Bloom & Co.', offer: 4200, floor: 3500, ceiling: 5500, stage: 'LEAD', deadlineDays: 18, notes: 'Reel + 2 stories. Floral brand, organic angle.' },
    { brand: 'Northwind Audio', offer: 6500, floor: 5500, ceiling: 8000, stage: 'PROPOSAL_SENT', deadlineDays: 14, notes: 'Brand integration, headphones. Wants 1 reel + carousel.' },
    { brand: 'Lumen Skincare', offer: 5200, floor: 4500, ceiling: 6500, stage: 'NEGOTIATING', deadlineDays: 12, notes: 'Counter at 6k pending. Their first creator deal of Q2.' },
    { brand: 'Halo Fitness', offer: 3800, floor: 3000, ceiling: 4500, stage: 'CONTRACT', deadlineDays: 10, notes: 'Reel only. Contract sent to legal yesterday.' },
    { brand: 'Verge Watches', offer: 8400, floor: 7000, ceiling: 10000, stage: 'PAYMENT', deadlineDays: 6, notes: 'Big one. Payment pending; reel published.' },
    { brand: 'Wildgrain', offer: 2900, floor: 2200, ceiling: 3500, stage: 'COMPLETED', deadlineDays: -8, notes: 'Done and paid. Loved the work, repeat opp Q3.' },
    { brand: 'Stellar Bags', offer: 5500, floor: 4000, ceiling: 6500, stage: 'LEAD', deadlineDays: 22, notes: 'Reached out via DM. Need to qualify.' },
    { brand: 'Pulse Coffee', offer: 4400, floor: 3500, ceiling: 5200, stage: 'NEGOTIATING', deadlineDays: 9, notes: 'They want exclusivity in beverage cat — bumping for 2k.' },
    { brand: 'Helix Bikes', offer: 7200, floor: 6000, ceiling: 9000, stage: 'PROPOSAL_SENT', deadlineDays: 16, notes: 'Pitched 2 reels + 1 carousel. Awaiting confirm.' },
    { brand: 'Atlas Cookware', offer: 3600, floor: 2800, ceiling: 4200, stage: 'CONTRACT', deadlineDays: 8, notes: 'Contract pending signatures both sides.' },
  ];

  for (const d of deals) {
    const deal = await prisma.deal.create({
      data: {
        organizationId: orgId,
        influencerId,
        brand: d.brand,
        offer: d.offer,
        floor: d.floor,
        ceiling: d.ceiling,
        deadline: d.deadlineDays != null ? daysFromNow(d.deadlineDays) : null,
        stage: d.stage,
        notes: d.notes,
      },
    });
    await prisma.dealActivity.createMany({
      data: [
        {
          organizationId: orgId,
          dealId: deal.id,
          kind: 'NOTE',
          body: d.notes,
          authorName: 'Aria',
        },
        ...(d.stage !== 'LEAD'
          ? [
              {
                organizationId: orgId,
                dealId: deal.id,
                kind: 'STAGE_CHANGE' as const,
                body: `Moved to ${d.stage.toLowerCase()}`,
                authorName: 'AI manager',
                meta: { from: 'LEAD', to: d.stage } as any,
              },
            ]
          : []),
        ...(d.stage === 'NEGOTIATING'
          ? [
              {
                organizationId: orgId,
                dealId: deal.id,
                kind: 'OFFER_CHANGE' as const,
                body: `Counter at $${d.ceiling.toLocaleString()} sent.`,
                authorName: 'AI manager',
                meta: { from: d.offer, to: d.ceiling } as any,
              },
            ]
          : []),
        ...(d.stage === 'PAYMENT' || d.stage === 'COMPLETED'
          ? [
              {
                organizationId: orgId,
                dealId: deal.id,
                kind: 'EMAIL_SENT' as const,
                body: 'Invoice + delivery receipt emailed.',
                authorName: 'AI manager',
              },
            ]
          : []),
      ],
    });
  }
}

async function seedBrandCommercialsAndPayments(orgId: string, influencerId: string) {
  const deals = await prisma.deal.findMany({ where: { organizationId: orgId }, take: 10 });

  // 15 commercials across the 10 deals (some deals have multiple deliverables).
  const dist = [
    { dealIdx: 0, amount: 4200, dueDays: 30, status: 'PENDING' },
    { dealIdx: 1, amount: 6500, dueDays: 28, status: 'PENDING' },
    { dealIdx: 2, amount: 5200, dueDays: 25, status: 'INVOICED' },
    { dealIdx: 2, amount: 1800, dueDays: 25, status: 'INVOICED' },
    { dealIdx: 3, amount: 3800, dueDays: 20, status: 'INVOICED' },
    { dealIdx: 4, amount: 8400, dueDays: 5, status: 'INVOICED' },
    { dealIdx: 4, amount: 1200, dueDays: 12, status: 'PENDING' },
    { dealIdx: 5, amount: 2900, dueDays: -3, status: 'PAID' },
    { dealIdx: 5, amount: 600, dueDays: -3, status: 'PAID' },
    { dealIdx: 6, amount: 5500, dueDays: 30, status: 'PENDING' },
    { dealIdx: 7, amount: 4400, dueDays: 22, status: 'PENDING' },
    { dealIdx: 8, amount: 7200, dueDays: 30, status: 'PENDING' },
    { dealIdx: 9, amount: 3600, dueDays: 18, status: 'PENDING' },
    { dealIdx: 9, amount: 800, dueDays: -10, status: 'OVERDUE' },
    { dealIdx: 4, amount: 400, dueDays: -8, status: 'OVERDUE' },
  ];

  for (const c of dist) {
    const deal = deals[c.dealIdx];
    if (!deal) continue;
    const bc = await prisma.brandCommercial.create({
      data: {
        organizationId: orgId,
        influencerId,
        dealId: deal.id,
        brand: deal.brand,
        description: `${deal.brand} — deliverable`,
        amount: c.amount,
        currency: 'USD',
        dueAt: daysFromNow(c.dueDays),
        invoicedAt: c.status === 'INVOICED' || c.status === 'PAID' || c.status === 'OVERDUE' ? daysFromNow(-5) : null,
        paidAt: c.status === 'PAID' ? daysFromNow(c.dueDays + 1) : null,
        paymentStatus: c.status as any,
      },
    });

    if (c.status === 'PAID') {
      await prisma.payment.create({
        data: {
          organizationId: orgId,
          brandCommercialId: bc.id,
          amount: c.amount,
          currency: 'USD',
          paidAt: daysFromNow(c.dueDays + 1),
          method: 'Wire',
          reference: `WIRE-${Math.floor(Math.random() * 1e7)}`,
        },
      });
    }

    if (c.status === 'OVERDUE') {
      await prisma.paymentReminder.create({
        data: {
          organizationId: orgId,
          brandCommercialId: bc.id,
          channel: 'EMAIL',
          subject: `Friendly nudge — invoice for ${deal.brand}`,
          body: 'Following up on the outstanding invoice. Let me know if anything is blocking.',
        },
      });
    }
  }
}

async function seedContracts(orgId: string, influencerId: string) {
  const deals = await prisma.deal.findMany({ where: { organizationId: orgId }, take: 6 });
  const contracts = [
    { brand: 'Bloom & Co.', templateName: 'Standard Reel', status: 'DRAFT' as const, expiresIn: 60 },
    { brand: 'Northwind Audio', templateName: 'Brand Integration', status: 'SENT' as const, expiresIn: 45 },
    { brand: 'Halo Fitness', templateName: 'Standard Reel', status: 'SENT' as const, expiresIn: 30 },
    { brand: 'Verge Watches', templateName: 'Premium Campaign', status: 'SIGNED' as const, expiresIn: 90 },
    { brand: 'Wildgrain', templateName: 'Standard Reel', status: 'SIGNED' as const, expiresIn: -10 },
  ];

  for (let i = 0; i < contracts.length; i++) {
    const c = contracts[i];
    await prisma.contract.create({
      data: {
        organizationId: orgId,
        influencerId,
        dealId: deals[i]?.id ?? null,
        brand: c.brand,
        templateName: c.templateName,
        status: c.status,
        sentAt: c.status !== 'DRAFT' ? daysFromNow(-5) : null,
        signedAt: c.status === 'SIGNED' ? daysFromNow(-3) : null,
        expiresAt: daysFromNow(c.expiresIn),
      },
    });
  }
}

async function seedEmailTemplates(orgId: string) {
  const templates = [
    { name: 'Interested', kind: 'INTERESTED', subject: 'Re: collab opportunity', body: 'Hi {{firstName}},\n\nLove the brand — interested in chatting. My usual rate for a reel + 2 stories is around $4,500 with a 7-day timeline. Happy to send over a proposal once you confirm the deliverables and timing.\n\nBest,\nAria' },
    { name: 'Not Interested', kind: 'NOT_INTERESTED', subject: 'Re: collab opportunity', body: 'Hi {{firstName}},\n\nThanks for thinking of me — this one isn\'t quite the fit. Best of luck with the campaign, and feel free to reach out for future projects.\n\nBest,\nAria' },
    { name: 'Counter Offer', kind: 'COUNTER_OFFER', subject: 'Re: collab opportunity', body: 'Hi {{firstName}},\n\nGreat to connect. Given the deliverables and exclusivity, my rate would be $6,500. I can move on $6,000 if we keep the timeline at 2 weeks. Let me know what works.\n\nBest,\nAria' },
    { name: 'Follow Up', kind: 'FOLLOW_UP', subject: 'Quick follow up', body: 'Hi {{firstName}},\n\nWanted to gently follow up on my last note — still excited about this. Anything I can answer?\n\nBest,\nAria' },
    { name: 'Payment Reminder', kind: 'PAYMENT_REMINDER', subject: 'Friendly nudge — invoice {{invoiceId}}', body: 'Hi {{firstName}},\n\nFollowing up on invoice {{invoiceId}}, dated {{invoiceDate}}. Let me know if anything is blocking on your side — happy to resend the W-9 or update the PO.\n\nBest,\nAria' },
  ];

  for (const t of templates) {
    await prisma.emailTemplate.create({
      data: {
        organizationId: orgId,
        name: t.name,
        kind: t.kind as any,
        subject: t.subject,
        body: t.body,
        isDefault: true,
      },
    });
  }
}

async function seedScheduledPosts(orgId: string, influencerId: string) {
  const posts = [
    { caption: 'Three product unboxings in 60s', kind: 'REEL', days: 2, status: 'SCHEDULED' },
    { caption: 'The one prompt that changed my workflow', kind: 'REEL', days: 4, status: 'SCHEDULED' },
    { caption: 'My morning routine (no BS edition)', kind: 'REEL', days: 6, status: 'SCHEDULED' },
    { caption: 'Behind the scenes — Bloom campaign', kind: 'CAROUSEL', days: 10, status: 'DRAFT' },
    { caption: '5 lighting mistakes that ruin reels', kind: 'REEL', days: -3, status: 'PUBLISHED' },
    { caption: 'Day in the life: solo creator + AI manager', kind: 'STORY', days: -7, status: 'PUBLISHED' },
  ];

  for (const p of posts) {
    await prisma.scheduledPost.create({
      data: {
        organizationId: orgId,
        influencerId,
        caption: p.caption,
        kind: p.kind as any,
        platforms: ['instagram', 'tiktok'],
        scheduledAt: daysFromNow(p.days),
        publishedAt: p.status === 'PUBLISHED' ? daysFromNow(p.days) : null,
        status: p.status as any,
      },
    });
  }
}

async function main() {
  console.log('Seeding Illuminati Media demo data...');
  const { org, user } = await upsertUserAndOrg();
  console.log(`  Org: ${org.name} (${org.id})`);
  console.log(`  User: ${user.email} (id=${user.id})`);

  await clearManagerData(org.id);

  await seedCompetitors(org.id);
  await seedRateCard(org.id);
  await seedScripts(org.id, user.id);
  await seedContentPieces(org.id);
  const me = await seedInfluencerSelf(org.id, `${user.name} ${user.lastName}`);
  await seedDealsAndActivities(org.id, me.id);
  await seedBrandCommercialsAndPayments(org.id, me.id);
  await seedContracts(org.id, me.id);
  await seedEmailTemplates(org.id);
  await seedScheduledPosts(org.id, me.id);

  const counts = {
    competitors: await prisma.competitor.count({ where: { organizationId: org.id } }),
    scripts: await prisma.script.count({ where: { organizationId: org.id } }),
    contentPieces: await prisma.contentPiece.count({ where: { organizationId: org.id } }),
    deals: await prisma.deal.count({ where: { organizationId: org.id } }),
    dealActivities: await prisma.dealActivity.count({ where: { organizationId: org.id } }),
    commercials: await prisma.brandCommercial.count({ where: { organizationId: org.id } }),
    payments: await prisma.payment.count({ where: { organizationId: org.id } }),
    contracts: await prisma.contract.count({ where: { organizationId: org.id } }),
    templates: await prisma.emailTemplate.count({ where: { organizationId: org.id } }),
    scheduledPosts: await prisma.scheduledPost.count({ where: { organizationId: org.id } }),
  };
  console.log('Seed counts:', counts);
  console.log(`\nLogin:\n  Email:    ${SEED_EMAIL}\n  Password: ${SEED_PASSWORD}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
