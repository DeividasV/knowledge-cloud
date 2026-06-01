/**
 * Lightweight tag extraction from video text (title + description + transcript).
 * Pure algorithmic approach — no ML models, runs entirely in Node.js on CPU.
 */

// ── Stopwords ─────────────────────────────────────────────────────────

const EN_STOPWORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with","by","from","as",
  "is","was","are","were","be","been","being","have","has","had","do","does","did",
  "will","would","could","should","may","might","must","shall","can","need","dare","ought",
  "used","this","that","these","those","i","you","he","she","it","we","they","me","him",
  "her","us","them","my","your","his","its","our","their","what","which","who","when",
  "where","why","how","all","each","every","both","few","more","most","other","some",
  "such","no","not","only","own","same","so","than","too","very","just","now","then",
  "also","about","up","out","if","because","until","while","during","before","after",
  "above","below","between","through","over","under","again","further","once","here",
  "there","whenever","wherever","however","whatever","whoever","whichever","am","get",
  "got","go","going","went","gone","come","came","coming","like","know","think","see",
  "saw","seen","want","wanted","make","made","take","took","taken","say","said","tell",
  "told","ask","asked","give","gave","given","work","worked","working","try","tried",
  "trying","help","helped","helping","call","called","calling","feel","felt","become",
  "became","leave","left","put","mean","meant","keep","kept","let","begin","began",
  "seem","seemed","show","showed","shown","hear","heard","play","played","run","ran",
  "move","moved","live","lived","believe","believed","bring","brought","happen",
  "happened","write","wrote","written","provide","provided","sit","sat","stand","stood",
  "lose","lost","pay","paid","meet","met","include","included","continue","continued",
  "set","learn","learned","learnt","change","changed","lead","led","understand",
  "understood","watch","watched","follow","followed","stop","stopped","create","created",
  "speak","spoke","spoken","read","allow","allowed","add","added","spend","spent","grow",
  "grew","grown","open","opened","walk","walked","offer","offered","remember",
  "remembered","love","loved","consider","considered","appear","appeared","buy","bought",
  "wait","waited","serve","served","die","died","send","sent","expect","expected","build",
  "built","stay","stayed","fall","fell","fallen","cut","reach","reached","kill","killed",
  "remain","remained","suggest","suggested","raise","raised","pass","passed","sell","sold",
  "require","required","report","reported","decide","decided","pull","pulled","one","two",
  "three","first","last","new","good","bad","old","young","big","small","long","short",
  "high","low","great","little","late","early","many","much","lot","way","right","left",
  "well","still","even","back","down","off","never","always","really","actually",
  "definitely","probably","maybe","perhaps","sure","okay","ok","yes","no","yeah","wow",
  "hey","oh","ah","um","uh","hmm","huh","oops","yay","nah","nope","yep","yup","thanks",
  "thank","please","sorry","hello","hi","bye","goodbye","welcome","thing","things",
  "way","ways","part","parts","kind","kinds","number","numbers","people","person",
  "man","men","woman","women","child","children","time","times","year","years","day",
  "days","place","places","work","works","life","lives","world","worlds","hand","hands",
  "eye","eyes","home","house","water","word","words","look","looks","end","ends",
  "point","points","side","sides","head","heads","fact","facts","idea","ideas","case",
  "cases","group","groups","problem","problems","company","companies","system","systems",
  "question","questions","government","governments","program","programs","information",
  "story","stories","business","businesses","issue","issues","service","services",
  "family","families","power","powers","member","members","community","communities",
  "area","areas","name","names","school","schools","country","countries","party",
  "example","examples","state","states","research","study","studies","book","books",
  "use","uses","group","groups","course","courses","process","processes","result",
  "results","change","changes","job","jobs","car","cars","city","cities","line",
  "body","bodies","face","faces","door","doors","game","games","health","interest",
  "interests","level","levels","minute","minutes","moment","moments","month","months",
  "night","nights","reason","reasons","room","rooms","street","streets","team","teams",
  "week","weeks","paper","papers","section","sections","access","view","views","today",
  "tomorrow","yesterday","tonight","morning","evening","afternoon","weekend","ago",
  "recently","already","soon","later","finally","eventually","suddenly","immediately",
  "quickly","slowly","easily","hardly","recent","next","previous","current","different",
  "important","special","available","possible","certain","clear","true","false","whole",
  "half","full","empty","free","open","closed","ready","able","unable","likely","unlikely",
  "similar","various","general","specific","particular","common","normal","usual",
  "regular","simple","easy","difficult","hard","strong","weak","fast","slow","high",
  "low","deep","wide","narrow","long","short","large","small","huge","tiny","bright",
  "dark","light","heavy","light","thick","thin","soft","hard","smooth","rough","wet",
  "dry","hot","cold","warm","cool","clean","dirty","safe","dangerous","happy","sad",
  "angry","afraid","surprised","tired","busy","quiet","loud","nice","kind","rude",
  "friendly","unfriendly","polite","impolite","funny","serious","boring","interesting",
  "exciting","beautiful","ugly","pretty","handsome","attractive","unattractive","rich",
  "poor","expensive","cheap","modern","ancient","new","old","young","fresh","stale",
  "correct","wrong","right","exact","accurate","perfect","complete","incomplete","total",
  "partial","absolute","relative","positive","negative","active","passive","direct",
  "indirect","main","major","minor","primary","secondary","final","initial","original",
  "copy","real","fake","actual","official","unofficial","public","private","personal",
  "professional","local","global","national","international","domestic","foreign","home",
  "away","inside","outside","indoor","outdoor","upper","lower","top","bottom","front",
  "back","center","middle","edge","corner","side","end","start","beginning","finish",
  "use","make","take","come","go","get","see","know","think","say","tell","ask","give",
  "find","feel","become","leave","put","mean","keep","let","begin","seem","help",
  "show","hear","play","run","move","live","believe","bring","happen","write","provide",
  "sit","stand","lose","pay","meet","include","continue","set","learn","change","lead",
  "understand","watch","follow","stop","create","speak","read","allow","add","spend",
  "grow","open","walk","offer","remember","love","consider","appear","buy","wait",
  "serve","send","expect","build","stay","fall","reach","kill","remain","suggest",
  "raise","pass","sell","require","report","decide","pull",
]);

