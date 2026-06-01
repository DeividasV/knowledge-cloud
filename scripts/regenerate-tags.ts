import { PrismaClient } from "@prisma/client";
import { extractTags, buildCorpus } from "../lib/tags";

const prisma = new PrismaClient();
const BATCH_SIZE = 500;

async function main() {
  const videos = await prisma.video.findMany({
    select: { id: true, title: true, description: true, transcript: true },
  });

  if (videos.length === 0) {
    console.log("No videos to process");
    return;
  }

  console.log(`Building corpus from ${videos.length} videos...`);
  const corpus = buildCorpus(videos);
  console.log(`Corpus built: ${corpus.size} phrases`);

  console.log(`Regenerating tags for ${videos.length} videos...`);

  for (let b = 0; b < videos.length; b += BATCH_SIZE) {
    const batch = videos.slice(b, b + BATCH_SIZE);

    // 1. Extract tags for all videos in batch
    const videoTags: { videoId: string; name: string; score: number }[] = [];
    for (const video of batch) {
      const extracted = extractTags(video.title, video.description, video.transcript, {
        maxTags: 8,
        corpusPhrases: corpus,
      });
      for (const t of extracted) {
        videoTags.push({ videoId: video.id, name: t.name, score: t.score });
      }
    }

    if (videoTags.length === 0) continue;

    // 2. Bulk insert tags (ignore duplicates)
    const uniqueTags = [...new Set(videoTags.map((vt) => vt.name))];
    for (const name of uniqueTags) {
      await prisma.tag.upsert({
        where: { name },
        create: { name },
        update: {},
      });
    }

    // 3. Get all tag IDs
    const tags = await prisma.tag.findMany({
      where: { name: { in: uniqueTags } },
      select: { id: true, name: true },
    });
    const tagMap = new Map(tags.map((t) => [t.name, t.id]));

    // 4. Delete old videoTags for this batch
    const videoIds = batch.map((v) => v.id);
    await prisma.videoTag.deleteMany({
      where: { videoId: { in: videoIds } },
    });

    // 5. Bulk create new videoTags
    await prisma.videoTag.createMany({
      data: videoTags.map((vt) => ({
        videoId: vt.videoId,
        tagId: tagMap.get(vt.name)!,
        score: vt.score,
      })),
    });

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
