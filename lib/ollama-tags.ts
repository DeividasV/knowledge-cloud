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

  const prompt = `You are a topic tag extractor. Given video title and transcript, extract ${maxTags} meaningful topic tags.

Rules:
- Tags should be specific topics, concepts, people, technologies, events, or domains.
- Prefer single-word tags when they are clear (e.g., "physics", "python", "ww2").
- Use multi-word tags ONLY for proper names or well-known compound terms (e.g., "machine learning", "world war 2", "neural network").
- Multi-word tags MUST have spaces between words. NEVER concatenate words.
- All tags must be lowercase.
- NEVER output generic phrases like "in this video", "today we", "let's talk", etc.
- NEVER output random sentence fragments.
- Output ONLY a JSON array of strings. No markdown, no explanation.

${context}

Output: ["tag1", "tag2", ...]`;

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
      .filter((t) => t.length >= 2 && t.length <= 40)
      .filter((t) => !isGenericFiller(t));

    const unique = [...new Set(cleaned)];

    // Assign descending scores
    return unique.slice(0, maxTags).map((name, i) => ({
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
    "video", "youtube", "channel", "today", "talk", "discuss", "look",
    "going", "want", "think", "know", "really", "actually", "basically",
    "literally", "obviously",
    "this video", "in this", "we are", "let us", "going to", "talk about",
    "сегодня", "видео", "канал", "ролик", "смотрим", "говорим", "обсудим",
    "давайте", "сейчас", "начнем", "поговорим", "расскажу",
  ]);
  return fillers.has(tag.toLowerCase());
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