const RU_STOPWORDS = new Set([
  "и","в","во","на","с","со","по","к","ко","о","об","обо","от","до","за","из","под",
  "при","про","через","над","не","но","а","или","что","чтоб","чтобы","как","когда",
  "где","почему","зачем","кто","который","которая","которое","которые","этот","эта",
  "это","эти","тот","та","то","те","так","такой","такая","такое","такие","весь","вся",
  "все","всё","все","мой","моя","мое","мои","твой","твоя","твое","твои","его","ее",
  "её","их","наш","наша","наше","наши","ваш","ваша","ваше","ваши","свой","своя",
  "свое","свои","я","ты","он","она","оно","мы","вы","они","меня","тебя","нас",
  "вас","мне","тебе","ему","ей","нам","вам","им","мной","тобой","им","ей","нами",
  "вами","ими","себе","себя","собой","собою","был","была","было","были","быть","есть",
  "иметь","имеет","имеют","имел","имела","буду","будешь","будет","будем","будете",
  "будут","будь","будьте","может","можно","могу","можешь","можем","можете","могут",
  "мог","могла","могли","должен","должна","должно","должны","нужно","нужен","нужна",
  "нужны","надо","надобно","необходимо","важно","важен","важна","важны","хорошо","плохо",
  "лучше","хуже","больше","меньше","много","мало","немного","немало","всего","только",
  "лишь","просто","даже","особенно","очень","слишком","достаточно","совсем","совершенно",
  "абсолютно","почти","примерно","еще","уже","тоже","также","тогда","сейчас","сегодня",
  "вчера","завтра","всегда","никогда","иногда","часто","редко","обычно","конечно",
  "безусловно","несомненно","действительно","правда","вероятно","возможно","похоже",
  "кажется","видимо","очевидно","ясно","понятно","известно","говорят","слышно","видно",
  "заметно","ну","вот","так","вроде","типа","однако","тем","тем не менее","все-таки",
  "все","все же","пока","уже","ещё","ещё","ещё","опять","снова","вновь","назад","вперед",
  "вперёд","вниз","вверх","сюда","туда","отсюда","оттуда","здесь","там","тут","где-то",
  "когда-то","как-то","что-то","кто-то","куда-то","откуда-то","зачем-то","почему-то",
  "какой-то","чей-то","сколько-то","как-нибудь","когда-нибудь","где-нибудь","куда-нибудь",
  "откуда-нибудь","зачем-нибудь","какой-нибудь","кто-нибудь","что-нибудь","кое-что",
  "кое-кто","кое-какой","как","бы","если","потому","потому что","так как","поэтому",
  "значит","именно","вообще","на самом деле","по сути","по факту","кстати","между прочим",
  "к слову","во-первых","во-вторых","в-третьих","например","допустим","предположим",
  "скажем","вообще-то","кстати","между","прочим","пока что","ещё","уже","опять","снова",
  "тоже","также","более","менее","очень","совсем","чуть","чуть-чуть","едва","лишь",
  "только","исключительно","практически","фактически","по существу","в общем","в целом",
  "в принципе","в основном","прежде всего","прежде","после","перед","под","над","между",
  "среди","вокруг","вдоль","поперек","через","мимо","против","вместо","ради","благодаря",
  "несмотря","согласно","согласно","соответственно","вместе","отдельно","отдельный",
  "вместе","совместно","порознь","один","два","три","четыре","пять","шесть","семь",
  "восемь","девять","десять","первый","второй","третий","последний","последнее",
  "один","одна","одно","одни","два","две","два","три","оба","обе","каждый","каждая",
  "каждое","каждые","любой","любая","любое","любые","другой","другая","другое","другие",
  "сам","сама","само","сами","самый","самая","самое","самые","весь","вся","все","всё",
  "всякий","всякая","всякое","всякие","некий","некая","некое","некие","некоторый",
  "некоторая","некоторое","некоторые","ряд","несколько","мало","мало","немного","много",
  "много","больше","меньше","более","менее","наиболее","наименее","столько","сколько",
  "столько","сколько","достаточно","слишком","чрезмерно","крайне","весьма","вполне",
  "вовсе","отнюдь","нисколько","ничуть","никак","никоим","совершенно","абсолютно",
  "полностью","целиком","полностью","в целом","главным образом","прежде всего","вообще",
  "отчасти","частично","примерно","приблизительно","примерно","где-то","как-то","какой-то",
  "сколько-нибудь","как-нибудь","когда-нибудь","где-нибудь","какой-либо","какой-нибудь",
  "кто-либо","что-либо","ни один","ни одна","ни одно","ни одни","ничто","никто","нигде",
  "никогда","никак","нисколько","ни в коем случае","ни за что","такой","такая","такое",
  "такие","какой","какая","какое","какие","чей","чья","чье","чьи","столько","сколько",
  "этот","тот","такой","какой","который","чей","весь","вся","все","всё","всякий","каждый",
  "любой","другой","сам","самый","иной","прочий","остальной","former","latter",
  "тот же","такой же","такой же самый","один и тот же","одинаковый","похожий","подобный",
  "равный","равно","одинаково","похоже","подобно","соответственно","соответственно",
  "соответствующий","подходящий","пригодный","годный","способный","умеющий","можющий",
  "должен","обязан","вынужден","вправе","способен","готов","готовый","склонный","склонен",
  "подвержен","подверженный","склонен","склонный","склонность","предрасположенность",
  "склонность","склонен","склонна","склонно","склонны","готов","готова","готово","готовы",
  "должен","должна","должно","должны","может","можно","могу","можешь","можем","можете",
  "могут","нужно","нужен","нужна","нужны","надо","необходимо","требуется","следует",
  "стоит","пора","пришло время","время","час","пора","следует","подобает","приличествует",
  "полагается","предстоит","предстоит","предстоять","предстоящий","грядущий","будущий",
  "будущее","прошлый","прошлое","нынешний","ныне","ныне","теперь","теперь","сейчас",
  "в данный момент","в настоящее время","в последнее время","в ближайшее время",
  "однажды","когда-либо","когда-нибудь","когда-то","никогда","всегда","постоянно",
  "непрерывно","беспрерывно","непрерывно","периодически","временами","иногда","часто",
  "редко","нередко","зачастую","порой","время от времени","от случая к случаю","ежедневно",
  "еженедельно","ежемесячно","ежегодно","ежечасно","ежеминутно","постоянно","вечно",
  "навсегда","навеки","навек","раз и навсегда","навсегда","раз","дважды","трижды",
  "четырежды","впервые","вновь","снова","опять","еще раз","в другой раз","в следующий раз",
  "на этот раз","в этот раз","тогда","в то время","в тот момент","в то же время","одновременно",
  "вместе","одновременно","после","потом","затем","з afterwards","впоследствии","в дальнейшем",
  "впоследствии","в дальнейшем","впоследствии","позже","раньше","прежде","до","перед",
  "до того","прежде чем","до того как","пока","пока не","пока что","покамест","в то время как",
  "во время","в течение","в продолжение","в ходе","в процессе","по мере","по мере того как",
  "с тех пор","с того времени","оттого","оттого что","потому","потому что","благодаря тому",
  "благодаря тому что","ввиду","ввиду того","в силу","в силу того","в результате",
  "в результате того","вследствие","вследствие того","из-за","из-за того","ради","ради того",
  "затем","затем","потом","после","впоследствии","в дальнейшем","впоследствии","в дальнейшем",
  "впоследствии","в дальнейшем","в конце концов","в итоге","в конечном счете","в общем и целом",
  "в целом","в общем","итак","итого","следовательно","значит","таким образом","поэтому",
  "отсюда","оттого","стало быть","следовательно","значит","выходит","получается",
  "оказывается","получается","выходит","получается","оказывается","выходит","получается",
  "получается","оказывается","выходит","выходит","оказывается","оказывается","получается",
]);

