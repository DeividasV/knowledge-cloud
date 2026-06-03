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

const FALLBACK_TO_LOCAL =
  process.env.TAG_EXTRACTION_FALLBACK_TO_LOCAL === "true";

function resolveMethod(method?: string): string {
  return method || process.env.TAG_EXTRACTION_METHOD || "ollama";
}

/**
 * Unified tag extraction entry point.
 * Dispatches to Gemini or Ollama based on the `method` parameter.
 * If no method is provided, falls back to TAG_EXTRACTION_METHOD env var, then "ollama".
 *
 * Fallback to Ollama is ONLY enabled when TAG_EXTRACTION_FALLBACK_TO_LOCAL="true".
 * By default, the configured method is used strictly.
 */
export async function extractVideoTags(
  title: string,
  transcript: string | null,
  method?: string
): Promise<TagResult[] | null> {
  const useGemini = resolveMethod(method) === "gemini";

  if (useGemini) {
    if (!isGeminiConfigured()) {
      console.error(
        "Tag extraction method is gemini but GEMINI_API_KEY is missing or invalid."
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
 * Quick availability check for the given extraction method.
 * Used by batch operations to fail fast before starting work.
 */
export async function checkTagExtractionAvailable(
  method?: string
): Promise<boolean> {
  const useGemini = resolveMethod(method) === "gemini";

  if (useGemini) {
    if (isGeminiConfigured()) return true;
    if (FALLBACK_TO_LOCAL) return isOllamaAvailable();
    return false;
  }

  return isOllamaAvailable();
}
