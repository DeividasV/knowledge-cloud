// Backward-compat re-exports.
// New code should import from @/lib/tag-extractor instead.
export {
  extractTagsWithOllama,
  getAvailableOllamaModel,
  isOllamaAvailable,
  type TagResult,
} from "./extractors/ollama";