// Generic Russian verbs that appear everywhere — penalize these
const RU_GENERIC_VERBS = new Set([
  "понимать","понять","понимаю","понимаешь","понимает","понимаем","понимаете","понимают",
  "понял","поняла","поняли","понимал","понимала","понимали","понимание","понимании",
  "объяснять","объяснить","объясняю","объясняешь","объясняет","объясняем","объясняете",
  "объясняют","объяснил","объяснила","объяснили","объяснял","объясняла","объясняли",
  "говорить","сказать","говорю","говоришь","говорит","говорим","говорите","говорят",
  "сказал","сказала","сказали","говорил","говорила","говорили","речь",
  "делать","сделать","делаю","делаешь","делает","делаем","делаете","делают",
  "сделал","сделала","сделали","делал","делала","делали","дело","дела",
  "работать","работаю","работаешь","работает","работаем","работаете","работают",
  "работал","работала","работали","работа","работы",
  "смотреть","посмотреть","смотрю","смотришь","смотрит","смотрим","смотрите","смотрят",
  "посмотрел","посмотрела","посмотрели","смотрел","смотрела","смотрели",
  "знать","узнать","знаю","знаешь","знает","знаем","знаете","знают",
  "узнал","узнала","узнали","знал","знала","знали","знание","знания",
  "думать","подумать","думаю","думаешь","думает","думаем","думаете","думают",
  "подумал","подумала","подумали","думал","думала","думали","мысль","мысли",
  "считать","считаю","считаешь","считает","считаем","считаете","считают",
  "считал","считала","считали","счет","счета",
  "хотеть","захотеть","хочу","хочешь","хочет","хотим","хотите","хотят",
  "захотел","захотела","захотели","хотел","хотела","хотели",
  "мочь","смочь","могу","можешь","может","можем","можете","могут",
  "смог","смогла","смогли","мог","могла","могли",
  "начать","начинать","начну","начнешь","начнет","начнем","начнете","начнут",
  "начал","начала","начали","начинал","начинала","начинали","начало","начала",
  "кончить","кончать","кончил","кончила","кончили","конец","конца","конце",
  "стать","становиться","стану","станешь","станет","станем","станете","станут",
  "стал","стала","стали","становился","становилась","становились",
  "жить","прожить","живу","живешь","живет","живем","живете","живут",
  "прожил","прожила","прожили","жил","жила","жили","жизнь",
  "иметь","имею","имеешь","имеет","имеем","имеете","имеют","имел","имела","имели",
  "есть","кушать","поесть","ем","ешь","ест","едим","едите","едят",
  "пить","выпить","пью","пьешь","пьет","пьем","пьете","пьют",
  "идти","пойти","иду","идешь","идет","идем","идете","идут",
  "пошел","пошла","пошли","шел","шла","шли",
  "ехать","поехать","еду","едешь","едет","едем","едете","едут",
  "сидеть","посидеть","сижу","сидишь","сидит","сидим","сидите","сидят",
  "стоять","постоять","стою","стоишь","стоит","стоим","стоите","стоят",
  "лежать","полежать","лежу","лежишь","лежит","лежим","лежите","лежат",
  "брать","взять","беру","берешь","берет","берем","берете","берут",
  "взял","взяла","взяли","брал","брала","брали",
  "давать","дать","даю","даешь","дает","даем","даете","дают",
  "дал","дала","дали","давал","давала","давали",
]);

