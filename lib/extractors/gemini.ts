import {
  type TagResult,
  cleanTag,
  isGenericFiller,
  deduplicateTags,
  selectTagsByScore,
} from "./shared";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
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

function buildPrompt(title: string, transcript: string | null, extractLimit: number): string {
  const context = buildPromptContext(title, transcript);

  return `You are a topic tag extractor. Given a video title and transcript, produce up to ${extractLimit} tags that name the central topics, concepts, people, technologies, or domains discussed.

RULES:
1. QUANTITY: Return as many relevant tags as possible, up to ${extractLimit}. Do NOT pad with weak tags just to hit a number. A video about one narrow topic may have only 3-5 tags; a broad-ranging video may have 20+. Let the content decide.
2. CENTRAL THEMES ONLY: Tag what the video is ABOUT, not every noun that appears. If "Australia" is only mentioned in a passing anecdote, do NOT tag it. If a person is only named once in an example, do NOT tag them.
3. SPECIFIC OVER GENERIC: "neural networks" > "technology"; "quantum entanglement" > "science"; "D-Day landings" > "history".
4. MULTI-WORD: Use multi-word tags for any concept that needs more than one word. Tags MUST have spaces between words. NEVER concatenate or hyphenate: "machine learning" not "machinelearning" or "machine-learning".
5. NORMALIZE: All tags lowercase, trimmed. One canonical form per concept — no near-duplicates like "ai" and "artificial intelligence" in the same list; pick the clearest.
6. LANGUAGE: Output tags in English only. Even if the video is in another language, translate concepts to their standard English terms.
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
  parts.push(`Title: ${title}`);

  if (transcript && transcript.length > 0) {
    // Sample from beginning (intro) and end (conclusion) for best topic coverage.
    const maxLen = 1500;
    if (transcript.length <= maxLen) {
      parts.push(`Transcript: ${transcript}`);
    } else {
      const head = transcript.slice(0, Math.floor(maxLen * 0.7));
      const tail = transcript.slice(-Math.floor(maxLen * 0.3));
      parts.push(`Transcript:\n${head}\n... [middle skipped] ...\n${tail}`);
    }
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

/**
 * Extract tags using Google's Gemini API with structured JSON output.
 * Returns scored tags or null on any failure.
 */
export async function extractTagsWithGemini(
  title: string,
  transcript: string | null,
  extractLimit = 15
): Promise<TagResult[] | null> {
  if (!GEMINI_API_KEY) {
    console.error("[Gemini] No API key configured");
    return null;
  }

  const url = `${GEMINI_API_URL}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const prompt = buildPrompt(title, transcript, extractLimit);

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
          console.error("[Gemini] Billing error: prepayment credits depleted. Visit https://ai.studio/projects to add credits.");
        } else {
          console.error(`[Gemini] HTTP ${res.status}: ${text.slice(0, 500)}`);
        }
        // Rate limit or server error — retry
        if ((res.status === 429 && !isCreditError) || res.status >= 500) {
          if (attempt < maxRetries - 1) {
            await sleep(1000 * Math.pow(2, attempt));
            continue;
          }
        }
        return null;
      }

      const data = (await res.json()) as GeminiResponse;

      if (data.error) {
        console.error(`[Gemini] API error ${data.error.code}: ${data.error.message}`);
        return null;
      }

      const candidate = data.candidates?.[0];
      if (candidate?.finishReason === "MAX_TOKENS") {
        console.error("[Gemini] Response truncated (MAX_TOKENS)");
      }

      const rawText = candidate?.content?.parts?.[0]?.text;
      if (!rawText) {
        console.error("[Gemini] No text in response. Candidate:", JSON.stringify(candidate).slice(0, 500));
        return null;
      }

      const cleaned = rawText
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/\s*```$/i, "");

      let parsed: { tags?: Array<{ tag: string; relevance: number }> };
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        console.error("[Gemini] Unparseable JSON:", cleaned.slice(0, 500));
        return null;
      }

      if (!Array.isArray(parsed.tags)) {
        console.error("[Gemini] Unexpected structure:", JSON.stringify(parsed).slice(0, 500));
        return null;
      }

      const beforeFilter = parsed.tags.length;
      const tags = parsed.tags
        .map((t) => ({
          name: cleanTag(t.tag),
          score: Math.max(0, Math.min(1, Number(t.relevance ?? 0.5))),
        }))
        .filter((t) => t.name.length >= 2 && t.name.length <= 40)
        .filter((t) => !isGenericFiller(t.name));

      const deduped = deduplicateTags(tags);
      const result = selectTagsByScore(deduped);
      console.log(
        `[Gemini] Tags: raw=${beforeFilter} → afterFilter=${tags.length} → deduped=${deduped.length} → final=${result.length}`
      );
      return result;
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

export function isGeminiConfigured(): boolean {
  return Boolean(GEMINI_API_KEY && GEMINI_API_KEY.length > 10);
}
