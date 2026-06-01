import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Find all videos that are shorts (≤60 seconds)
  const shorts = await prisma.video.findMany({
    where: {
      durationSec: { lte: 60 },
    },
    select: { id: true, title: true, durationSec: true },
  });

  if (shorts.length === 0) {
    console.log("No shorts found in the database.");
    return;
  }

  console.log(`Found ${shorts.length} short(s) to remove:`);
  for (const s of shorts.slice(0, 20)) {
    console.log(`  - "${s.title}" (${s.durationSec}s)`);
  }
  if (shorts.length > 20) {
    console.log(`  ... and ${shorts.length - 20} more`);
  }

  // Delete them (cascades to VideoTag and UserVideo via onDelete: Cascade)
  const result = await prisma.video.deleteMany({
    where: { id: { in: shorts.map((s) => s.id) } },
  });

  console.log(`\nDeleted ${result.count} short(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