const ALL_STOPWORDS = new Set([...EN_STOPWORDS, ...RU_STOPWORDS]);

function normalizeRu(word: string): string {
  // Normalize Russian ё→е for consistent stopword matching
  return word.toLowerCase().replace(/ё/g, "е");
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
  return ALL_STOPWORDS.has(normalizeRu(word));
}

function isGenericVerb(word: string): boolean {
  return RU_GENERIC_VERBS.has(normalizeRu(word));
}

function isJunk(phrase: string): boolean {
  if (/^\d+$/.test(phrase)) return true;
  if (phrase.length < 3) return true;
  if (phrase.length > 40) return true;
  if (/^https?:\/\//.test(phrase)) return true;
  if (/^www\./.test(phrase)) return true;
  if (/\d{4,}/.test(phrase)) return true;
  return false;
}

function isValidNgram(words: string[]): boolean {
  if (words.length === 1) {
    const w = normalizeRu(words[0]);
    return !ALL_STOPWORDS.has(w) && !isGenericVerb(w);
  }
  const first = normalizeRu(words[0]);
  const last = normalizeRu(words[words.length - 1]);
  if (ALL_STOPWORDS.has(first) || ALL_STOPWORDS.has(last)) return false;
  // Penalize but don't fully reject phrases containing generic verbs
  return true;
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

function calculateScore(
  phrase: string,
  tf: number,
  corpusPhrases: Map<string, number>,
  titlePhrases: Set<string>,
  titleWords: Set<string>
): number {
  const normalized = phrase.toLowerCase();
  const words = normalized.split(" ");

  const docCount = corpusPhrases.get(normalized) || 1;
  const totalDocs = Math.max(corpusPhrases.size, 1);
  const idf = Math.log(totalDocs / docCount) + 1;

  let score = tf * idf;

  // Strong phrase length bonus
  if (phrase.includes(" ")) {
    score *= 1 + words.length * 0.8;
  }

  // Title boost: phrases in title get 3x
  if (titlePhrases.has(normalized)) {
    score *= 3.0;
  }

  // Partial title word boost: words from title get 2x
  const titleWordMatches = words.filter((w) => titleWords.has(w)).length;
  if (titleWordMatches > 0) {
    score *= 1 + titleWordMatches * 0.5;
  }

  // Generic verb penalty
  const genericVerbCount = words.filter((w) => isGenericVerb(w)).length;
  if (genericVerbCount > 0) {
    score *= Math.pow(0.3, genericVerbCount);
  }

  // Unigram penalty (single words are less specific)
  if (words.length === 1) {
    score *= 0.6;
  }

  return score;
}

export interface TagResult {
  name: string;
  score: number;
}

export function extractTags(
  title: string,
  description: string | null,
  transcript: string | null,
  options: { maxTags?: number; corpusPhrases?: Map<string, number> } = {}
): TagResult[] {
  const { maxTags = 8, corpusPhrases = new Map() } = options;

  const combined = [title, description || "", transcript || ""].join(" ");
  if (!combined.trim()) return [];

  const tokens = tokenize(combined);
  if (tokens.length === 0) return [];

  // Title tokens for boosting
  const titleTokens = tokenize(title);
  const titleWords = new Set(titleTokens.map((t) => normalizeRu(t)));
  const titlePhrases = new Set<string>();
  for (let n = 1; n <= 3; n++) {
    for (const phrase of getNgrams(titleTokens, n)) {
      titlePhrases.add(phrase.toLowerCase());
    }
  }

  // Collect all valid n-grams
  const allPhrases: string[] = [];
  for (let n = 1; n <= 3; n++) {
    allPhrases.push(...getNgrams(tokens, n));
  }

  const validPhrases = allPhrases.filter((p) => !isJunk(p));
  if (validPhrases.length === 0) return [];

  // Count frequencies
  const docFreq = new Map<string, number>();
  for (const phrase of validPhrases) {
    docFreq.set(phrase, (docFreq.get(phrase) || 0) + 1);
  }

  // Score each phrase
  const scores = new Map<string, number>();
  for (const [phrase, tf] of docFreq) {
    scores.set(phrase, calculateScore(phrase, tf, corpusPhrases, titlePhrases, titleWords));
  }

  // Sort and deduplicate
  const sorted = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);

  const result: TagResult[] = [];
  const seen = new Set<string>();

  for (const [phrase, score] of sorted) {
    if (result.length >= maxTags) break;
    const normalized = phrase.toLowerCase();

    // Skip if this phrase is a substring of an already selected longer phrase
    const isSubset = Array.from(seen).some((s) =>
      s.includes(normalized) || normalized.includes(s)
    );
    if (!isSubset || seen.size === 0) {
      result.push({ name: phrase, score: Math.round(score * 100) / 100 });
      seen.add(normalized);
    }
  }

  return result;
}

export function buildCorpus(
  videoTexts: { title: string; description: string | null; transcript: string | null }[]
): Map<string, number> {
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
