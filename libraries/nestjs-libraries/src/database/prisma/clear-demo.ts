/**
 * One-shot: clear every demo row attached to the seeded org while leaving the
 * User, UserOrganization, and Organization records intact. Run with:
 *
 *   pnpm dlx ts-node --compiler-options '{"module":"CommonJS"}' \
 *     libraries/nestjs-libraries/src/database/prisma/clear-demo.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ORG_ID = 'seed-org-illuminati';

async function main() {
  console.log(`Clearing demo data for org ${ORG_ID}…`);
  // Delete order respects FK constraints: leaf rows first, then parents.
  const ops: Array<[string, () => Promise<{ count: number }>]> = [
    ['dealActivity',     () => prisma.dealActivity.deleteMany({ where: { organizationId: ORG_ID } })],
    ['payment',          () => prisma.payment.deleteMany({ where: { organizationId: ORG_ID } })],
    ['paymentReminder',  () => prisma.paymentReminder.deleteMany({ where: { organizationId: ORG_ID } })],
    ['brandCommercial',  () => prisma.brandCommercial.deleteMany({ where: { organizationId: ORG_ID } })],
    ['contract',         () => prisma.contract.deleteMany({ where: { organizationId: ORG_ID } })],
    ['deal',             () => prisma.deal.deleteMany({ where: { organizationId: ORG_ID } })],
    ['scheduledPost',    () => prisma.scheduledPost.deleteMany({ where: { organizationId: ORG_ID } })],
    ['contentPiece',     () => prisma.contentPiece.deleteMany({ where: { organizationId: ORG_ID } })],
    ['script',           () => prisma.script.deleteMany({ where: { organizationId: ORG_ID } })],
    ['competitor',       () => prisma.competitor.deleteMany({ where: { organizationId: ORG_ID } })],
    ['emailTemplate',    () => prisma.emailTemplate.deleteMany({ where: { organizationId: ORG_ID } })],
    ['rateCard',         () => prisma.rateCard.deleteMany({ where: { organizationId: ORG_ID } })],
    ['influencer',       () => prisma.influencer.deleteMany({ where: { organizationId: ORG_ID } })],
  ];

  for (const [name, op] of ops) {
    const r = await op();
    console.log(`  ${name.padEnd(20)} deleted ${r.count}`);
  }

  // Sanity check: confirm User + Organization survived.
  const users = await prisma.user.count();
  const orgs = await prisma.organization.count({ where: { id: ORG_ID } });
  console.log(`\nRemaining: ${users} user(s), ${orgs} org row for ${ORG_ID}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
