export type SpecialCharacterGroupId =
  | 'recent'
  | 'symbols'
  | 'latin'
  | 'ipa'
  | 'greek'
  | 'cyrillic'
  | 'arabic'
  | 'hebrew'
  | 'armenian'
  | 'georgian'
  | 'devanagari'
  | 'bengali'
  | 'gurmukhi'
  | 'gujarati'
  | 'oriya'
  | 'tamil'
  | 'telugu'
  | 'kannada'
  | 'malayalam'
  | 'sinhala'
  | 'thai'
  | 'lao'
  | 'tibetan'
  | 'myanmar'
  | 'khmer'
  | 'ethiopic'
  | 'canadian-aboriginal'
  | 'cherokee'
  | 'tifinagh'
  | 'arabic-extended';

export interface SpecialCharacterItem {
  char: string;
  name: string;
  codepoint: string;
}

export interface SpecialCharacterGroup {
  id: Exclude<SpecialCharacterGroupId, 'recent'>;
  label: string;
  shortLabel: string;
  description: string;
  rtl?: boolean;
  characters: SpecialCharacterItem[];
}

export const toCodepoint = (char: string): string => {
  const cp = char.codePointAt(0);
  if (cp === undefined) return 'U+0000';
  return `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;
};

const makeItems = (entries: Array<[string, string]>): SpecialCharacterItem[] =>
  entries.map(([char, name]) => ({
    char,
    name,
    codepoint: toCodepoint(char),
  }));

const makeCodepointList = (chars: string[], scriptName: string): SpecialCharacterItem[] =>
  chars.map(char => ({
    char,
    name: `${scriptName} (${toCodepoint(char)})`,
    codepoint: toCodepoint(char),
  }));

export const RECENT_SPECIAL_CHARS_STORAGE_KEY = 'notmediawiki_recent_special_chars_v1';
export const MAX_RECENT_SPECIAL_CHARS = 24;

export function loadRecentSpecialChars(): SpecialCharacterItem[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(RECENT_SPECIAL_CHARS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is SpecialCharacterItem => Boolean(item && typeof item.char === 'string'))
      .slice(0, MAX_RECENT_SPECIAL_CHARS);
  } catch {
    return [];
  }
}

export function recordRecentSpecialChar(
  char: string,
  name?: string,
  prev: SpecialCharacterItem[] = loadRecentSpecialChars()
): SpecialCharacterItem[] {
  if (!char) return prev;
  const entry: SpecialCharacterItem = {
    char,
    name: name || `Caractere recente (${char})`,
    codepoint: toCodepoint(char),
  };
  const next = [entry, ...prev.filter(item => item.char !== char)].slice(0, MAX_RECENT_SPECIAL_CHARS);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(RECENT_SPECIAL_CHARS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  }
  return next;
}

export const SPECIAL_CHARACTER_GROUPS: SpecialCharacterGroup[] = [
  {
    id: 'symbols',
    label: 'Símbolos',
    shortLabel: 'Símbolos',
    description: 'Pontuação tipográfica, operadores matemáticos, moedas, setas e sinais editoriais.',
    characters: makeItems([
      ['–', 'Meia-risca (En dash)'],
      ['—', 'Travessão (Em dash)'],
      ['…', 'Reticências'],
      ['«', 'Aspas angulares esquerda'],
      ['»', 'Aspas angulares direita'],
      ['“', 'Aspas duplas esquerdas'],
      ['”', 'Aspas duplas direitas'],
      ['‘', 'Aspas simples esquerda'],
      ['’', 'Aspas simples direita'],
      ['§', 'Parágrafo jurídico (Seção)'],
      ['¶', 'Caldeirão (Pilcrow)'],
      ['†', 'Óbelo (Adaga)'],
      ['‡', 'Óbelo duplo'],
      ['•', 'Marcador (Bullet)'],
      ['·', 'Ponto mediano'],
      ['©', 'Direitos autorais (Copyright)'],
      ['®', 'Marca registrada'],
      ['™', 'Marca comercial (TM)'],
      ['°', 'Grau'],
      ['′', 'Linha / Minuto / Pé'],
      ['″', 'Dupla linha / Segundo / Polegada'],
      ['±', 'Mais ou menos'],
      ['×', 'Multiplicação'],
      ['÷', 'Divisão'],
      ['≠', 'Diferente de'],
      ['≈', 'Aproximadamente igual'],
      ['≤', 'Menor ou igual'],
      ['≥', 'Maior ou igual'],
      ['∞', 'Infinito'],
      ['√', 'Raiz quadrada'],
      ['∑', 'Somatório'],
      ['∏', 'Produtório'],
      ['∫', 'Integral'],
      ['∂', 'Derivada parcial'],
      ['∇', 'Nabla / Gradiente'],
      ['∈', 'Pertence a'],
      ['∉', 'Não pertence a'],
      ['∅', 'Conjunto vazio'],
      ['∀', 'Para todo'],
      ['∃', 'Existe'],
      ['←', 'Seta esquerda'],
      ['→', 'Seta direita'],
      ['↑', 'Seta cima'],
      ['↓', 'Seta baixo'],
      ['↔', 'Seta bidirecional'],
      ['⇒', 'Implica'],
      ['⇔', 'Equivale (Se e somente se)'],
      ['€', 'Euro'],
      ['£', 'Libra esterlina'],
      ['¥', 'Iene / Yuan'],
      ['¢', 'Centavo'],
      ['₹', 'Rupia indiana'],
      ['₽', 'Rublo russo'],
      ['✓', 'Marca de verificação'],
      ['✕', 'Marca de negação'],
      ['★', 'Estrela preenchida'],
      ['☆', 'Estrela vazia'],
    ]),
  },
  {
    id: 'latin',
    label: 'Latino / Latino estendido',
    shortLabel: 'Latino',
    description: 'Acentos, diacríticos e ligaduras do alfabeto latino e latino estendido.',
    characters: makeCodepointList(
      [
        'À', 'Á', 'Â', 'Ã', 'Ä', 'Å', 'Æ', 'Ç', 'È', 'É', 'Ê', 'Ë', 'Ì', 'Í', 'Î', 'Ï', 'Ð', 'Ñ', 'Ò', 'Ó', 'Ô', 'Õ', 'Ö', 'Ø', 'Ù', 'Ú', 'Û', 'Ü', 'Ý', 'Þ', 'ß',
        'à', 'á', 'â', 'ã', 'ä', 'å', 'æ', 'ç', 'è', 'é', 'ê', 'ë', 'ì', 'í', 'î', 'ï', 'ð', 'ñ', 'ò', 'ó', 'ô', 'õ', 'ö', 'ø', 'ù', 'ú', 'û', 'ü', 'ý', 'þ', 'ÿ',
        'Ā', 'ā', 'Ă', 'ă', 'Ą', 'ą', 'Ć', 'ć', 'Ĉ', 'ĉ', 'Ċ', 'ċ', 'Č', 'č', 'Ď', 'ď', 'Đ', 'đ',
        'Ē', 'ē', 'Ĕ', 'ĕ', 'Ė', 'ė', 'Ę', 'ę', 'Ě', 'ě', 'Ĝ', 'ĝ', 'Ğ', 'ğ', 'Ġ', 'ġ', 'Ģ', 'ģ',
        'Ĥ', 'ĥ', 'Ħ', 'ħ', 'Ĩ', 'ĩ', 'Ī', 'ī', 'Ĭ', 'ĭ', 'Į', 'į', 'İ', 'ı', 'Ĵ', 'ĵ', 'Ķ', 'ķ',
        'Ĺ', 'ĺ', 'Ļ', 'ļ', 'Ľ', 'ľ', 'Ł', 'ł', 'Ń', 'ń', 'Ņ', 'ņ', 'Ň', 'ň', 'Ő', 'ő', 'Œ', 'œ',
        'Ŕ', 'ŕ', 'Ŗ', 'ŗ', 'Ř', 'ř', 'Ś', 'ś', 'Ŝ', 'ŝ', 'Ş', 'ş', 'Š', 'š', 'Ţ', 'ţ', 'Ť', 'ť',
        'Ũ', 'ũ', 'Ū', 'ū', 'Ŭ', 'ŭ', 'Ů', 'ů', 'Ű', 'ű', 'Ų', 'ų', 'Ŵ', 'ŵ', 'Ŷ', 'ŷ', 'Ÿ', 'Ź', 'ź', 'Ż', 'ż', 'Ž', 'ž',
      ],
      'Latino'
    ),
  },
  {
    id: 'ipa',
    label: 'AFI (IPA)',
    shortLabel: 'IPA',
    description: 'Alfabeto Fonético Internacional: vogais, consoantes, cliques e sinais suprassegmentais.',
    characters: makeItems([
      ['ə', 'Schwa (vogal média central)'],
      ['ɛ', 'Vogal semiaberta anterior não arredondada'],
      ['ɔ', 'Vogal semiaberta posterior arredondada'],
      ['ɑ', 'Vogal aberta posterior não arredondada'],
      ['ɒ', 'Vogal aberta posterior arredondada'],
      ['æ', 'Vogal quase aberta anterior não arredondada'],
      ['ɐ', 'Vogal quase aberta central'],
      ['ɜ', 'Vogal semiaberta central não arredondada'],
      ['ʌ', 'Vogal semiaberta posterior não arredondada'],
      ['ɪ', 'Vogal quase fechada anterior não arredondada'],
      ['ʊ', 'Vogal quase fechada posterior arredondada'],
      ['ʏ', 'Vogal quase fechada anterior arredondada'],
      ['ɨ', 'Vogal fechada central não arredondada'],
      ['ʉ', 'Vogal fechada central arredondada'],
      ['ɯ', 'Vogal fechada posterior não arredondada'],
      ['ø', 'Vogal semifechada anterior arredondada'],
      ['œ', 'Vogal semiaberta anterior arredondada'],
      ['ʃ', 'Fricativa pós-alveolar surda'],
      ['ʒ', 'Fricativa pós-alveolar sonora'],
      ['θ', 'Fricativa dental surda'],
      ['ð', 'Fricativa dental sonora'],
      ['ŋ', 'Nasal velar'],
      ['ɲ', 'Nasal palatal'],
      ['ɳ', 'Nasal retroflexa'],
      ['ɱ', 'Nasal labiodental'],
      ['ʎ', 'Aproximante lateral palatal'],
      ['ɾ', 'Tepe alveolar'],
      ['ɹ', 'Aproximante alveolar'],
      ['ɻ', 'Aproximante retroflexa'],
      ['ʀ', 'Vibrante uvular'],
      ['ʁ', 'Fricativa uvular sonora'],
      ['χ', 'Fricativa uvular surda'],
      ['ɣ', 'Fricativa velar sonora'],
      ['β', 'Fricativa bilabial sonora'],
      ['ɸ', 'Fricativa bilabial surda'],
      ['ʋ', 'Aproximante labiodental'],
      ['ç', 'Fricativa palatal surda'],
      ['ʝ', 'Fricativa palatal sonora'],
      ['ħ', 'Fricativa faríngea surda'],
      ['ʕ', 'Fricativa faríngea sonora'],
      ['ʔ', 'Oclusiva glotal'],
      ['ɦ', 'Fricativa glotal sonora'],
      ['ʈ', 'Oclusiva retroflexa surda'],
      ['ɖ', 'Oclusiva retroflexa sonora'],
      ['ɟ', 'Oclusiva palatal sonora'],
      ['ɡ', 'Oclusiva velar sonora (IPA)'],
      ['ˈ', 'Acento tônico primário'],
      ['ˌ', 'Acento tônico secundário'],
      ['ː', 'Alongamento (som longo)'],
      ['ˑ', 'Semilongo'],
      ['ʰ', 'Aspiração'],
      ['ʷ', 'Labialização'],
      ['ʲ', 'Palatalização'],
      ['̃', 'Nasalização (diacrítico combinado)'],
      ['̚', 'Soltura inaudível'],
    ]),
  },
  {
    id: 'greek',
    label: 'Grego (Greek)',
    shortLabel: 'Grego',
    description: 'Letras maiúsculas e minúsculas do alfabeto grego clássico e notação científica.',
    characters: makeItems([
      ['Α', 'Alfa maiúsculo (Alpha)'],
      ['Β', 'Beta maiúsculo (Beta)'],
      ['Γ', 'Gama maiúsculo (Gamma)'],
      ['Δ', 'Delta maiúsculo (Delta)'],
      ['Ε', 'Épsilon maiúsculo (Epsilon)'],
      ['Ζ', 'Zeta maiúsculo (Zeta)'],
      ['Η', 'Eta maiúsculo (Eta)'],
      ['Θ', 'Teta maiúsculo (Theta)'],
      ['Ι', 'Iota maiúsculo (Iota)'],
      ['Κ', 'Kapa maiúsculo (Kappa)'],
      ['Λ', 'Lambda maiúsculo (Lambda)'],
      ['Μ', 'Mi maiúsculo (Mu)'],
      ['Ν', 'Ni maiúsculo (Nu)'],
      ['Ξ', 'Csi maiúsculo (Xi)'],
      ['Ο', 'Ômicron maiúsculo (Omicron)'],
      ['Π', 'Pi maiúsculo (Pi)'],
      ['Ρ', 'Rô maiúsculo (Rho)'],
      ['Σ', 'Sigma maiúsculo (Sigma)'],
      ['Τ', 'Tau maiúsculo (Tau)'],
      ['Υ', 'Ípsilon maiúsculo (Upsilon)'],
      ['Φ', 'Fi maiúsculo (Phi)'],
      ['Χ', 'Qui maiúsculo (Chi)'],
      ['Ψ', 'Psi maiúsculo (Psi)'],
      ['Ω', 'Ômega maiúsculo (Omega)'],
      ['α', 'Alfa minúsculo (alpha)'],
      ['β', 'Beta minúsculo (beta)'],
      ['γ', 'Gama minúsculo (gamma)'],
      ['δ', 'Delta minúsculo (delta)'],
      ['ε', 'Épsilon minúsculo (epsilon)'],
      ['ζ', 'Zeta minúsculo (zeta)'],
      ['η', 'Eta minúsculo (eta)'],
      ['θ', 'Teta minúsculo (theta)'],
      ['ι', 'Iota minúsculo (iota)'],
      ['κ', 'Kapa minúsculo (kappa)'],
      ['λ', 'Lambda minúsculo (lambda)'],
      ['μ', 'Mi minúsculo (mu)'],
      ['ν', 'Ni minúsculo (nu)'],
      ['ξ', 'Csi minúsculo (xi)'],
      ['ο', 'Ômicron minúsculo (omicron)'],
      ['π', 'Pi minúsculo (pi)'],
      ['ρ', 'Rô minúsculo (rho)'],
      ['σ', 'Sigma minúsculo (sigma)'],
      ['ς', 'Sigma final (final sigma)'],
      ['τ', 'Tau minúsculo (tau)'],
      ['υ', 'Ípsilon minúsculo (upsilon)'],
      ['φ', 'Fi minúsculo (phi)'],
      ['χ', 'Qui minúsculo (chi)'],
      ['ψ', 'Psi minúsculo (psi)'],
      ['ω', 'Ômega minúsculo (omega)'],
    ]),
  },
  {
    id: 'cyrillic',
    label: 'Cirílico (Cyrillic)',
    shortLabel: 'Cirílico',
    description: 'Alfabeto cirílico padrão e caracteres estendidos eslavos.',
    characters: makeItems([
      ['А', 'A cirílico maiúsculo'],
      ['Б', 'Be maiúsculo'],
      ['В', 'Ve maiúsculo'],
      ['Г', 'Ghe maiúsculo'],
      ['Ґ', 'Ghe com haste maiúsculo (Ucraniano)'],
      ['Д', 'De maiúsculo'],
      ['Е', 'Ie maiúsculo'],
      ['Ё', 'Io maiúsculo'],
      ['Є', 'Ie ucraniano maiúsculo'],
      ['Ж', 'Zhe maiúsculo'],
      ['З', 'Ze maiúsculo'],
      ['И', 'I cirílico maiúsculo'],
      ['І', 'I pontuado maiúsculo'],
      ['Ї', 'Yi ucraniano maiúsculo'],
      ['Й', 'I curto maiúsculo'],
      ['К', 'Ka maiúsculo'],
      ['Л', 'El maiúsculo'],
      ['М', 'Em maiúsculo'],
      ['Н', 'En maiúsculo'],
      ['О', 'O cirílico maiúsculo'],
      ['П', 'Pe maiúsculo'],
      ['Р', 'Er maiúsculo'],
      ['С', 'Es maiúsculo'],
      ['Т', 'Te maiúsculo'],
      ['У', 'U cirílico maiúsculo'],
      ['Ф', 'Ef maiúsculo'],
      ['Х', 'Kha maiúsculo'],
      ['Ц', 'Tse maiúsculo'],
      ['Ч', 'Che maiúsculo'],
      ['Ш', 'Sha maiúsculo'],
      ['Щ', 'Shcha maiúsculo'],
      ['Ъ', 'Sinal duro maiúsculo'],
      ['Ы', 'Yeru maiúsculo'],
      ['Ь', 'Sinal brando maiúsculo'],
      ['Э', 'E cirílico maiúsculo'],
      ['Ю', 'Yu maiúsculo'],
      ['Я', 'Ya maiúsculo'],
      ['а', 'A cirílico minúsculo'],
      ['б', 'Be minúsculo'],
      ['в', 'Ve minúsculo'],
      ['г', 'Ghe minúsculo'],
      ['ґ', 'Ghe com haste minúsculo (Ucraniano)'],
      ['д', 'De minúsculo'],
      ['е', 'Ie minúsculo'],
      ['ё', 'Io minúsculo'],
      ['є', 'Ie ucraniano minúsculo'],
      ['ж', 'Zhe minúsculo'],
      ['з', 'Ze minúsculo'],
      ['и', 'I cirílico minúsculo'],
      ['і', 'I pontuado minúsculo'],
      ['ї', 'Yi ucraniano minúsculo'],
      ['й', 'I curto minúsculo'],
      ['к', 'Ka minúsculo'],
      ['л', 'El minúsculo'],
      ['м', 'Em minúsculo'],
      ['н', 'En minúsculo'],
      ['о', 'O cirílico minúsculo'],
      ['п', 'Pe minúsculo'],
      ['р', 'Er minúsculo'],
      ['с', 'Es minúsculo'],
      ['т', 'Te minúsculo'],
      ['у', 'U cirílico minúsculo'],
      ['ф', 'Ef minúsculo'],
      ['х', 'Kha minúsculo'],
      ['ц', 'Tse minúsculo'],
      ['ч', 'Che minúsculo'],
      ['ш', 'Sha minúsculo'],
      ['щ', 'Shcha minúsculo'],
      ['ъ', 'Sinal duro minúsculo'],
      ['ы', 'Yeru minúsculo'],
      ['ь', 'Sinal brando minúsculo'],
      ['э', 'E cirílico minúsculo'],
      ['ю', 'Yu minúsculo'],
      ['я', 'Ya minúsculo'],
    ]),
  },
  {
    id: 'arabic',
    label: 'Árabe',
    shortLabel: 'Árabe',
    description: 'Alfabeto árabe básico, pontuação e dígitos orientais.',
    rtl: true,
    characters: makeCodepointList(
      ['ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي', 'ة', 'ى', 'ء', 'أ', 'إ', 'آ', 'ؤ', 'ئ', '،', '؛', '؟'],
      'Árabe'
    ),
  },
  {
    id: 'arabic-extended',
    label: 'Árabe estendido',
    shortLabel: 'Árabe est.',
    description: 'Consoantes e sinais estendidos para persa, urdu, pashto e línguas relacionadas.',
    rtl: true,
    characters: makeCodepointList(
      ['پ', 'چ', 'ژ', 'گ', 'ک', 'ی', 'ٹ', 'ڈ', 'ڑ', 'ں', 'ھ', 'ہ', 'ے', 'ڤ', 'ڭ', 'ڨ', 'ݣ', 'ڵ', 'ۆ', 'ۇ', 'ۈ', 'ې', 'ە', 'ٰ', 'ٱ'],
      'Árabe estendido'
    ),
  },
  {
    id: 'hebrew',
    label: 'Hebraico',
    shortLabel: 'Hebraico',
    description: 'Alef-bet hebraico padrão e formas finais (sofit).',
    rtl: true,
    characters: makeCodepointList(
      ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'כ', 'ך', 'ל', 'מ', 'ם', 'נ', 'ן', 'ס', 'ע', 'פ', 'ף', 'צ', 'ץ', 'ק', 'ר', 'ש', 'ת', '׳', '״'],
      'Hebraico'
    ),
  },
  {
    id: 'armenian',
    label: 'Armênio',
    shortLabel: 'Armênio',
    description: 'Escrita armênia maiúscula e minúscula.',
    characters: makeCodepointList(
      ['Ա', 'Բ', 'Գ', 'Դ', 'Ե', 'Զ', 'Է', 'Ը', 'Թ', 'Ժ', 'Ի', 'Լ', 'Խ', 'Ծ', 'Կ', 'Հ', 'Ձ', 'Ղ', 'Ճ', 'Մ', 'Յ', 'Ն', 'Շ', 'Ո', 'Չ', 'Պ', 'Ջ', 'Ռ', 'Ս', 'Վ', 'Տ', 'Ր', 'Ց', 'Ւ', 'Փ', 'Ք', 'Օ', 'Ֆ', 'ա', 'բ', 'գ', 'դ', 'ե', 'զ', 'է', 'ը', 'թ', 'ժ', 'ի', 'լ', 'մ', 'ն', 'ո', 'պ', 'ս', 'վ', 'տ', 'ր', 'ք', 'և'],
      'Armênio'
    ),
  },
  {
    id: 'georgian',
    label: 'Georgiano',
    shortLabel: 'Georgiano',
    description: 'Alfabeto georgiano Mkhedruli.',
    characters: makeCodepointList(
      ['ა', 'ბ', 'გ', 'დ', 'ე', 'ვ', 'ზ', 'თ', 'ი', 'კ', 'ლ', 'მ', 'ნ', 'ო', 'პ', 'ჟ', 'რ', 'ს', 'ტ', 'უ', 'ფ', 'ქ', 'ღ', 'ყ', 'შ', 'ჩ', 'ც', 'ძ', 'წ', 'ჭ', 'ხ', 'ჯ', 'ჰ'],
      'Georgiano'
    ),
  },
  {
    id: 'devanagari',
    label: 'Devanágari',
    shortLabel: 'Devanágari',
    description: 'Escrita abugida usada para sânscrito, hindi, marathi e nepalês.',
    characters: makeCodepointList(
      ['अ', 'आ', 'इ', 'ई', 'उ', 'ऊ', 'ऋ', 'ए', 'ऐ', 'ओ', 'औ', 'क', 'ख', 'ग', 'घ', 'ङ', 'च', 'छ', 'ज', 'झ', 'ञ', 'ट', 'ठ', 'ड', 'ढ', 'ण', 'त', 'थ', 'द', 'ध', 'न', 'प', 'फ', 'ब', 'भ', 'म', 'य', 'र', 'ल', 'व', 'श', 'ष', 'स', 'ह', 'ॐ', '।'],
      'Devanágari'
    ),
  },
  {
    id: 'bengali',
    label: 'Bengali',
    shortLabel: 'Bengali',
    description: 'Escrita bengali-assamesa.',
    characters: makeCodepointList(
      ['অ', 'আ', 'ই', 'ঈ', 'উ', 'ঊ', 'ঋ', 'এ', 'ঐ', 'ও', 'ঔ', 'ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ', 'ঝ', 'ঞ', 'ট', 'ঠ', 'ড', 'ঢ', 'ণ', 'ত', 'থ', 'দ', 'ধ', 'ন', 'প', 'ফ', 'ব', 'ভ', 'ম', 'য', 'র', 'ল', 'শ', 'ষ', 'স', 'হ', 'ৎ'],
      'Bengali'
    ),
  },
  {
    id: 'gurmukhi',
    label: 'Gurmukhi',
    shortLabel: 'Gurmukhi',
    description: 'Escrita utilizada principalmente na língua punjabi.',
    characters: makeCodepointList(
      ['ਅ', 'ਆ', 'ਇ', 'ਈ', 'ਉ', 'ਊ', 'ਏ', 'ਐ', 'ਓ', 'ਔ', 'ਕ', 'ਖ', 'ਗ', 'ਘ', 'ਙ', 'ਚ', 'ਛ', 'ਜ', 'ਝ', 'ਞ', 'ਟ', 'ਠ', 'ਡ', 'ਢ', 'ਣ', 'ਤ', 'ਥ', 'ਦ', 'ਧ', 'ਨ', 'ਪ', 'ਫ', 'ਬ', 'ਭ', 'ਮ', 'ਯ', 'ਰ', 'ਲ', 'ਵ', 'ੜ', 'ਸ', 'ਹ', 'ੴ'],
      'Gurmukhi'
    ),
  },
  {
    id: 'gujarati',
    label: 'Gujarati',
    shortLabel: 'Gujarati',
    description: 'Escrita da língua guzerate.',
    characters: makeCodepointList(
      ['અ', 'આ', 'ઇ', 'ઈ', 'ઉ', 'ઊ', 'ઋ', 'એ', 'ઐ', 'ઓ', 'ઔ', 'ક', 'ખ', 'ગ', 'ઘ', 'ઙ', 'ચ', 'છ', 'જ', 'ઝ', 'ઞ', 'ટ', 'ઠ', 'ડ', 'ઢ', 'ણ', 'ત', 'થ', 'દ', 'ધ', 'ન', 'પ', 'ફ', 'બ', 'ભ', 'મ', 'ય', 'ર', 'લ', 'વ', 'શ', 'ષ', 'સ', 'હ', 'ળ'],
      'Gujarati'
    ),
  },
  {
    id: 'oriya',
    label: 'Oriya',
    shortLabel: 'Oriya',
    description: 'Escrita odia (oriya) da Índia oriental.',
    characters: makeCodepointList(
      ['ଅ', 'ଆ', 'ଇ', 'ଈ', 'ଉ', 'ଊ', 'ଋ', 'ଏ', 'ଐ', 'ଓ', 'ଔ', 'କ', 'ଖ', 'ଗ', 'ଘ', 'ଙ', 'ଚ', 'ଛ', 'ଜ', 'ଝ', 'ଞ', 'ଟ', 'ଠ', 'ଡ', 'ଢ', 'ଣ', 'ତ', 'ଥ', 'ଦ', 'ଧ', 'ନ', 'ପ', 'ଫ', 'ବ', 'ଭ', 'ମ', 'ଯ', 'ର', 'ଲ', 'ଳ', 'ଶ', 'ଷ', 'ସ', 'ହ'],
      'Oriya'
    ),
  },
  {
    id: 'tamil',
    label: 'Tâmil',
    shortLabel: 'Tâmil',
    description: 'Escrita tâmil clássica e moderna.',
    characters: makeCodepointList(
      ['அ', 'ஆ', 'இ', 'ஈ', 'உ', 'ஊ', 'எ', 'ஏ', 'ஐ', 'ஒ', 'ஓ', 'ஔ', 'ஃ', 'க', 'ங', 'ச', 'ஞ', 'ட', 'ண', 'த', 'ந', 'ப', 'ம', 'ய', 'ர', 'ல', 'வ', 'ழ', 'ள', 'ற', 'ன', 'ஜ', 'ஷ', 'ஸ', 'ஹ'],
      'Tâmil'
    ),
  },
  {
    id: 'telugu',
    label: 'Télugo',
    shortLabel: 'Télugo',
    description: 'Escrita brâmica usada na língua télugo.',
    characters: makeCodepointList(
      ['అ', 'ఆ', 'ఇ', 'ఈ', 'ఉ', 'ఊ', 'ఋ', 'ఎ', 'ఏ', 'ఐ', 'ఒ', 'ఓ', 'ఔ', 'క', 'ఖ', 'గ', 'ఘ', 'చ', 'ఛ', 'జ', 'ఝ', 'ట', 'ఠ', 'డ', 'ఢ', 'ణ', 'త', 'థ', 'ద', 'ధ', 'న', 'ప', 'ఫ', 'బ', 'భ', 'మ', 'య', 'ర', 'ల', 'వ', 'శ', 'ష', 'స', 'హ', 'ళ'],
      'Télugo'
    ),
  },
  {
    id: 'kannada',
    label: 'Canarês',
    shortLabel: 'Canarês',
    description: 'Escrita canaresa (Kannada).',
    characters: makeCodepointList(
      ['ಅ', 'ಆ', 'ಇ', 'ಈ', 'ಉ', 'ಊ', 'ಋ', 'ಎ', 'ಏ', 'ಐ', 'ಒ', 'ಓ', 'ಔ', 'ಕ', 'ಖ', 'ಗ', 'ಘ', 'ಚ', 'ಛ', 'ಜ', 'ಝ', 'ಟ', 'ಠ', 'ಡ', 'ಢ', 'ಣ', 'ತ', 'ಥ', 'ದ', 'ಧ', 'ನ', 'ಪ', 'ಫ', 'ಬ', 'ಭ', 'ಮ', 'ಯ', 'ರ', 'ಲ', 'ವ', 'ಶ', 'ಷ', 'ಸ', 'ಹ', 'ಳ'],
      'Canarês'
    ),
  },
  {
    id: 'malayalam',
    label: 'Malaiala',
    shortLabel: 'Malaiala',
    description: 'Escrita malaiala de Querala.',
    characters: makeCodepointList(
      ['അ', 'ആ', 'ഇ', 'ഈ', 'ഉ', 'ഊ', 'ഋ', 'എ', 'ഏ', 'ഐ', 'ഒ', 'ഓ', 'ഔ', 'ക', 'ഖ', 'ഗ', 'ഘ', 'ങ', 'ച', 'ഛ', 'ജ', 'ഝ', 'ഞ', 'ട', 'ഠ', 'ഡ', 'ഢ', 'ണ', 'ത', 'ഥ', 'ദ', 'ധ', 'ന', 'പ', 'ഫ', 'ബ', 'ഭ', 'മ', 'യ', 'ര', 'ല', 'വ', 'ശ', 'ഷ', 'സ', 'ഹ', 'ള', 'ഴ', 'റ'],
      'Malaiala'
    ),
  },
  {
    id: 'sinhala',
    label: 'Cingalês',
    shortLabel: 'Cingalês',
    description: 'Escrita cingalesa (Sinhala).',
    characters: makeCodepointList(
      ['අ', 'ආ', 'ඇ', 'ඈ', 'ඉ', 'ඊ', 'උ', 'ඌ', 'එ', 'ඒ', 'ඔ', 'ඕ', 'ක', 'ඛ', 'ග', 'ඝ', 'ච', 'ජ', 'ට', 'ඩ', 'ණ', 'ත', 'ද', 'න', 'ප', 'බ', 'ම', 'ය', 'ර', 'ල', 'ව', 'ශ', 'ෂ', 'ස', 'හ', 'ළ'],
      'Cingalês'
    ),
  },
  {
    id: 'thai',
    label: 'Tailandês',
    shortLabel: 'Tailandês',
    description: 'Consoantes, vogais e marcas tonais do alfabeto tailandês.',
    characters: makeCodepointList(
      ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ', 'ช', 'ซ', 'ญ', 'ฎ', 'ฏ', 'ฐ', 'ด', 'ต', 'ถ', 'ท', 'น', 'บ', 'ป', 'ผ', 'ฝ', 'พ', 'ฟ', 'ภ', 'ม', 'ย', 'ร', 'ล', 'ว', 'ศ', 'ษ', 'ส', 'ห', 'อ', 'ฮ', 'ะ', 'า', 'ิ', 'ี', 'เ', 'แ', 'โ', 'ไ', '฿'],
      'Tailandês'
    ),
  },
  {
    id: 'lao',
    label: 'Lao',
    shortLabel: 'Lao',
    description: 'Alfabeto laociano.',
    characters: makeCodepointList(
      ['ກ', 'ຂ', 'ຄ', 'ງ', 'ຈ', 'ສ', 'ຊ', 'ຍ', 'ດ', 'ຕ', 'ຖ', 'ທ', 'ນ', 'ບ', 'ປ', 'ຜ', 'ຝ', 'ພ', 'ຟ', 'ມ', 'ຢ', 'ຣ', 'ລ', 'ວ', 'ຫ', 'ອ', 'ຮ', 'ະ', 'າ', 'ິ', 'ີ', 'ເ', 'ແ', 'ໂ', '₭'],
      'Lao'
    ),
  },
  {
    id: 'tibetan',
    label: 'Tibetano',
    shortLabel: 'Tibetano',
    description: 'Escrita tibetana Uchen e sinais de pontuação.',
    characters: makeCodepointList(
      ['ཀ', 'ཁ', 'ག', 'ང', 'ཅ', 'ཆ', 'ཇ', 'ཉ', 'ཏ', 'ཐ', 'ད', 'ན', 'པ', 'ཕ', 'བ', 'མ', 'ཙ', 'ཚ', 'ཛ', 'ཝ', 'ཞ', 'ཟ', 'འ', 'ཡ', 'ར', 'ལ', 'ཤ', 'ས', 'ཧ', 'ཨ', 'ༀ', '༄', '༅', '།'],
      'Tibetano'
    ),
  },
  {
    id: 'myanmar',
    label: 'Birmanês',
    shortLabel: 'Birmanês',
    description: 'Escrita birmanesa (Myanmar).',
    characters: makeCodepointList(
      ['က', 'ခ', 'ဂ', 'ဃ', 'င', 'စ', 'ဆ', 'ဇ', 'ဈ', 'ည', 'ဋ', 'ဌ', 'ဍ', 'ဎ', 'ဏ', 'တ', 'ထ', 'ဒ', 'ဓ', 'န', 'ပ', 'ဖ', 'ဗ', 'ဘ', 'မ', 'ယ', 'ရ', 'လ', 'ဝ', 'သ', 'ဟ', 'ဠ', 'အ', '။'],
      'Birmanês'
    ),
  },
  {
    id: 'khmer',
    label: 'Khmer',
    shortLabel: 'Khmer',
    description: 'Escrita cambojana (Khmer).',
    characters: makeCodepointList(
      ['ក', 'ខ', 'គ', 'ឃ', 'ង', 'ច', 'ឆ', 'ជ', 'ឈ', 'ញ', 'ដ', 'ឋ', 'ឌ', 'ឍ', 'ណ', 'ត', 'ថ', 'ទ', 'ធ', 'ន', 'ប', 'ផ', 'ព', 'ភ', 'ម', 'យ', 'រ', 'ល', 'វ', 'ស', 'ហ', 'ឡ', 'អ', '។', '៛'],
      'Khmer'
    ),
  },
  {
    id: 'ethiopic',
    label: 'Etíope',
    shortLabel: 'Etíope',
    description: 'Silabário Geʽez / Amárico.',
    characters: makeCodepointList(
      ['ሀ', 'ለ', 'ሐ', 'መ', 'ሠ', 'ረ', 'ሰ', 'ሸ', 'ቀ', 'በ', 'ተ', 'ቸ', 'ኀ', 'ነ', 'ኘ', 'አ', 'ከ', 'ኸ', 'ወ', 'ዐ', 'ዘ', 'ዠ', 'የ', 'ደ', 'ጀ', 'ገ', 'ጠ', 'ጨ', 'ጰ', 'ጸ', 'ፀ', 'ፈ', 'ፐ', '።'],
      'Etíope'
    ),
  },
  {
    id: 'canadian-aboriginal',
    label: 'Silabário indígena canadense',
    shortLabel: 'Sil. Canadense',
    description: 'Silabário unificado para Cree, Inuktitut e Ojibwe.',
    characters: makeCodepointList(
      ['ᐃ', 'ᐄ', 'ᐅ', 'ᐆ', 'ᐊ', 'ᐋ', 'ᐁ', 'ᐯ', 'ᐱ', 'ᐲ', 'ᐳ', 'ᐴ', 'ᐸ', 'ᐹ', 'ᑊ', 'ᑌ', 'ᑎ', 'ᑏ', 'ᑐ', 'ᑑ', 'ᑕ', 'ᑖ', 'ᑦ', 'ᑫ', 'ᑭ', 'ᑮ', 'ᑯ', 'ᑰ', 'ᑲ', 'ᑳ', 'ᒃ', 'ᒣ', 'ᒥ', 'ᒦ', 'ᒧ', 'ᒨ', 'ᒪ', 'ᒫ', 'ᒻ', 'ᓀ', 'ᓂ', 'ᓃ', 'ᓄ', 'ᓅ', 'ᓇ', 'ᓈ', 'ᓐ'],
      'Silabário indígena canadense'
    ),
  },
  {
    id: 'cherokee',
    label: 'Cherokee',
    shortLabel: 'Cherokee',
    description: 'Silabário Cherokee (Tsalagi).',
    characters: makeCodepointList(
      ['Ꭰ', 'Ꭱ', 'Ꭲ', 'Ꭳ', 'Ꭴ', 'Ꭵ', 'Ꭶ', 'Ꭷ', 'Ꭸ', 'Ꭹ', 'Ꭺ', 'Ꭻ', 'Ꭼ', 'Ꭽ', 'Ꭾ', 'Ꭿ', 'Ꮀ', 'Ꮁ', 'Ꮂ', 'Ꮃ', 'Ꮄ', 'Ꮅ', 'Ꮆ', 'Ꮇ', 'Ꮈ', 'Ꮉ', 'Ꮊ', 'Ꮋ', 'Ꮌ', 'Ꮍ', 'Ꮎ', 'Ꮏ', 'Ꮐ', 'Ꮑ', 'Ꮒ', 'Ꮓ', 'Ꮔ', 'Ꮕ', 'Ꮖ', 'Ꮗ', 'Ꮘ', 'Ꮙ', 'Ꮚ', 'Ꮛ', 'Ꮜ', 'Ꮝ', 'Ꮞ', 'Ꮟ', 'Ꮠ', 'Ꮡ', 'Ꮢ', 'Ꮤ', 'Ꮥ', 'Ꮦ', 'Ꮧ', 'Ꮨ', 'Ꮩ', 'Ꮪ', 'Ꮫ'],
      'Cherokee'
    ),
  },
  {
    id: 'tifinagh',
    label: 'Tifinagh',
    shortLabel: 'Tifinagh',
    description: 'Neo-Tifinagh usado nas línguas berberes (amazigue).',
    rtl: true,
    characters: makeCodepointList(
      ['ⴰ', 'ⴱ', 'ⴳ', 'ⴷ', 'ⴹ', 'ⴻ', 'ⴼ', 'ⴽ', 'ⵀ', 'ⵃ', 'ⵄ', 'ⵅ', 'ⵇ', 'ⵉ', 'ⵊ', 'ⵍ', 'ⵎ', 'ⵏ', 'ⵓ', 'ⵔ', 'ⵕ', 'ⵖ', 'ⵙ', 'ⵚ', 'ⵛ', 'ⵜ', 'ⵟ', 'ⵡ', 'ⵢ', 'ⵣ', 'ⵥ', 'ⵯ'],
      'Tifinagh'
    ),
  },
];
