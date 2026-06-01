import { YoutubeTranscript } from "youtube-transcript";

export interface TranscriptSegment {
  text: string;
  duration: number;
  offset: number;
  lang: string;
}

export async function fetchVideoTranscript(
  videoId: string
): Promise<{ text: string; segments: TranscriptSegment[]; lang: string } | null> {
  try {
    const rawSegments = await YoutubeTranscript.fetchTranscript(videoId);

    if (!rawSegments || rawSegments.length === 0) {
      return null;
    }

    const segments: TranscriptSegment[] = rawSegments.map((s) => ({
      text: s.text,
      duration: s.duration,
      offset: s.offset,
      lang: s.lang || "unknown",
    }));

    const text = segments.map((s) => s.text).join("\n");
    const lang = segments[0]?.lang || "unknown";

    return { text, segments, lang };
  } catch (error: any) {
    console.error(`[Transcript] Failed to fetch for ${videoId}:`, error.message);
    return null;
  }
}

export function formatTranscriptForDisplay(
  segments: TranscriptSegment[],
  options: { showTimestamps?: boolean } = {}
): string {
  const { showTimestamps = false } = options;

  if (showTimestamps) {
    return segments
      .map((s) => {
        const seconds = Math.floor(s.offset / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const ts = `${mins}:${String(secs).padStart(2, "0")}`;
        return `[${ts}] ${s.text}`;
      })
      .join("\n");
  }

  return segments.map((s) => s.text).join("\n");
}
