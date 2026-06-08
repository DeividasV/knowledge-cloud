import {
  type TagResult,
  cleanTag,
  isGenericFiller,
  deduplicateTags,
  selectTagsByScore,
  filterByScript,
} from "./shared";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta";

const TAG_SCHEMA = {
  type: "object",
  properties: {
    tags: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tag: { type: "string" },
          relevance: { type: "number" },
        },
        required: ["tag", "relevance"],
      },
    },
  },
  required: ["tags"],
} as const;

function getLanguageInstruction(language: string): string {
  switch (language) {
    case "lt":
      return `LANGUAGE: Output tags in LITHUANIAN ONLY. This is MANDATORY — not a suggestion. Every single tag must be written in Lithuanian using Lithuanian characters (ąčęėįšųūž). If the video is in Russian, English, Chinese, or any other language, you MUST translate every concept to its standard Lithuanian term before outputting it.
Examples of CORRECT behavior:
- Video about "drugs" → tag: "narkotikai"
- Video about "russian empire" → tag: "rusijos imperija"
- Video about "coronavirus" → tag: "koronavirusas"
Examples of INCORRECT behavior (tags will be REJECTED):
- "наркотики", "российская империя", "drugs", "russian empire", "coronavirus"`;
    case "en":
    default:
      return `LANGUAGE: Output tags in ENGLISH ONLY. This is MANDATORY — not a suggestion. Every single tag must be written in English using basic Latin letters (a-z). If the video is in Russian, Chinese, Lithuanian, Arabic, or any other language, you MUST translate every concept to its standard English term before outputting it.
Examples of CORRECT behavior:
- Video about "наркотики" → tag: "drugs"
- Video about "российская империя" → tag: "russian empire"
- Video about "koronavirusas" → tag: "coronavirus"
Examples of INCORRECT behavior (tags will be REJECTED):
- "наркотики", "россия", "китай", "koronavirusas", "narkotikai"`;
  }
}

function buildPrompt(title: string, transcript: string | null, extractLimit: number, language: string): string {
  const context = buildPromptContext(title, transcript);
  const langInstruction = getLanguageInstruction(language);

  return `You are a topic tag extractor. Given a video title and transcript, produce up to ${extractLimit} tags that name the central topics, concepts, people, technologies, or domains discussed.

RULES:
1. QUANTITY: Return as many relevant tags as possible, up to ${extractLimit}. Do NOT pad with weak tags just to hit a number. A video about one narrow topic may have only 3-5 tags; a broad-ranging video may have 20+. Let the content decide.
2. CENTRAL THEMES ONLY: Tag what the video is ABOUT, not every noun that appears. If "Australia" is only mentioned in a passing anecdote, do NOT tag it. If a person is only named once in an example, do NOT tag them.
3. SPECIFIC OVER GENERIC: "neural networks" > "technology"; "quantum entanglement" > "science"; "D-Day landings" > "history".
4. MULTI-WORD: Use multi-word tags for any concept that needs more than one word. Tags MUST have spaces between words. NEVER concatenate or hyphenate: "machine learning" not "machinelearning" or "machine-learning".
5. NORMALIZE: All tags lowercase, trimmed. One canonical form per concept — no near-duplicates like "ai" and "artificial intelligence" in the same list; pick the clearest.
6. LANGUAGE: ${langInstruction}
7. NO PROHIBITED ITEMS: No generic phrases ("in this video", "let's talk"), no sentence fragments, no timestamps, no numbers as standalone tags, no emotional reactions ("amazing", "shocking"), no speaker names unless they are the subject.
8. SCORING: Assign each tag a relevance score from 0.00 to 1.00. Be BRUTALLY honest — do NOT space scores evenly:
   - 0.90-1.00 = central theme, what the video is primarily about (1-3 tags max)
   - 0.70-0.89 = important sub-topic (2-4 tags max)
   - 0.50-0.69 = secondary, mentioned but not central (a few tags)
   - 0.30-0.49 = tangential, barely relevant (rarely include)
   - below 0.30 = do not include
   Most videos should have a CLEAR gap between strong tags (0.70+) and weak tags (0.50-). Do NOT give 15 tags all between 0.50 and 0.95 — that defeats the purpose.
9. FORMAT: Output ONLY valid JSON matching the provided schema. No markdown, no code fences, no prose.

${context}`;
}

