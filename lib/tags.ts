/**
 * Lightweight tag extraction from video text (title + description + transcript).
 * Pure algorithmic approach — no ML models, runs entirely in Node.js on CPU.
 * Supports any language via configurable stopword lists.
 */

// English stopwords
const EN_STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
  "by", "from", "as", "is", "was", "are", "were", "be", "been", "being", "have", "has",
  "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "must",
  "shall", "can", "need", "dare", "ought", "used", "this", "that", "these", "those",
  "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them", "my",
  "your", "his", "its", "our", "their", "what", "which", "who", "when", "where", "why",
  "how", "all", "each", "every", "both", "few", "more", "most", "other", "some", "such",
  "no", "not", "only", "own", "same", "so", "than", "too", "very", "just", "now", "then",
  "also", "about", "up", "out", "if", "because", "until", "while", "during", "before",
  "after", "above", "below", "between", "through", "over", "under", "again", "further",
  "once", "here", "there", "whenever", "wherever", "however", "whatever", "whoever",
  "whichever", "am", "get", "got", "go", "going", "went", "gone", "come", "came", "coming",
  "like", "know", "think", "see", "saw", "seen", "want", "wanted", "make", "made", "take",
  "took", "taken", "say", "said", "tell", "told", "ask", "asked", "give", "gave", "given",
  "work", "worked", "working", "try", "tried", "trying", "help", "helped", "helping",
  "call", "called", "calling", "feel", "felt", "become", "became", "leave", "left",
  "put", "mean", "meant", "keep", "kept", "let", "begin", "began", "seem", "seemed",
  "help", "show", "showed", "shown", "hear", "heard", "play", "played", "run", "ran",
  "move", "moved", "live", "lived", "believe", "believed", "bring", "brought", "happen",
  "happened", "write", "wrote", "written", "provide", "provided", "sit", "sat", "stand",
  "stood", "lose", "lost", "pay", "paid", "meet", "met", "include", "included", "continue",
  "continued", "set", "learn", "learned", "learnt", "change", "changed", "lead", "led",
  "understand", "understood", "watch", "watched", "follow", "followed", "stop", "stopped",
  "create", "created", "speak", "spoke", "spoken", "read", "allow", "allowed", "add", "added",
  "spend", "spent", "grow", "grew", "grown", "open", "opened", "walk", "walked", "offer",
  "offered", "remember", "remembered", "love", "loved", "consider", "considered", "appear",
  "appeared", "buy", "bought", "wait", "waited", "serve", "served", "die", "died", "send",
  "sent", "expect", "expected", "build", "built", "stay", "stayed", "fall", "fell", "fallen",
  "cut", "reach", "reached", "kill", "killed", "remain", "remained", "suggest", "suggested",
  "raise", "raised", "pass", "passed", "sell", "sold", "require", "required", "report",
  "reported", "decide", "decided", "pull", "pulled", "one", "two", "three", "first", "last",
  "new", "good", "bad", "old", "young", "big", "small", "long", "short", "high", "low",
  "great", "little", "own", "last", "late", "early", "other", "many", "much", "lot", "way",
  "right", "left", "well", "still", "even", "back", "down", "off", "never", "always",
  "really", "actually", "definitely", "probably", "maybe", "perhaps", "sure", "okay", "ok",
  "yes", "no", "yeah", "wow", "hey", "oh", "ah", "um", "uh", "hmm", "huh", "wow", "oops",
  "yay", "nah", "nope", "yep", "yup", "thanks", "thank", "please", "sorry", "hello", "hi",
  "bye", "goodbye", "welcome",
]);

