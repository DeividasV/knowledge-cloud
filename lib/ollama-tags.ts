"use server";

export interface TagResult {
  name: string;
  score: number;
}

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const DEFAULT_MODEL = "qwen3:8b";

/**
 * Extract meaningful topic tags from video text using a local LLM via Ollama.
 * Returns tags with dynamically determined relevance scores.
 * Falls back to null if Ollama is not available or the model is not loaded.
 */
export async function extractTagsWithOllama(
  title: string,
  transcript: string | null,
  extractLimit = 15
): Promise<TagResult[] | null> {
  const model = process.env.OLLAMA_MODEL || DEFAULT_MODEL;

  // Check if Ollama is reachable
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    const hasModel = data.models?.some((m) => m.name === model || m.name.startsWith(model + ":"));
    if (!hasModel) return null;
  } catch {
    return null;
  }

  const context = buildPromptContext(title, transcript);

  const prompt = `You are a topic tag extractor. Given a video title and transcript, produce up to ${extractLimit} tags that name the central topics, concepts, people, technologies, or domains discussed.

RULES:
1. QUANTITY: Return as many relevant tags as possible, up to ${extractLimit}. Do NOT pad with weak tags just to hit a number. A video about one narrow topic may have only 3-5 tags; a broad-ranging video may have 20+. Let the content decide.
2. CENTRAL THEMES ONLY: Tag what the video is ABOUT, not every noun that appears. If "Australia" is only mentioned in a passing anecdote, do NOT tag it. If a person is only named once in an example, do NOT tag them.
3. SPECIFIC OVER GENERIC: "neural networks" > "technology"; "quantum entanglement" > "science"; "D-Day landings" > "history".
4. MULTI-WORD: Use multi-word tags for any concept that needs more than one word. Tags MUST have spaces between words. NEVER concatenate or hyphenate: "machine learning" not "machinelearning" or "machine-learning".
5. NORMALIZE: All tags lowercase, trimmed. One canonical form per concept — no near-duplicates like "ai" and "artificial intelligence" in the same list; pick the clearest.
6. LANGUAGE: Output tags in the SAME language as the video's primary language. If the video is mostly Russian, tags must be Russian. If mostly English, tags must be English. Never mix languages in the same tag list.
7. NO PROHIBITED ITEMS: No generic phrases ("in this video", "let's talk"), no sentence fragments, no timestamps, no numbers as standalone tags, no emotional reactions ("amazing", "shocking"), no speaker names unless they are the subject.
8. SCORING: Assign each tag a relevance score from 0.00 to 1.00. Be BRUTALLY honest — do NOT space scores evenly:
   - 0.90-1.00 = central theme, what the video is primarily about (1-3 tags max)
   - 0.70-0.89 = important sub-topic (2-4 tags max)
   - 0.50-0.69 = secondary, mentioned but not central (a few tags)
   - 0.30-0.49 = tangential, barely relevant (rarely include)
   - below 0.30 = do not include
   Most videos should have a CLEAR gap between strong tags (0.70+) and weak tags (0.50-). Do NOT give 15 tags all between 0.50 and 0.95 — that defeats the purpose.
9. FORMAT: Output ONLY a JSON array of objects. Each object has "tag" (string) and "relevance" (number). No markdown, no code fences, no prose.

Example:
[
  {"tag": "neural networks", "relevance": 0.95},
  {"tag": "deep learning", "relevance": 0.88},
  {"tag": "python", "relevance": 0.62}
]

${context}

Output:`;

  try {
    const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        think: false,
        keep_alive: "30m",
        options: {
          temperature: 0.3,
          num_predict: 600,
        },
      }),
      signal: AbortSignal.timeout(180000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { response?: string };
    const raw = (data.response?.trim() || "")
      .replace(/^```json\s*/i, "")
      .replace(/\s*```$/i, "");

    // Try to parse as array of objects with relevance scores
    let tags = parseScoredTags(raw);

    // Fallback: try old string-array format
    if (tags.length === 0) {
      tags = parseStringTags(raw);
    }

    if (tags.length === 0) return null;

    // Clean and deduplicate
    const cleaned = tags
      .map((t) => ({
        name: cleanTag(t.name),
        score: Math.max(0, Math.min(1, t.score)),
      }))
      .filter((t) => t.name.length >= 2 && t.name.length <= 40)
      .filter((t) => !isGenericFiller(t.name));

    const deduped = deduplicateTags(cleaned);

    // Dynamic selection based on score distribution (elbow method)
    return selectTagsByScore(deduped);
  } catch {
    return null;
  }
}