function buildPromptContext(title: string, transcript: string | null): string {
  const parts: string[] = [];

  if (title && title.trim().length > 0) {
    parts.push(`Title: ${title}`);
  }

  if (transcript && transcript.length > 0) {
    parts.push(`Transcript: ${transcript}`);
  }

  return parts.join("\n");
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

async function doGeminiRequest(
  url: string,
  prompt: string
): Promise<TagResult[] | null> {
  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseSchema: TAG_SCHEMA,
    },
  };

  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const isCreditError = text.toLowerCase().includes("credits are depleted");
        if (isCreditError) {
          throw new Error(
            "Gemini API credits depleted. Add prepaid credits at https://ai.google.dev/pricing or switch to Ollama in Settings."
          );
        }
        console.error(`[Gemini] HTTP ${res.status}: ${text.slice(0, 500)}`);
        // Rate limit or server error — retry
        if (res.status === 429 || res.status >= 500) {
          if (attempt < maxRetries - 1) {
            await sleep(1000 * Math.pow(2, attempt));
            continue;
          }
        }
        throw new Error(`Gemini API returned HTTP ${res.status}. ${text.slice(0, 200)}`);
      }

      const data = (await res.json()) as GeminiResponse;

      if (data.error) {
        throw new Error(`Gemini API error ${data.error.code}: ${data.error.message}`);
      }

      const candidate = data.candidates?.[0];
      if (candidate?.finishReason === "MAX_TOKENS") {
        console.error("[Gemini] Response truncated (MAX_TOKENS)");
      }

      const rawText = candidate?.content?.parts?.[0]?.text;
      if (!rawText) {
        const reason = candidate?.finishReason || "UNKNOWN";
        const candidatePreview = (JSON.stringify(candidate) ?? "undefined").slice(0, 400);
        throw new Error(
          `Gemini returned empty content (finishReason=${reason}). ` +
          `Candidate: ${candidatePreview}`
        );
      }

      const cleaned = rawText
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/\s*```$/i, "");

      let parsed: { tags?: Array<{ tag: string; relevance: number }> };
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        throw new Error(`Gemini returned unparseable JSON: ${cleaned.slice(0, 400)}`);
      }

      if (!Array.isArray(parsed.tags)) {
        throw new Error(`Gemini returned unexpected structure: ${JSON.stringify(parsed).slice(0, 400)}`);
      }

      return parsed.tags.map((t) => ({
        name: cleanTag(t.tag),
        score: Math.max(0, Math.min(1, Number(t.relevance ?? 0.5))),
      }));
    } catch (err) {
      console.error(`[Gemini] Attempt ${attempt + 1} failed:`, err);
      if (attempt < maxRetries - 1) {
        await sleep(1000 * Math.pow(2, attempt));
        continue;
      }
      return null;
    }
  }

  return null;
}

/**
 * Extract tags using Google's Gemini API with structured JSON output.
 * Returns scored tags or null on any failure.
 *
 * Strategy:
 * 1. Try with title + transcript first (more context = better tags).
 * 2. If that fails and a transcript exists, retry with transcript only.
 *    The title can sometimes trigger safety refusals on sensitive topics
 *    even when the transcript itself is perfectly fine.
 */
export async function extractTagsWithGemini(
  title: string,
  transcript: string | null,
  extractLimit = 15,
  model?: string,
  language = "en"
): Promise<TagResult[] | null> {
  if (!GEMINI_API_KEY) {
    console.error("[Gemini] No API key configured");
    return null;
  }

  const resolvedModel = model || DEFAULT_GEMINI_MODEL;
  const url = `${GEMINI_API_URL}/models/${resolvedModel}:generateContent?key=${GEMINI_API_KEY}`;

  // Attempt 1: title + transcript
  const promptFull = buildPrompt(title, transcript, extractLimit, language);
  const rawTagsFull = await doGeminiRequest(url, promptFull);

  if (rawTagsFull && rawTagsFull.length > 0) {
    return finalizeTags(rawTagsFull, language, extractLimit);
  }

  // Attempt 2: transcript only (title can trigger safety filters)
  if (transcript && transcript.length > 0) {
    console.log("[Gemini] Full prompt returned empty; retrying with transcript only");
    const promptTranscriptOnly = buildPrompt("", transcript, extractLimit, language);
    const rawTagsTranscript = await doGeminiRequest(url, promptTranscriptOnly);

    if (rawTagsTranscript && rawTagsTranscript.length > 0) {
      return finalizeTags(rawTagsTranscript, language, extractLimit);
    }
  }

  return null;
}

function finalizeTags(
  rawTags: TagResult[],
  language: string,
  extractLimit: number
): TagResult[] {
  const beforeFilter = rawTags.length;
  let tags = rawTags
    .filter((t) => t.name.length >= 2 && t.name.length <= 40)
    .filter((t) => !isGenericFiller(t.name));

  const beforeScript = tags.length;
  tags = tags.filter((t) => filterByScript(t.name, language));
  const scriptDropped = beforeScript - tags.length;

  const deduped = deduplicateTags(tags);
  const result = selectTagsByScore(deduped, extractLimit);
  console.log(
    `[Gemini] Tags: raw=${beforeFilter} → afterFilter=${tags.length}${scriptDropped > 0 ? ` (dropped ${scriptDropped} wrong-script)` : ""} → deduped=${deduped.length} → final=${result.length}`
  );
  return result;
}

export function isGeminiConfigured(): boolean {
  return Boolean(GEMINI_API_KEY && GEMINI_API_KEY.length > 10);
}
