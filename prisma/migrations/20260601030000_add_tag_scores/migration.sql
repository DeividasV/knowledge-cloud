-- Create VideoTag table with explicit score
CREATE TABLE "VideoTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "score" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "VideoTag_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VideoTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Migrate existing relations from implicit _TagToVideo with default score 0
INSERT INTO "VideoTag" ("id", "videoId", "tagId", "score")
SELECT lower(hex(randomblob(16))), "B", "A", 0 FROM "_TagToVideo";

-- Create unique index on videoId + tagId
CREATE UNIQUE INDEX "VideoTag_videoId_tagId_key" ON "VideoTag"("videoId", "tagId");

-- Drop old implicit relation table
DROP TABLE "_TagToVideo";