function parseScoredTags(raw: string): TagResult[] {
  const jsonMatch = raw.match(/\[[\s\S]*?\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item: unknown) => item && typeof item === "object")
      .map((item: Record<string, unknown>) => ({
        name: String(item.tag ?? item.name ?? ""),
        score: Number(item.relevance ?? item.score ?? item.confidence ?? 0.5),
      }))
      .filter((t) => t.name.length > 0);
  } catch {
    return [];
  }
}

function parseStringTags(raw: string): TagResult[] {
  const jsonMatch = raw.match(/\[[\s\S]*?\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item: unknown) => typeof item === "string")
      .map((name: string, i: number) => ({
        name,
        score: Math.max(0.1, 0.9 - i * 0.05),
      }));
  } catch {
    return [];
  }
}

function cleanTag(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/^["']|["']$/g, "")
    .replace(/[\[\]()]/g, "")
    .trim()
    .replace(/-/g, " ");
}

function buildPromptContext(title: string, transcript: string | null): string {
  const parts: string[] = [];
  parts.push(`Title: ${title}`);

  if (transcript && transcript.length > 0) {
    const truncated =
      transcript.length > 2000 ? transcript.slice(0, 2000) + "..." : transcript;
    parts.push(`Transcript: ${truncated}`);
  }

  return parts.join("\n");
}

function isGenericFiller(tag: string): boolean {
  const fillers = new Set([
    "video", "youtube", "channel", "today", "talk", "discuss", "look",
    "going", "want", "think", "know", "really", "actually", "basically",
    "literally", "obviously", "amazing", "shocking", "incredible", "awesome",
    "this video", "in this", "we are", "let us", "going to", "talk about",
    "hello everyone", "thanks for", "dont forget", "make sure", "in conclusion",
    "сегодня", "видео", "канал", "ролик", "смотрим", "говорим", "обсудим",
    "давайте", "сейчас", "начнем", "поговорим", "расскажу", "спасибо",
    "всем привет", "не забудьте", "обязательно", "в заключение",
  ]);
  return fillers.has(tag.toLowerCase());
}

/**
 * Normalize near-duplicate tags to a canonical form.
 */
function deduplicateTags(tags: TagResult[]): TagResult[] {
  const seen = new Set<string>();
  const result: TagResult[] = [];

  for (const tag of tags) {
    const normalized = tag.name.toLowerCase().trim();
    const isDuplicate = Array.from(seen).some(
      (s) => s !== normalized && (s.includes(normalized) || normalized.includes(s))
    );
    if (!isDuplicate) {
      result.push(tag);
      seen.add(normalized);
    }
  }

  return result;
}

/**
 * Select tags using a two-pass approach:
 * 1. Look for the latest natural quality drop (elbow) in the score distribution.
 * 2. If scores are evenly spaced (no elbow), fall back to an absolute quality band.
 * This handles both rich videos with clear topic hierarchies AND videos where
 * the LLM spaces scores too evenly.
 */
function selectTagsByScore(tags: TagResult[]): TagResult[] {
  if (tags.length <= 2) return tags;

  // Sort by score descending (best first)
  const sorted = [...tags].sort((a, b) => b.score - a.score);

  // Pass 1: find the latest-occurring meaningful gap (>= 0.06).
  // Scanning from the end keeps more tags while still cutting at a quality drop.
  let cutIdx = sorted.length;
  for (let i = sorted.length - 1; i >= 1; i--) {
    const gap = sorted[i - 1].score - sorted[i].score;
    if (gap >= 0.06) {
      cutIdx = i;
      break;
    }
  }

  if (cutIdx < sorted.length) {
    // Keep at least 4 tags if a gap is found, but respect the cut
    return sorted.slice(0, Math.max(4, cutIdx));
  }

  // Pass 2: no natural gap found (evenly-spaced scores).
  // Use an absolute quality band: keep tags with score >= 0.65.
  const selected = sorted.filter((t) => t.score >= 0.65);

  // Ensure at least 2 tags if available
  if (selected.length < 2 && sorted.length >= 2) {
    return sorted.slice(0, 2);
  }

  return selected;
}

export async function getAvailableOllamaModel(): Promise<string | null> {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    const model = process.env.OLLAMA_MODEL || DEFAULT_MODEL;
    const found = data.models?.find(
      (m) => m.name === model || m.name.startsWith(model + ":")
    );
    return found?.name || null;
  } catch {
    return null;
  }
}
