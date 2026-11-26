import React, { useMemo, useState } from 'react';
import { Languages, Search, X } from 'lucide-react';

export type SpecialCharacterGroupId = 'greek' | 'cyrillic' | 'ipa';

export interface SpecialCharacterItem {
  char: string;
  name: string;
  codepoint: string;
}

export interface SpecialCharacterGroup {
  id: SpecialCharacterGroupId;
  label: string;
  shortLabel: string;
  description: string;
  characters: SpecialCharacterItem[];
}

const toCodepoint = (char: string): string => {
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

export const SPECIAL_CHARACTER_GROUPS: SpecialCharacterGroup[] = [
  {
    id: 'greek',
    label: 'Grego (Greek)',
    shortLabel: 'Greek',
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
    shortLabel: 'Cyrillic',
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
];

export interface SpecialCharactersMenuProps {
  onSelectCharacter: (char: string) => void;
  onClose?: () => void;
  initialGroup?: 'all' | SpecialCharacterGroupId;
}

export const SpecialCharactersMenu: React.FC<SpecialCharactersMenuProps> = ({
  onSelectCharacter,
  onClose,
  initialGroup = 'all',
}) => {
  const [activeGroup, setActiveGroup] = useState<'all' | SpecialCharacterGroupId>(initialGroup);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredItem, setHoveredItem] = useState<SpecialCharacterItem | null>(null);

  const visibleGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return SPECIAL_CHARACTER_GROUPS.filter(
      group => activeGroup === 'all' || group.id === activeGroup
    )
      .map(group => {
        if (!q) return group;
        return {
          ...group,
          characters: group.characters.filter(
            item =>
              item.char.toLowerCase().includes(q) ||
              item.name.toLowerCase().includes(q) ||
              item.codepoint.toLowerCase().includes(q)
          ),
        };
      })
      .filter(group => group.characters.length > 0);
  }, [activeGroup, searchQuery]);

  const totalVisibleCharacters = useMemo(
    () => visibleGroups.reduce((sum, group) => sum + group.characters.length, 0),
    [visibleGroups]
  );

  return (
    <section
      data-testid="special-characters-menu"
      aria-label="Menu de Caracteres Especiais"
      className="border-x border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
    >
      {/* Header & Group Selector */}
      <div className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/60 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Languages className="w-4 h-4 text-slate-700 dark:text-slate-300 shrink-0" />
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
              Caracteres Especiais
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
              Clique em um símbolo para inseri-lo diretamente na posição do cursor.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Group Filter Tabs */}
          <div
            role="tablist"
            aria-label="Grupos de caracteres especiais"
            className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-md border border-slate-200 dark:border-slate-700"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeGroup === 'all'}
              data-testid="special-chars-tab-all"
              onMouseDown={e => e.preventDefault()}
              onClick={() => setActiveGroup('all')}
              className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer transition-colors ${
                activeGroup === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Todos
            </button>
            {SPECIAL_CHARACTER_GROUPS.map(group => {
              const isSelected = activeGroup === group.id;
              return (
                <button
                  key={group.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  data-testid={`special-chars-tab-${group.id}`}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => setActiveGroup(group.id)}
                  className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {group.label}
                </button>
              );
            })}
          </div>

          {/* Search Filter */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              data-testid="special-chars-search"
              placeholder="Filtrar símbolo ou nome..."
              aria-label="Filtrar caracteres especiais"
              className="pl-7 pr-2.5 py-1 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-[11px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
          </div>

          {onClose && (
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={onClose}
              aria-label="Fechar menu de caracteres especiais"
              data-testid="close-special-chars-btn"
              className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Grouped Character Grids */}
      <div className="p-3 max-h-72 overflow-y-auto space-y-4">
        {visibleGroups.length === 0 ? (
          <div className="py-6 text-center text-slate-500 dark:text-slate-400 text-xs">
            Nenhum caractere encontrado para &ldquo;{searchQuery}&rdquo;.
          </div>
        ) : (
          visibleGroups.map(group => (
            <div
              key={group.id}
              data-testid={`special-chars-group-${group.id}`}
              className="space-y-1.5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-1">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  {group.label}
                </h4>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  {group.description}
                </span>
              </div>

              <div
                role="grid"
                aria-label={`Grade de caracteres ${group.label}`}
                className="grid grid-cols-8 sm:grid-cols-12 md:grid-cols-16 gap-1"
              >
                {group.characters.map(item => (
                  <button
                    key={`${group.id}-${item.codepoint}-${item.char}`}
                    type="button"
                    data-group={group.id}
                    data-char={item.char}
                    title={`${item.name} (${item.codepoint})`}
                    aria-label={`Inserir ${item.name} (${item.char})`}
                    onMouseDown={e => e.preventDefault()}
                    onMouseEnter={() => setHoveredItem(item)}
                    onFocus={() => setHoveredItem(item)}
                    onClick={() => onSelectCharacter(item.char)}
                    className="h-8 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:border-blue-400 dark:hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm font-serif text-slate-900 dark:text-slate-100 cursor-pointer transition-colors select-none"
                  >
                    {item.char}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Inspection Footer */}
      <div className="px-3 py-1.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2 min-w-0">
          {hoveredItem ? (
            <>
              <span className="inline-flex items-center justify-center w-6 h-5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-serif text-sm text-slate-900 dark:text-slate-100 shrink-0">
                {hoveredItem.char}
              </span>
              <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                {hoveredItem.name}
              </span>
              <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
                {hoveredItem.codepoint}
              </span>
            </>
          ) : (
            <span>Passe o cursor ou navegue com Tab sobre um caractere para ver o nome e código Unicode.</span>
          )}
        </div>
        <span className="font-mono text-[10px] shrink-0">
          {totalVisibleCharacters} caracteres
        </span>
      </div>
    </section>
  );
};

export default SpecialCharactersMenu;
