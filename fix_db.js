const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const cases = await prisma.$queryRaw`SELECT DISTINCT "userId" FROM "LaborCase"`;
    console.log("Distinct userIds in LaborCase:", cases);
    
    // Insert dummy users for those IDs
    for (const c of cases) {
      if (c.userId) {
        await prisma.$executeRaw`INSERT INTO "User" (id, email, "userType", "subscriptionTier", "dailyChatCount", "monthlyDocCount", "monthlyEvidenceCount", "onboardingCompleted", "createdAt", "updatedAt") 
        VALUES (${c.userId}, ${c.userId + '@dummy.com'}, 'PERSONAL', 'FREE', 0, 0, 0, false, NOW(), NOW()) ON CONFLICT DO NOTHING`;
        console.log("Inserted dummy user: ", c.userId);
      }
    }
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
