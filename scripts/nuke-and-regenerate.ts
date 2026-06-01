import { PrismaClient } from "@prisma/client";
import { extractTags, buildCorpus } from "../lib/tags";

const prisma = new PrismaClient();
const BATCH_SIZE = 1000;

function generateId(): string {
  return Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, "0")
  ).join("");
}

async function main() {
  console.log("Deleting all tags and videoTags...");
  await prisma.videoTag.deleteMany({});
  await prisma.tag.deleteMany({});
  console.log("Deleted all existing tags.");

  const videos = await prisma.video.findMany({
    select: { id: true, title: true, description: true, transcript: true },
  });

  if (videos.length === 0) {
    console.log("No videos to process");
    return;
  }

  console.log(`Building corpus from ${videos.length} videos...`);
  const corpus = buildCorpus(videos);
  console.log(`Corpus: ${corpus.size} phrases`);

  console.log(`Processing ${videos.length} videos in batches of ${BATCH_SIZE}...`);

  for (let b = 0; b < videos.length; b += BATCH_SIZE) {
    const batch = videos.slice(b, b + BATCH_SIZE);

    const tagAssignments: { videoId: string; name: string; score: number }[] = [];
    for (const video of batch) {
      const extracted = extractTags(video.title, video.description, video.transcript, {
        maxTags: 8,
        corpusPhrases: corpus,
      });
      for (const t of extracted) {
        tagAssignments.push({ videoId: video.id, name: t.name, score: t.score });
      }
    }

    if (tagAssignments.length === 0) continue;

    const uniqueNames = [...new Set(tagAssignments.map((t) => t.name))];

    // Bulk insert tags via raw SQL (INSERT OR IGNORE)
    const tagValues = uniqueNames
      .map((name) => `('${generateId()}', '${name.replace(/'/g, "''")}')`)
      .join(",");
    await prisma.$executeRawUnsafe(
      `INSERT OR IGNORE INTO "Tag" ("id", "name") VALUES ${tagValues}`
    );

    // Get tag IDs
    const tagList = await prisma.$queryRawUnsafe<
      { id: string; name: string }[]
    >(
      `SELECT "id", "name" FROM "Tag" WHERE "name" IN (${uniqueNames
        .map((n) => `'${n.replace(/'/g, "''")}'`)
        .join(",")})`
    );
    const tagMap = new Map(tagList.map((t) => [t.name, t.id]));

    // Bulk insert videoTags
    const vtValues = tagAssignments
      .map(
        (t) =>
          `('${generateId()}', '${t.videoId}', '${tagMap.get(t.name)}', ${t.score})`
      )
      .join(",");
    await prisma.$executeRawUnsafe(
      `INSERT INTO "VideoTag" ("id", "videoId", "tagId", "score") VALUES ${vtValues}`
    );

    console.log(`  ${Math.min(b + BATCH_SIZE, videos.length)}/${videos.length}`);
  }

  console.log("Done!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
