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

export function deduplicateTags(tags: TagResult[]): TagResult[] {
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
