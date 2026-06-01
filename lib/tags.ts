/**
 * Tag extraction from video text (title + transcript).
 * Focus: semantically meaningful single-word topics and curated title phrases.
 * Avoids transcript noise — bigrams/trigrams from speech are almost always garbage.
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
  "use","uses","course","courses","process","processes","result","results","change",
  "changes","job","jobs","car","cars","city","cities","line","body","bodies","face",
  "faces","door","doors","game","games","health","interest","interests","level","levels",
  "minute","minutes","moment","moments","month","months","night","nights","reason",
  "reasons","room","rooms","street","streets","team","teams","week","weeks","paper",
  "papers","section","sections","access","view","views","today","tomorrow","yesterday",
  "tonight","morning","evening","afternoon","weekend","ago","recently","already","soon",
  "later","finally","eventually","suddenly","immediately","quickly","slowly","easily",
  "hardly","recent","next","previous","current","different","important","special",
  "available","possible","certain","clear","true","false","whole","half","full","empty",
  "free","open","closed","ready","able","unable","likely","unlikely","similar","various",
  "general","specific","particular","common","normal","usual","regular","simple","easy",
  "difficult","hard","strong","weak","fast","slow","deep","wide","narrow","large","huge",
  "tiny","bright","dark","light","heavy","thick","thin","soft","smooth","rough","wet",
  "dry","hot","cold","warm","cool","clean","dirty","safe","dangerous","happy","sad",
  "angry","afraid","surprised","tired","busy","quiet","loud","nice","kind","rude",
  "friendly","unfriendly","polite","impolite","funny","serious","boring","interesting",
  "exciting","beautiful","ugly","pretty","handsome","attractive","unattractive","rich",
  "poor","expensive","cheap","modern","ancient","fresh","stale","correct","wrong",
  "exact","accurate","perfect","complete","incomplete","total","partial","absolute",
  "relative","positive","negative","active","passive","direct","indirect","main","major",
  "minor","primary","secondary","final","initial","original","copy","real","fake","actual",
  "official","unofficial","public","private","personal","professional","local","global",
  "national","international","domestic","foreign","away","inside","outside","indoor",
  "outdoor","upper","lower","top","bottom","front","back","center","middle","edge","corner",
  "side","end","start","beginning","finish",
]);

const RU_STOPWORDS = new Set([
  "и","в","во","на","с","со","по","к","ко","о","об","обо","от","до","за","из","под",
  "при","про","через","над","не","но","а","или","что","чтоб","чтобы","как","когда",
  "для","без","да","нет","ни","пусть","хотя","ибо","вне",
  "где","почему","зачем","кто","который","которая","которое","которые","этот","эта",
  "это","эти","тот","та","то","те","так","такой","такая","такое","такие","весь","вся",
  "все","всё","мой","моя","мое","мои","твой","твоя","твое","твои","его","ее","её",
  "их","наш","наша","наше","наши","ваш","ваша","ваше","ваши","свой","своя","свое",
  "свои","я","ты","он","она","оно","мы","вы","они","меня","тебя","нас","вас","мне",
  "тебе","ему","ей","нам","вам","им","мной","тобой","им","ей","нами","вами","ими",
  "себе","себя","собой","собою","был","была","было","были","быть","есть","иметь",
  "имеет","имеют","имел","имела","буду","будешь","будет","будем","будете","будут",
  "будь","будьте","может","можно","могу","можешь","можем","можете","могут","мог",
  "могла","могли","должен","должна","должно","должны","нужно","нужен","нужна","нужны",
  "надо","надобно","необходимо","важно","важен","важна","важны","хорошо","плохо",
  "лучше","хуже","больше","меньше","много","мало","немного","немало","всего","только",
  "лишь","просто","даже","особенно","очень","слишком","достаточно","совсем","совершенно",
  "абсолютно","почти","примерно","еще","уже","тоже","также","тогда","сейчас","сегодня",
  "вчера","завтра","всегда","никогда","иногда","часто","редко","обычно","конечно",
  "безусловно","несомненно","действительно","правда","вероятно","возможно","похоже",
  "кажется","видимо","очевидно","ясно","понятно","известно","говорят","слышно","видно",
  "заметно","ну","вот","так","вроде","типа","однако","тем","тем не менее","все-таки",
  "все","все же","пока","уже","ещё","опять","снова","вновь","назад","вперед","вперёд",
  "вниз","вверх","сюда","туда","отсюда","оттуда","здесь","там","тут","где-то","когда-то",
  "как-то","что-то","кто-то","куда-то","откуда-то","зачем-то","почему-то","какой-то",
  "чей-то","сколько-то","как-нибудь","когда-нибудь","где-нибудь","куда-нибудь",
  "откуда-нибудь","зачем-нибудь","какой-нибудь","кто-нибудь","что-нибудь","кое-что",
  "кое-кто","кое-какой","как","бы","если","потому","потому что","так как","поэтому",
  "значит","именно","вообще","на самом деле","по сути","по факту","кстати","между прочим",
  "к слову","во-первых","во-вторых","в-третьих","например","допустим","предположим",
  "скажем","вообще-то","между","прочим","пока что","опять","снова","тоже","также",
  "более","менее","чуть","чуть-чуть","едва","исключительно","практически","фактически",
  "по существу","в общем","в целом","в принципе","в основном","прежде всего","прежде",
  "после","перед","между","среди","вокруг","вдоль","поперек","мимо","против","вместо",
  "ради","благодаря","несмотря","согласно","соответственно","вместе","отдельно","порознь",
  "один","два","три","четыре","пять","шесть","семь","восемь","девять","десять","первый",
  "второй","третий","последний","последнее","одна","одно","оба","обе","каждый","каждая",
  "каждое","каждые","любой","любая","любое","любые","другой","другая","другое","другие",
  "сам","сама","само","сами","самый","самая","самое","самые","всякий","всякая","всякое",
  "всякие","некий","некая","некое","некие","некоторый","некоторая","некоторое","некоторые",
  "ряд","несколько","столько","сколько","достаточно","слишком","чрезмерно","крайне",
  "весьма","вполне","вовсе","отнюдь","нисколько","ничуть","никак","никоим","совершенно",
  "полностью","целиком","отчасти","частично","приблизительно","где-то","как-то","какой-то",
  "сколько-нибудь","как-нибудь","когда-нибудь","где-нибудь","какой-либо","кто-либо",
  "что-либо","ни один","ни одна","ни одно","ни одни","ничто","никто","нигде","никогда",
  "ни за что","такой","такая","такое","такие","какой","какая","какое","какие","чей",
  "чья","чье","чьи","этот","тот","такой","какой","который","чей","весь","вся","все",
  "всё","всякий","каждый","любой","другой","сам","самый","иной","прочий","остальной",
  "тот же","такой же","один и тот же","одинаковый","похожий","подобный","равный","равно",
  "одинаково","похоже","подобно","соответственно","соответствующий","подходящий",
  "пригодный","годный","способный","умеющий","можущий","должен","обязан","вынужден",
  "вправе","способен","готов","готовый","склонный","склонен","подвержен","подверженный",
  "готов","готова","готово","готовы","нужно","нужен","нужна","нужны","надо","необходимо",
  "требуется","следует","стоит","пора","пришло время","время","час","следует","подобает",
  "полагается","предстоит","предстоять","предстоящий","грядущий","будущий","будущее",
  "прошлый","прошлое","нынешний","ныне","теперь","сейчас","в данный момент",
  "в настоящее время","в последнее время","в ближайшее время","однажды","когда-либо",
  "когда-нибудь","когда-то","всегда","постоянно","непрерывно","беспрерывно","периодически",
  "временами","порой","время от времени","от случая к случаю","ежедневно","еженедельно",
  "ежемесячно","ежегодно","ежечасно","ежеминутно","вечно","навсегда","навеки","навек",
  "раз и навсегда","раз","дважды","трижды","четырежды","впервые","вновь","снова","опять",
  "еще раз","в другой раз","в следующий раз","на этот раз","в этот раз","тогда",
  "в то время","в тот момент","в то же время","одновременно","вместе","после","потом",
  "затем","впоследствии","в дальнейшем","позже","раньше","до","перед","до того",
  "прежде чем","до того как","пока","пока не","пока что","покамест","в то время как",
  "во время","в течение","в продолжение","в ходе","в процессе","по мере","по мере того как",
  "с тех пор","с того времени","оттого","оттого что","благодаря тому","благодаря тому что",
  "ввиду","в силу","в результате","вследствие","из-за","ради",
]);

const ALL_STOPWORDS = new Set([...EN_STOPWORDS, ...RU_STOPWORDS]);

// Generic verbs that appear everywhere — heavily penalize these
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
  "проверить","проверил","проверила","проверили","проверяю","проверяет","проверяем",
  "показать","показал","показала","показали","показываю","показывает","показываем",
  "рассказать","рассказал","рассказала","рассказали","рассказываю","рассказывает",
  "тестировать","тестирую","тестирует","тест","тестил","тестила",
  "сравнить","сравнил","сравнила","сравниваю","сравнивает",
  "купить","купил","купила","покупаю","покупает","покупаем",
  "найти","нашел","нашла","находить","нахожу","находит","находим",
  "использовать","использовал","использую","использует","используем",
  "попробовать","попробовал","пробую","пробует","пробуем",
  "показать","показал","показываю","показывает",
  "рассказать","рассказал","рассказываю","рассказывает",
  "обзор","тест","тестирование","проверка","сравнение",
  "потерять","потерял","потеряла","теряю","теряет","теряем",
  "спросить","спросил","спросила","спрашиваю","спрашивает",
  "ответить","ответил","ответила","отвечаю","отвечает",
  "понравиться","понравилось","нравится","нравится",
  "забыть","забыл","забыла","забываю","забывает",
  "вспомнить","вспомнил","вспомнила","вспоминаю","вспоминает",
  "ждать","ждал","ждала","жду","ждет","ждем",
  "получить","получил","получила","получаю","получает","получаем",
  "отправить","отправил","отправила","отправляю","отправляет",
  "взять","взял","взяла","беру","берет","берем",
  "поставить","поставил","поставила","ставлю","ставит","ставим",
  "сидеть","сидел","сидела","сижу","сидит","сидим",
]);

// Phrases that are common in descriptions/transcripts but meaningless as tags
const JUNK_PHRASES = new Set([
  // RU conversational fragments
  "самом деле", "до сих пор", "вне очереди", "по сути", "по факту",
  "в общем", "в целом", "в принципе", "в основном", "в данный момент",
  "в настоящее время", "в последнее время", "в ближайшее время",
  "тем не менее", "таким образом", "вместе с тем", "в связи с",
  "в отличие от", "в результате", "в зависимости от", "в рамках",
  "в ходе", "в процессе", "в течение", "в продолжение",
  // EN conversational fragments
  "in fact", "of course", "as well", "at all", "at least", "at most",
  "for example", "such as", "due to", "according to", "based on",
  "depending on", "in terms of", "in order to", "in addition to",
  "with respect to", "with regard to", "in relation to", "in connection with",
  "as a result", "as well as", "as opposed to", "as long as", "as soon as",
  "in general", "in particular", "in summary", "in conclusion",
  "on the other hand", "by the way", "for instance", "in other words",
  "in my opinion", "i think", "i believe", "you know", "i mean",
  // Description CTA fragments (RU)
  "выходы новых", "новых роликов", "выходы новых роликов",
  "моих видео", "развитие этого", "развитие этого канала",
  "поддержите выходы", "вне очереди",
  "прямойэфир вокал", "вокал шортс", "музыка прямойэфир",
  "пою для", "для тебя", "тебя музыка",
  // Description CTA fragments (EN)
  "check out", "subscribe to", "follow me", "follow us", "follow my",
  "buy now", "order now", "download now", "visit our", "visit my",
  "links from", "links in", "apply to join", "apply now",
  "support my", "support our", "contact me", "contact us",
  "click the", "click here", "click link", "join the",
  // Generic filler
  "rapidly evolving", "evolving field", "rapidly evolving field",
  "going to", "trying to", "want to", "need to", "have to", "going make",
  "really like", "really good", "really great", "most important",
]);

function normalizeRu(word: string): string {
  return word.toLowerCase().replace(/ё/g, "е");
}

/**
 * Strip timestamps and other non-content patterns from text before tokenization.
 */
