const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const record = await prisma.mistakeRecord.findFirst({
    orderBy: { createdAt: 'desc' },
    include: {
      student: true,
      stage: {
        include: {
          scenes: true
        }
      }
    }
  });
  
  if (record && record.stage && record.stage.scenes.length > 0) {
    const scene = record.stage.scenes[0];
    const content = scene.content;
    const actions = content.actions || [];
    console.log(JSON.stringify(actions, null, 2));
  } else {
    console.log("No scenes found.");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
