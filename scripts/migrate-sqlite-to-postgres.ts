import { PrismaClient } from "@prisma/client";
import { DatabaseSync } from "node:sqlite";
import { join } from "path";

const sqlitePath = process.env.SQLITE_PATH ?? join(process.cwd(), "prisma", "dev.db");
const sqlite = new DatabaseSync(sqlitePath);
const prisma = new PrismaClient();

function asBool(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  return value === 1 || value === true || value === "1";
}

function asDateTime(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return new Date(value).toISOString();
  if (typeof value === "string") return new Date(value).toISOString();
  return null;
}

function rows(table: string): Record<string, unknown>[] {
  const stmt = sqlite.prepare(`SELECT * FROM "${table}"`);
  return stmt.all() as Record<string, unknown>[];
}

async function main() {
  console.log(`Migrating data from ${sqlitePath} to PostgreSQL...`);

  // 1. Tables without foreign keys
  const users = rows("User").map((r) => ({
    id: r.id as string,
    email: r.email as string,
    emailVerified: asDateTime(r.emailVerified),
    name: (r.name as string | null) ?? null,
    image: (r.image as string | null) ?? null,
    password: (r.password as string | null) ?? null,
    lastSyncAt: asDateTime(r.lastSyncAt),
    maxTagsPerVideo: r.maxTagsPerVideo as number,
    maxVideosPerChannelSync: r.maxVideosPerChannelSync as number,
    minVideoDurationSec: r.minVideoDurationSec as number,
    tagExtractionMethod: r.tagExtractionMethod as string,
    tagBatchMode: r.tagBatchMode as string,
    geminiModel: r.geminiModel as string,
    ollamaMaxChunks: r.ollamaMaxChunks as number,
    tagLanguage: r.tagLanguage as string,
    selectedCategory: (r.selectedCategory as string | null) ?? null,
    createdAt: asDateTime(r.createdAt) as string,
  }));

  const channels = rows("Channel").map((r) => ({
    id: r.id as string,
    title: r.title as string,
    thumbnail: (r.thumbnail as string | null) ?? null,
    uploadsPlaylistId: (r.uploadsPlaylistId as string | null) ?? null,
    subscriberCount: (r.subscriberCount as number | null) ?? null,
    videoCount: (r.videoCount as number | null) ?? null,
    viewCount: (r.viewCount as number | null) ?? null,
    lastSyncedAt: asDateTime(r.lastSyncedAt),
  }));

  const categories = rows("Category").map((r) => ({
    id: r.id as string,
    name: r.name as string,
  }));

  const tags = rows("Tag").map((r) => ({
    id: r.id as string,
    name: r.name as string,
  }));

  // 2. Tables with foreign keys to the above
  const accounts = rows("Account").map((r) => ({
    id: r.id as string,
    userId: r.userId as string,
    type: r.type as string,
    provider: r.provider as string,
    providerAccountId: r.providerAccountId as string,
    refresh_token: (r.refresh_token as string | null) ?? null,
    access_token: (r.access_token as string | null) ?? null,
    expires_at: (r.expires_at as number | null) ?? null,
    token_type: (r.token_type as string | null) ?? null,
    scope: (r.scope as string | null) ?? null,
    id_token: (r.id_token as string | null) ?? null,
    session_state: (r.session_state as string | null) ?? null,
  }));

  const sessions = rows("Session").map((r) => ({
    id: r.id as string,
    sessionToken: r.sessionToken as string,
    userId: r.userId as string,
    expires: asDateTime(r.expires) as string,
  }));

  const videos = rows("Video").map((r) => ({
    id: r.id as string,
    title: r.title as string,
    description: (r.description as string | null) ?? null,
    thumbnail: (r.thumbnail as string | null) ?? null,
    durationSec: (r.durationSec as number | null) ?? null,
    viewCount: (r.viewCount as number | null) ?? null,
    likeCount: (r.likeCount as number | null) ?? null,
    commentCount: (r.commentCount as number | null) ?? null,
    youtubeTags: (r.youtubeTags as string | null) ?? null,
    publishedAt: asDateTime(r.publishedAt) as string,
    channelId: (r.channelId as string | null) ?? null,
    transcript: (r.transcript as string | null) ?? null,
    transcriptFetchedAt: asDateTime(r.transcriptFetchedAt),
    category: (r.category as string | null) ?? null,
  }));

  // 3. Junction / dependent tables
  const videoTags = rows("VideoTag").map((r) => ({
    id: r.id as string,
    videoId: r.videoId as string,
    tagId: r.tagId as string,
    score: r.score as number,
  }));

  const userVideos = rows("UserVideo").map((r) => ({
    id: r.id as string,
    userId: r.userId as string,
    videoId: r.videoId as string,
    status: r.status as string,
    progressSec: r.progressSec as number,
    addedStandalone: asBool(r.addedStandalone) as boolean,
    updatedAt: asDateTime(r.updatedAt) as string,
  }));

  // 4. Prisma implicit many-to-many tables
  const channelToUser = rows("_ChannelToUser").map((r) => ({
    A: r.A as string,
    B: r.B as string,
  }));

  const categoryToChannel = rows("_CategoryToChannel").map((r) => ({
    A: r.A as string,
    B: r.B as string,
  }));

  // Insert in dependency order
  console.log(`Migrating ${users.length} users...`);
  if (users.length) {
    await prisma.user.createMany({ data: users, skipDuplicates: true });
  }

  console.log(`Migrating ${channels.length} channels...`);
  if (channels.length) {
    await prisma.channel.createMany({ data: channels, skipDuplicates: true });
  }

  console.log(`Migrating ${categories.length} categories...`);
  if (categories.length) {
    await prisma.category.createMany({ data: categories, skipDuplicates: true });
  }

  console.log(`Migrating ${tags.length} tags...`);
  if (tags.length) {
    await prisma.tag.createMany({ data: tags, skipDuplicates: true });
  }

  console.log(`Migrating ${accounts.length} accounts...`);
  if (accounts.length) {
    await prisma.account.createMany({ data: accounts, skipDuplicates: true });
  }

  console.log(`Migrating ${sessions.length} sessions...`);
  if (sessions.length) {
    await prisma.session.createMany({ data: sessions, skipDuplicates: true });
  }

  console.log(`Migrating ${videos.length} videos...`);
  if (videos.length) {
    await prisma.video.createMany({ data: videos, skipDuplicates: true });
  }

  console.log(`Migrating ${videoTags.length} video tags...`);
  if (videoTags.length) {
    await prisma.videoTag.createMany({ data: videoTags, skipDuplicates: true });
  }

  console.log(`Migrating ${userVideos.length} user videos...`);
  if (userVideos.length) {
    await prisma.userVideo.createMany({ data: userVideos, skipDuplicates: true });
  }

  console.log(`Migrating ${channelToUser.length} channel-user relations...`);
  for (const row of channelToUser) {
    await prisma.$executeRaw`INSERT INTO "_ChannelToUser" ("A", "B") VALUES (${row.A}, ${row.B}) ON CONFLICT DO NOTHING`;
  }

  console.log(`Migrating ${categoryToChannel.length} category-channel relations...`);
  for (const row of categoryToChannel) {
    await prisma.$executeRaw`INSERT INTO "_CategoryToChannel" ("A", "B") VALUES (${row.A}, ${row.B}) ON CONFLICT DO NOTHING`;
  }

  console.log("Migration complete.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
    sqlite.close();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    sqlite.close();
    process.exit(1);
  });