function stripJunkPatterns(text: string): string {
  return (
    text
      .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, " ")
      .replace(/[\[(]\d{1,2}:\d{2}(?::\d{2})?[\])]/g, " ")
      .replace(/https?:\/\/\S+/gi, " ")
      .replace(/\b(?:www|http|https)\b/gi, " ")
      .replace(/\b\w+\.(?:com|org|net|io|co|ru|uk|de|fr|jp|cn|ai|app|dev|tv|me|info|biz)\b/gi, " ")
      .replace(/\b\.(?:com|org|net|io|co|ru)\b/gi, " ")
      .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, " ")
      .replace(/[@#]\w+/g, " ")
      .replace(/\b\w+\.(?:mp4|mp3|pdf|jpg|jpeg|png|gif|doc|docx|zip|exe)\b/gi, " ")
      .replace(/\b\d+\s*(?:fps|ft|mph|km\/h|km|m\/s|hz|dpi|px|pt|cm|mm|gb|mb|tb|kg|lb|oz|ms|ns|m|am|pm| volts| watts| amps)\b/gi, " ")
      .replace(/\b(?:v?\d+\.\d+(?:\.\d+)?)\b/g, " ")
      .replace(/\b\+?\d[\d\s\-]{6,}\d\b/g, " ")
      .replace(/[\*\-_]{2,}/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function tokenize(text: string): string[] {
  const cleaned = stripJunkPatterns(text);
  return cleaned
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
  if (phrase.length < 4) return true;
  if (phrase.length > 40) return true;
  if (/^\d+$/.test(phrase)) return true;
  if (/^\d{2}\s+\d{2}(\s+\d{2})?$/.test(phrase)) return true;
  if (/^\d{2}\s+\d{2}\b/.test(phrase)) return true;
  if (/^\d+\s/.test(phrase)) return true;
  if (/\d{4,}/.test(phrase)) return true;
  const digits = (phrase.match(/\d/g) || []).length;
  if (digits > 0 && digits / phrase.length > 0.3) return true;
  const words = phrase.split(/\s+/);
  for (const w of words) {
    const wDigits = (w.match(/\d/g) || []).length;
    if (w.length >= 2 && wDigits / w.length > 0.5) return true;
  }
  if (/^https?:\/\//.test(phrase)) return true;
  if (/^www\./.test(phrase)) return true;
  if (/\bwww\b/.test(phrase)) return true;
  if (/\bhttps?\b/.test(phrase)) return true;
  if (/\.(com|org|net|io|co|ru|uk|de|fr|jp|cn|ai|app|dev|tv|me|info|biz)$/i.test(phrase)) return true;
  if (/\.(mp4|mp3|pdf|jpg|jpeg|png|gif|doc|docx|zip|exe)$/i.test(phrase)) return true;
  if (phrase.includes("@")) return true;
  if (/^[@#]/.test(phrase)) return true;
  const uniqueWords = new Set(words);
  if (uniqueWords.size < words.length) return true;
  const stopCount = words.filter((w) => isStopWord(w)).length;
  if (words.length >= 2 && stopCount / words.length >= 0.5) return true;
  if (words.length === 1 && words[0].length < 4) return true;
  if (phrase.includes("_")) return true;
  if (/\b0x[0-9a-f]+\b/i.test(phrase)) return true;
  if (/\b(?=.*[a-z]{3})(?=.*\d{2})[a-z\d]{10,}\b/i.test(phrase)) return true;

  // Known junk phrases
  if (JUNK_PHRASES.has(phrase.toLowerCase())) return true;

  const lower = phrase.toLowerCase();
  const ctaStarters = [
    "checkout our", "check out our", "subscribe to", "подписывайтесь",
    "follow me", "follow us", "follow my", "buy now", "order now",
    "download now", "download the", "visit our", "visit my",
    "links from", "links in", "apply to join", "apply now",
    "support my", "support our", "contact me", "contact us",
    "click the", "click here", "click link",
  ];
  if (ctaStarters.some((s) => lower.startsWith(s))) return true;

  return false;
}

/**
 * Strict validation for n-grams. Multi-word phrases must have ALL words be meaningful.
 */
function isValidNgram(words: string[], minWordLength = 2): boolean {
  if (words.length === 1) {
    const w = normalizeRu(words[0]);
    return !ALL_STOPWORDS.has(w) && !isGenericVerb(w);
  }
  // For multi-word: ALL words must be non-stopwords and non-generic-verbs
  for (const word of words) {
    const w = normalizeRu(word);
    if (ALL_STOPWORDS.has(w) || isGenericVerb(w)) return false;
    if (word.length < minWordLength) return false;
  }
  return true;
}

function splitTextIntoSentences(text: string): string[] {
  return text
    .replace(/([.!?])(\s+|$)/g, "$1\n")
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function getNgramsFromSentence(tokens: string[], n: number): string[] {
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
  titleWords: Set<string>,
  isFromTitle: boolean
): number {
  const normalized = phrase.toLowerCase();
  const words = normalized.split(" ");

  const docCount = corpusPhrases.get(normalized) || 1;
  const totalDocs = Math.max(corpusPhrases.size, 1);
  const idf = Math.log(totalDocs / docCount) + 1;

  let score = tf * idf;

  // Title boost: exact phrases in title get a strong boost
  if (titlePhrases.has(normalized)) {
    score *= 3.5;
  }

  // Partial title word boost
  const titleWordMatches = words.filter((w) => titleWords.has(w)).length;
  if (titleWordMatches > 0) {
    score *= 1 + titleWordMatches * 0.4;
  }

  // Generic verb penalty
  const genericVerbCount = words.filter((w) => isGenericVerb(w)).length;
  if (genericVerbCount > 0) {
    score *= Math.pow(0.2, genericVerbCount);
  }

  // Moderate bonus for multi-word phrases — but ONLY if from title or high frequency
  if (words.length >= 2) {
    if (isFromTitle) {
      // Title bigrams/trigrams are curated — modest bonus
      score *= 1.2;
    } else if (tf >= 3) {
      // Transcript n-gram must appear 3+ times to be a real phrase
      score *= 1.1;
    } else {
      // Low-frequency transcript n-gram — heavily penalize
      score *= 0.15;
    }
  }

  // Unigram penalty — single words need higher TF-IDF to compete
  if (words.length === 1) {
    score *= 0.65;
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

  // Title is the most reliable signal — repeat it for weight
  const titleText = title;
  const transcriptText = transcript || "";

  // ── Extract title phrases ──
  const titleSentences = splitTextIntoSentences(titleText);
  const titleTokens = titleSentences.flatMap((s) => tokenize(s));
  const titleWords = new Set(titleTokens.map((t) => normalizeRu(t)));
  const titlePhrases = new Set<string>();
  const titlePhraseList: string[] = [];

  for (let n = 1; n <= 3; n++) {
    for (const sentence of titleSentences) {
      for (const phrase of getNgramsFromSentence(tokenize(sentence), n)) {
        titlePhrases.add(phrase.toLowerCase());
        titlePhraseList.push(phrase);
      }
    }
  }

  // ── Extract transcript phrases ──
  const bodySentences = splitTextIntoSentences(transcriptText);
  const bodyPhraseList: string[] = [];

  // Only unigrams from body text — body bigrams/trigrams are almost always noise
  for (const sentence of bodySentences) {
    bodyPhraseList.push(...getNgramsFromSentence(tokenize(sentence), 1));
  }

  // ── Combine all phrases ──
  const allPhrases = [
    ...titlePhraseList.map((p) => ({ phrase: p, fromTitle: true })),
    ...bodyPhraseList.map((p) => ({ phrase: p, fromTitle: false })),
  ];

  const validPhrases = allPhrases.filter((p) => !isJunk(p.phrase));
  if (validPhrases.length === 0) return [];

  // Count frequencies per source
  const titleFreq = new Map<string, number>();
  const bodyFreq = new Map<string, number>();

  for (const { phrase, fromTitle } of validPhrases) {
    if (fromTitle) {
      titleFreq.set(phrase, (titleFreq.get(phrase) || 0) + 1);
    } else {
      bodyFreq.set(phrase, (bodyFreq.get(phrase) || 0) + 1);
    }
  }

  // Total frequency = title + body
  const totalFreq = new Map<string, number>();
  for (const [phrase, count] of titleFreq) {
    totalFreq.set(phrase, (totalFreq.get(phrase) || 0) + count);
  }
  for (const [phrase, count] of bodyFreq) {
    totalFreq.set(phrase, (totalFreq.get(phrase) || 0) + count);
  }

  // Score each phrase
  const scores = new Map<string, number>();
  for (const [phrase, tf] of totalFreq) {
    // Reject multi-word phrases that appear on too many videos — they're formulaic
    if (phrase.includes(" ")) {
      const corpusCount = corpusPhrases.get(phrase.toLowerCase()) || 0;
      if (corpusCount > 80) continue;
    }
    const isFromTitle = titleFreq.has(phrase);
    scores.set(
      phrase,
      calculateScore(phrase, tf, corpusPhrases, titlePhrases, titleWords, isFromTitle)
    );
  }

  // Sort and deduplicate
  const sorted = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);

  const result: TagResult[] = [];
  const seen = new Set<string>();

  for (const [phrase, score] of sorted) {
    if (result.length >= maxTags) break;
    const normalized = phrase.toLowerCase();

    // Skip if this phrase is a substring of an already selected longer phrase,
    // or vice versa (but keep both if they're genuinely different topics)
    const isSubset = Array.from(seen).some((s) =>
      s !== normalized && (s.includes(normalized) || normalized.includes(s))
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
    const titleSentences = splitTextIntoSentences(title);
    const bodySentences = splitTextIntoSentences(transcript || "");
    const docPhrases = new Set<string>();

    // Title n-grams (up to trigram)
    for (let n = 1; n <= 3; n++) {
      for (const sentence of titleSentences) {
        for (const phrase of getNgramsFromSentence(tokenize(sentence), n)) {
          if (!isJunk(phrase)) {
            docPhrases.add(phrase.toLowerCase());
          }
        }
      }
    }

    // Body unigrams only
    for (const sentence of bodySentences) {
      for (const phrase of getNgramsFromSentence(tokenize(sentence), 1)) {
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