// Russian stopwords (common)
const RU_STOPWORDS = new Set([
  "и", "в", "на", "с", "по", "к", "о", "от", "для", "до", "за", "из", "под", "при",
  "про", "через", "над", "об", "во", "со", "ко", "обо", "не", "но", "а", "или", "что",
  "как", "когда", "где", "почему", "зачем", "кто", "который", "которая", "которое",
  "которые", "этот", "эта", "это", "эти", "тот", "та", "то", "те", "так", "такой",
  "такая", "такое", "такие", "весь", "вся", "все", "все", "мой", "моя", "мое", "мои",
  "твой", "твоя", "твое", "твои", "его", "ее", "их", "наш", "наша", "наше", "наши",
  "ваш", "ваша", "ваше", "ваши", "свой", "своя", "свое", "свои", "я", "ты", "он",
  "она", "оно", "мы", "вы", "они", "меня", "тебя", "его", "ее", "нас", "вас", "их",
  "мне", "тебе", "ему", "ей", "нам", "вам", "им", "мной", "тобой", "им", "ей",
  "нами", "вами", "ими", "обо", "мне", "себе", "себя", "собой", "собою", "был",
  "была", "было", "были", "быть", "есть", "иметь", "имеет", "имеют", "имел", "имела",
  "буду", "будешь", "будет", "будем", "будете", "будут", "будь", "будьте", "может",
  "можно", "могу", "можешь", "можем", "можете", "могут", "мог", "могла", "могли",
  "должен", "должна", "должно", "должны", "нужно", "нужен", "нужна", "нужны",
  "надо", "надобно", "необходимо", "важно", "важен", "важна", "важны", "хорошо",
  "плохо", "лучше", "хуже", "больше", "меньше", "много", "мало", "немного", "немало",
  "всего", "только", "лишь", "просто", "даже", "особенно", "очень", "слишком",
  "достаточно", "совсем", "совершенно", "абсолютно", "почти", "примерно", "где-то",
  "когда-то", "как-то", "что-то", "кто-то", "куда-то", "откуда-то", "зачем-то",
  "почему-то", "какой-то", "чей-то", "сколько-то", "как-нибудь", "когда-нибудь",
  "где-нибудь", "куда-нибудь", "откуда-нибудь", "зачем-нибудь", "какой-нибудь",
  "кто-нибудь", "что-нибудь", "кое-что", "кое-кто", "кое-какой", "вроде", "типа",
  "как бы", "так сказать", "ну", "вот", "так", "в общем", "в принципе", "вообще",
  "на самом деле", "по сути", "по факту", "кстати", "между прочим", "к слову",
  "во-первых", "во-вторых", "в-третьих", "например", "допустим", "предположим",
  "скажем", "допустим", "вообще-то", "однако", "тем не менее", "все-таки",
  "все же", "тем временем", "между тем", "пока", "пока что", "покамест",
  "еще", "уже", "тоже", "также", "тогда", "сейчас", "сегодня", "вчера",
  "завтра", "всегда", "никогда", "иногда", "часто", "редко", "обычно",
  "вообще", "конечно", "безусловно", "несомненно", "действительно", "правда",
  "вероятно", "возможно", "похоже", "кажется", "видимо", "очевидно",
  "ясно", "понятно", "известно", "говорят", "слышно", "видно", "заметно",
]);

const ALL_STOPWORDS = new Set([...EN_STOPWORDS, ...RU_STOPWORDS]);

function detectLanguage(text: string): "en" | "ru" | "mixed" {
  const ruChars = (text.match(/[а-яё]/gi) || []).length;
  const enChars = (text.match(/[a-z]/gi) || []).length;
  if (ruChars > enChars * 2) return "ru";
  if (enChars > ruChars * 2) return "en";
  return "mixed";
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\sа-яё]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((t) => t.length >= 2);
}

function isStopWord(word: string): boolean {
  return ALL_STOPWORDS.has(word.toLowerCase());
}

