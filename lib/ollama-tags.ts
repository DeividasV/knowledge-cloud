"use server";

export interface TagResult {
  name: string;
  score: number;
}

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const DEFAULT_MODEL = "qwen2.5:3b";

/**
 * Extract meaningful topic tags from video text using a local LLM via Ollama.
 * Falls back to null if Ollama is not available or the model is not loaded.
 */
export async function extractTagsWithOllama(
  title: string,
  transcript: string | null,
  maxTags = 8
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

  const prompt = `You are a topic tag extractor. Given a video title and transcript, produce up to ${maxTags} tags that name the central topics, concepts, people, technologies, or domains discussed.

RULES:
1. QUANTITY: Return BETWEEN 3 and ${maxTags} tags. Fewer is correct when the video has fewer real topics. NEVER pad to hit a number.
2. CENTRAL THEMES ONLY: Tag what the video is ABOUT, not every noun that appears. If "Australia" is only mentioned in a passing anecdote, do NOT tag it. If a person is only named once in an example, do NOT tag them.
3. SPECIFIC OVER GENERIC: "neural networks" > "technology"; "quantum entanglement" > "science"; "D-Day landings" > "history".
4. MULTI-WORD: Use multi-word tags for any concept that needs more than one word. Tags MUST have spaces between words. NEVER concatenate or hyphenate: "machine learning" not "machinelearning" or "machine-learning".
5. NORMALIZE: All tags lowercase, trimmed. One canonical form per concept — no near-duplicates like "ai" and "artificial intelligence" in the same list; pick the clearest.
6. LANGUAGE: Output tags in the SAME language as the video's primary language. If the video is mostly Russian, tags must be Russian. If mostly English, tags must be English. Never mix languages in the same tag list.
7. NO PROHIBITED ITEMS: No generic phrases ("in this video", "let's talk"), no sentence fragments, no timestamps, no numbers as standalone tags, no emotional reactions ("amazing", "shocking"), no speaker names unless they are the subject.
8. FORMAT: Output ONLY a JSON array of strings. No markdown, no code fences, no prose, no numeric scores.

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
        options: {
          temperature: 0.3,
          num_predict: 200,
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { response?: string };
    const raw = data.response?.trim() || "";

    // Extract JSON array from response
    const jsonMatch = raw.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) return null;

    const tags = JSON.parse(jsonMatch[0]) as string[];
    if (!Array.isArray(tags)) return null;

    // Clean and deduplicate
    const cleaned = tags
      .map((t) =>
        t
          .toLowerCase()
          .replace(/^["']|["']$/g, "")
          .replace(/[\[\]()]/g, "")
          .trim()
      )
      .map((t) => splitCamelCase(t))
      .map((t) => t.replace(/-/g, " "))
      .filter((t) => t.length >= 2 && t.length <= 40)
      .filter((t) => !isGenericFiller(t));

    const deduped = deduplicateTags(cleaned);

    // Assign descending scores
    return deduped.slice(0, maxTags).map((name, i) => ({
      name,
      score: Math.round((maxTags - i) * 12.5 * 100) / 100,
    }));
  } catch {
    return null;
  }
}

function buildPromptContext(title: string, transcript: string | null): string {
  const parts: string[] = [];
  parts.push(`Title: ${title}`);

  if (transcript && transcript.length > 0) {
    // Truncate transcript to keep prompt short and fast
    const truncated =
      transcript.length > 2000 ? transcript.slice(0, 2000) + "..." : transcript;
    parts.push(`Transcript: ${truncated}`);
  }

  return parts.join("\n");
}

function isGenericFiller(tag: string): boolean {
  const fillers = new Set([
    // English generic
    "video", "youtube", "channel", "today", "talk", "discuss", "look",
    "going", "want", "think", "know", "really", "actually", "basically",
    "literally", "obviously", "amazing", "shocking", "incredible", "awesome",
    "this video", "in this", "we are", "let us", "going to", "talk about",
    "hello everyone", "thanks for", "dont forget", "make sure", "in conclusion",
    // Russian generic
    "сегодня", "видео", "канал", "ролик", "смотрим", "говорим", "обсудим",
    "давайте", "сейчас", "начнем", "поговорим", "расскажу", "спасибо",
    "всем привет", "не забудьте", "обязательно", "в заключение",
  ]);
  return fillers.has(tag.toLowerCase());
}

/**
 * Normalize near-duplicate tags to a canonical form.
 * E.g. "ai" and "artificial intelligence" → keep only "artificial intelligence"
 */
function deduplicateTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const tag of tags) {
    const normalized = tag.toLowerCase().trim();
    // Skip if this tag is a substring of an already-kept tag, or vice versa
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
 * Split camelCase / PascalCase into spaced words.
 * E.g. "maxplanck" → "max planck", "waveparticle" → "wave particle"
 */
function splitCamelCase(tag: string): string {
  // Insert space before uppercase letters (for EN) and between lowercase-uppercase transitions
  let result = tag.replace(/([a-z])([A-Z])/g, "$1 $2");
  // Also handle consecutive capitals: "HTTPServer" → "HTTP Server"
  result = result.replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  return result.toLowerCase().trim();
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
