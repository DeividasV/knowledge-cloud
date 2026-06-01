import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Patterns for bad tags to delete
const BAD_PATTERNS = [
  /^\d{2}\s+\d{2}/,        // timestamps: "00 00", "00 37"
  /^\d+\s/,                // starts with number: "00 agent"
  /\bwww\b/,               // contains www
  /\bhttps?\b/,            // contains http/https
  /^\d+$/,                 // pure numbers
  /\d{4,}/,                // 4+ digit sequences
  /[@#]/,                  // social handles
  /\.(com|org|net|io|co|ru|uk|de|fr|jp|cn|ai|app|dev|tv|me|info|biz)$/i,
];

function isBadTag(name: string): boolean {
  return BAD_PATTERNS.some((p) => p.test(name));
}

async function main() {
  const allTags = await prisma.tag.findMany({ select: { id: true, name: true } });
  const badTags = allTags.filter((t) => isBadTag(t.name));

  console.log(`Found ${badTags.length} bad tags out of ${allTags.length} total`);

  if (badTags.length === 0) {
    console.log("No bad tags to clean.");
    return;
  }

  const badIds = badTags.map((t) => t.id);
  const BATCH_SIZE = 500;

  // Delete VideoTag relations in batches
  for (let i = 0; i < badIds.length; i += BATCH_SIZE) {
    const batch = badIds.slice(i, i + BATCH_SIZE);
    await prisma.videoTag.deleteMany({ where: { tagId: { in: batch } } });
    console.log(`  Deleted videoTags batch ${i + 1}-${Math.min(i + BATCH_SIZE, badIds.length)}`);
  }

  // Delete Tags in batches
  for (let i = 0; i < badIds.length; i += BATCH_SIZE) {
    const batch = badIds.slice(i, i + BATCH_SIZE);
    await prisma.tag.deleteMany({ where: { id: { in: batch } } });
    console.log(`  Deleted tags batch ${i + 1}-${Math.min(i + BATCH_SIZE, badIds.length)}`);
  }

  console.log(`Deleted ${badTags.length} bad tags.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