function isJunk(phrase: string): boolean {
  // Reject numeric-only, too short, too long, or URL-like
  if (/^\d+$/.test(phrase)) return true;
  if (phrase.length < 3) return true;
  if (phrase.length > 40) return true;
  if (/^https?:\/\//.test(phrase)) return true;
  if (/^www\./.test(phrase)) return true;
  if (/\d{4,}/.test(phrase)) return true; // long numbers
  return false;
}

function isValidNgram(words: string[]): boolean {
  // Don't start or end with stopwords for multi-word phrases
  if (words.length === 1) return !isStopWord(words[0]);
  const first = words[0];
  const last = words[words.length - 1];
  return !isStopWord(first) && !isStopWord(last);
}

function getNgrams(tokens: string[], n: number): string[] {
  const result: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    const slice = tokens.slice(i, i + n);
    if (isValidNgram(slice)) {
      result.push(slice.join(" "));
    }
  }
  return result;
}

function calculateTfIdf(phrases: string[], corpusPhrases: Map<string, number>): Map<string, number> {
  const scores = new Map<string, number>();
  const docFreq = new Map<string, number>();

  for (const phrase of phrases) {
    docFreq.set(phrase, (docFreq.get(phrase) || 0) + 1);
  }

  const totalDocs = corpusPhrases.size || 1;
  for (const [phrase, count] of docFreq) {
    const tf = count;
    const docCount = corpusPhrases.get(phrase) || 1;
    const idf = Math.log(totalDocs / docCount) + 1;
    // Bonus for longer phrases (more specific)
    const phraseBonus = phrase.includes(" ") ? (phrase.split(" ").length * 0.5) : 0;
    scores.set(phrase, tf * idf + phraseBonus);
  }

  return scores;
}

/**
 * Extract tags from video text using lightweight NLP (no ML models).
 * Combines title, description, and transcript.
 * Returns top N most distinctive tags.
 */
export function extractTags(
  title: string,
  description: string | null,
  transcript: string | null,
  options: { maxTags?: number; corpusPhrases?: Map<string, number> } = {}
): string[] {
  const { maxTags = 8, corpusPhrases = new Map() } = options;

  const combined = [title, description || "", transcript || ""].join(" ");
  if (!combined.trim()) return [];

  const tokens = tokenize(combined);
  if (tokens.length === 0) return [];

  // Collect all valid n-grams (unigrams, bigrams, trigrams)
  const allPhrases: string[] = [];
  for (let n = 1; n <= 3; n++) {
    allPhrases.push(...getNgrams(tokens, n));
  }

  // Filter junk
  const validPhrases = allPhrases.filter((p) => !isJunk(p));
  if (validPhrases.length === 0) return [];

  // Score using TF-IDF + phrase length bonus
  const scores = calculateTfIdf(validPhrases, corpusPhrases);

  // Return top tags, preferring variety (avoid near-duplicates)
  const sorted = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([phrase]) => phrase);

  const result: string[] = [];
  const seen = new Set<string>();

  for (const phrase of sorted) {
    if (result.length >= maxTags) break;
    const normalized = phrase.toLowerCase();
    // Skip if this phrase is a substring of an already selected longer phrase
    const isSubset = Array.from(seen).some((s) =>
      s.includes(normalized) || normalized.includes(s)
    );
    if (!isSubset || seen.size === 0) {
      result.push(phrase);
      seen.add(normalized);
    }
  }

  return result;
}

/**
 * Build a corpus frequency map from a list of texts.
 * Used for TF-IDF calculation across all videos.
 */
export function buildCorpus(videoTexts: { title: string; description: string | null; transcript: string | null }[]): Map<string, number> {
  const corpus = new Map<string, number>();

  for (const { title, description, transcript } of videoTexts) {
    const combined = [title, description || "", transcript || ""].join(" ");
    const tokens = tokenize(combined);
    const docPhrases = new Set<string>();

    for (let n = 1; n <= 3; n++) {
      for (const phrase of getNgrams(tokens, n)) {
        if (!isJunk(phrase)) {
          docPhrases.add(phrase.toLowerCase());
        }
      }
    }

    for (const phrase of docPhrases) {
      corpus.set(phrase, (corpus.get(phrase) || 0) + 1);
    }
  }

  return corpus;
}
