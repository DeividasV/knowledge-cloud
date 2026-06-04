export interface TagResult {
  name: string;
  score: number;
}

export function cleanTag(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/^["']|["']$/g, "")
    .replace(/[\[\]()]/g, "")
    .trim()
    .replace(/-/g, " ");
}

export function isGenericFiller(tag: string): boolean {
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
 * Detect tags written in the wrong script for the target language.
 * For English: reject Cyrillic, CJK, Arabic, Hebrew, etc.
 * For Lithuanian: reject Cyrillic, CJK, Arabic, Hebrew, etc. (Latin + Lithuanian diacritics allowed).
 */
export function filterByScript(tag: string, language: string): boolean {
  if (language === "lt") {
    // Allow Lithuanian Latin + diacritics, digits, spaces, common punctuation
    // Reject Cyrillic, CJK, Arabic, Hebrew
    return !/[\u0400-\u04FF\u0500-\u052F\u2DE0-\u2DFF\uA640-\uA69F\u0600-\u06FF\u0750-\u077F\u0590-\u05FF\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF]/u.test(tag);
  }
  // English (default): allow basic Latin only + digits, spaces, common punctuation
  // Reject anything outside basic Latin + common symbols
  return !/[\u0400-\u04FF\u0500-\u052F\u2DE0-\u2DFF\uA640-\uA69F\u0600-\u06FF\u0750-\u077F\u0590-\u05FF\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF]/u.test(tag);
}

export function deduplicateTags(tags: TagResult[]): TagResult[] {
  const seen = new Set<string>();
  const result: TagResult[] = [];

  for (const tag of tags) {
    const normalized = tag.name.toLowerCase().trim();
    // Exact duplicate
    if (seen.has(normalized)) continue;

    // Substring duplicate (e.g. "ai" vs "artificial intelligence")
    const isDuplicate = Array.from(seen).some(
      (s) => s.includes(normalized) || normalized.includes(s)
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
 *
 * @param maxTags - hard ceiling on how many tags to keep (from user settings)
 */
export function selectTagsByScore(tags: TagResult[], maxTags?: number): TagResult[] {
  const ceiling = maxTags && maxTags > 0 ? maxTags : 999;
  if (tags.length <= 2) return tags.slice(0, ceiling);

  const sorted = [...tags].sort((a, b) => b.score - a.score);

  let cutIdx = sorted.length;
  for (let i = Math.min(sorted.length, ceiling) - 1; i >= 1; i--) {
    const gap = sorted[i - 1].score - sorted[i].score;
    if (gap >= 0.04) {
      cutIdx = i;
      break;
    }
  }

  const minKeep = Math.min(Math.max(3, Math.ceil(ceiling * 0.12)), ceiling);

  if (cutIdx < sorted.length) {
    return sorted.slice(0, Math.max(minKeep, Math.min(cutIdx, ceiling)));
  }

  const selected = sorted.filter((t) => t.score >= 0.55).slice(0, ceiling);

  if (selected.length < minKeep && sorted.length >= minKeep) {
    return sorted.slice(0, Math.min(minKeep, ceiling));
  }

  return selected;
}
