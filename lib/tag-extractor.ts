import {
  extractTagsWithOllama,
  isOllamaAvailable,
} from "./extractors/ollama";
import {
  extractTagsWithGemini,
  isGeminiConfigured,
} from "./extractors/gemini";
import {
  type TagResult,
  cleanTag,
  deduplicateTags,
  selectTagsByScore,
} from "./extractors/shared";

export type { TagResult };

const FALLBACK_TO_LOCAL =
  process.env.TAG_EXTRACTION_FALLBACK_TO_LOCAL === "true";

function resolveMethod(method?: string): string {
  return method || process.env.TAG_EXTRACTION_METHOD || "ollama";
}

/* ── Chunking config (backend-specific) ─────────────────────────────── */

interface ChunkConfig {
  size: number;      // chars per chunk
  overlap: number;   // chars shared between consecutive chunks
  maxChunks: number; // hard ceiling on API calls
  perChunkLimit: number; // extractLimit passed to each chunk call
}

const CHUNK_CONFIGS: Record<string, ChunkConfig> = {
  ollama: { size: 700, overlap: 200, maxChunks: 3, perChunkLimit: 10 },
  gemini: { size: 1200, overlap: 300, maxChunks: 8, perChunkLimit: 12 },
};

function createChunks(text: string, cfg: ChunkConfig): string[] {
  if (text.length <= cfg.size) return [text];

  // If we'd exceed maxChunks, enlarge chunk size proportionally
  const effective = cfg.size - cfg.overlap;
  const needed = Math.ceil(text.length / effective);
  let size = cfg.size;
  if (needed > cfg.maxChunks) {
    const adjEffective = Math.ceil(text.length / cfg.maxChunks);
    size = adjEffective + cfg.overlap;
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    chunks.push(text.slice(start, end));
    if (end === text.length) break;
    start = end - cfg.overlap;
  }
  return chunks;
}

function mergeChunkResults(allResults: TagResult[][]): TagResult[] {
  const scoreMap = new Map<string, number[]>();

  for (const results of allResults) {
    for (const tag of results) {
      const key = cleanTag(tag.name);
      if (key.length === 0) continue;
      const arr = scoreMap.get(key) || [];
      arr.push(tag.score);
      scoreMap.set(key, arr);
    }
  }

  const merged: TagResult[] = [];
  for (const [name, scores] of scoreMap) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    // Boost score slightly when a tag appears in multiple chunks
    const boost = Math.min(0.03 * (scores.length - 1), 0.12);
    merged.push({ name, score: Math.min(1, avg + boost) });
  }

  return merged;
}

/* ── Main router ────────────────────────────────────────────────────── */

async function extractSingle(
  title: string,
  transcript: string | null,
  method: string
): Promise<TagResult[] | null> {
  if (method === "gemini") {
    if (!isGeminiConfigured()) {
      console.error("[extractVideoTags] Gemini selected but API key missing/invalid");
      return null;
    }
    return extractTagsWithGemini(title, transcript, 15);
  }
  return extractTagsWithOllama(title, transcript, 15);
}

/**
 * Unified tag extraction entry point.
 * Dispatches to Gemini or Ollama based on the `method` parameter.
 * For long transcripts, splits into overlapping chunks, extracts tags from
 * each chunk, then merges and deduplicates the results.
 */
export async function extractVideoTags(
  title: string,
  transcript: string | null,
  method?: string
): Promise<TagResult[] | null> {
  const resolved = resolveMethod(method);
  console.log(`[extractVideoTags] method=${resolved}, title="${title.slice(0, 60)}..."`);

  // No transcript — single-pass extraction
  if (!transcript || transcript.length === 0) {
    return extractSingle(title, null, resolved);
  }

  const cfg = CHUNK_CONFIGS[resolved] ?? CHUNK_CONFIGS.ollama;

  // Short transcript — single pass
  if (transcript.length <= cfg.size) {
    return extractSingle(title, transcript, resolved);
  }

  // Long transcript — chunk and merge
  const chunks = createChunks(transcript, cfg);
  console.log(`[extractVideoTags] Chunking into ${chunks.length} parts (config: ${JSON.stringify(cfg)})`);

  const allResults: TagResult[][] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunkTitle = `${title} [part ${i + 1}/${chunks.length}]`;
    const result = await extractSingle(chunkTitle, chunks[i], resolved);
    if (result && result.length > 0) {
      allResults.push(result);
      console.log(`[extractVideoTags] Chunk ${i + 1}/${chunks.length}: ${result.length} tags`);
    } else {
      console.log(`[extractVideoTags] Chunk ${i + 1}/${chunks.length}: no tags`);
    }
  }

  if (allResults.length === 0) {
    console.error("[extractVideoTags] All chunks returned empty");
    return null;
  }

  const merged = mergeChunkResults(allResults);
  const deduped = deduplicateTags(merged);
  const final = selectTagsByScore(deduped);
  console.log(
    `[extractVideoTags] Merged: ${merged.length} → deduped=${deduped.length} → final=${final.length}`
  );
  return final;
}

/**
 * Quick availability check for the given extraction method.
 */
export async function checkTagExtractionAvailable(
  method?: string
): Promise<boolean> {
  const resolved = resolveMethod(method);

  if (resolved === "gemini") {
    if (isGeminiConfigured()) return true;
    if (FALLBACK_TO_LOCAL) return isOllamaAvailable();
    return false;
  }

  return isOllamaAvailable();
}
