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
 */
export function selectTagsByScore(tags: TagResult[]): TagResult[] {
  if (tags.length <= 2) return tags;

  const sorted = [...tags].sort((a, b) => b.score - a.score);

  let cutIdx = sorted.length;
  for (let i = sorted.length - 1; i >= 1; i--) {
    const gap = sorted[i - 1].score - sorted[i].score;
    if (gap >= 0.04) {
      cutIdx = i;
      break;
    }
  }

  if (cutIdx < sorted.length) {
    return sorted.slice(0, Math.max(6, cutIdx));
  }

  const selected = sorted.filter((t) => t.score >= 0.55);

  if (selected.length < 3 && sorted.length >= 3) {
    return sorted.slice(0, 3);
  }

  return selected;
}
