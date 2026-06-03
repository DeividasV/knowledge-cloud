import {
  extractTagsWithOllama,
  isOllamaAvailable,
  type TagResult,
} from "./extractors/ollama";
import {
  extractTagsWithGemini,
  isGeminiConfigured,
} from "./extractors/gemini";

export type { TagResult };

const METHOD = process.env.TAG_EXTRACTION_METHOD || "ollama";
const FALLBACK_TO_LOCAL =
  process.env.TAG_EXTRACTION_FALLBACK_TO_LOCAL === "true";

/**
 * Unified tag extraction entry point.
 * Dispatches to Gemini or Ollama based on TAG_EXTRACTION_METHOD env var.
 * Fallback to Ollama is ONLY enabled when TAG_EXTRACTION_FALLBACK_TO_LOCAL="true".
 * By default, the configured method is used strictly — failures do not silently switch backends.
 */
export async function extractVideoTags(
  title: string,
  transcript: string | null
): Promise<TagResult[] | null> {
  const useGemini = METHOD === "gemini";

  if (useGemini) {
    if (!isGeminiConfigured()) {
      console.error(
        "TAG_EXTRACTION_METHOD=gemini but GEMINI_API_KEY is missing or invalid."
      );
      if (FALLBACK_TO_LOCAL) {
        return extractTagsWithOllama(title, transcript);
      }
      return null;
    }

    const result = await extractTagsWithGemini(title, transcript);
    if (result && result.length > 0) return result;

    if (FALLBACK_TO_LOCAL) {
      console.warn("Gemini tag extraction failed, falling back to Ollama");
      return extractTagsWithOllama(title, transcript);
    }
    return null;
  }

  return extractTagsWithOllama(title, transcript);
}

/**
 * Quick availability check for the configured extraction method.
 * Used by batch operations to fail fast before starting work.
 */
export async function checkTagExtractionAvailable(): Promise<boolean> {
  const useGemini = METHOD === "gemini";

  if (useGemini) {
    if (isGeminiConfigured()) return true;
    if (FALLBACK_TO_LOCAL) return isOllamaAvailable();
    return false;
  }

  return isOllamaAvailable();
}
