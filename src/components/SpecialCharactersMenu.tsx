import React, { useMemo, useState } from 'react';
import { Clock, Languages, Search, X } from 'lucide-react';
import {
  SPECIAL_CHARACTER_GROUPS,
  SpecialCharacterGroup,
  SpecialCharacterGroupId,
  SpecialCharacterItem,
  loadRecentSpecialChars,
  recordRecentSpecialChar,
} from '../data/specialCharactersCatalog';

export { SPECIAL_CHARACTER_GROUPS };
export type { SpecialCharacterGroup, SpecialCharacterGroupId, SpecialCharacterItem };

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
  const [recentItems, setRecentItems] = useState<SpecialCharacterItem[]>(() => loadRecentSpecialChars());

  const allGroups = useMemo(() => {
    const recentGroup = {
      id: 'recent' as const,
      label: 'Usados recentemente',
      shortLabel: 'Recentes',
      description: 'Caracteres inseridos recentemente nesta estação.',
      rtl: false,
      characters: recentItems,
    };
    return [recentGroup, ...SPECIAL_CHARACTER_GROUPS];
  }, [recentItems]);

  const visibleGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allGroups
      .filter(group => {
        if (group.id === 'recent' && group.characters.length === 0 && activeGroup !== 'recent') {
          return false;
        }
        return activeGroup === 'all' || group.id === activeGroup;
      })
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
      .filter(group => group.characters.length > 0 || (activeGroup === 'recent' && group.id === 'recent'));
  }, [allGroups, activeGroup, searchQuery]);

  const totalVisibleCharacters = useMemo(
    () => visibleGroups.reduce((sum, group) => sum + group.characters.length, 0),
    [visibleGroups]
  );

  const handlePickCharacter = (item: SpecialCharacterItem) => {
    setRecentItems(prev => recordRecentSpecialChar(item.char, item.name, prev));
    onSelectCharacter(item.char);
  };

  return (
    <section
      data-testid="special-characters-menu"
      aria-label="Menu de Caracteres Especiais"
      className="border-x border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
    >
      {/* Header & Search */}
      <div className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/60 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Languages className="w-4 h-4 text-slate-700 dark:text-slate-300 shrink-0" />
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
              Caracteres Especiais
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
              Símbolos, Latino, AFI (IPA), Grego, Cirílico e sistemas de escrita mundiais — clique para inserir na posição do cursor.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Search Filter */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              data-testid="special-chars-search"
              placeholder="Filtrar símbolo, idioma ou U+..."
              aria-label="Filtrar caracteres especiais"
              className="pl-7 pr-2.5 py-1 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-[11px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
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

      {/* Category Tabs Strip (All + Usados recentemente + 29 Scripts) */}
      <div
        role="tablist"
        aria-label="Grupos de caracteres especiais"
        className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/30 flex flex-wrap items-center gap-1 max-h-28 overflow-y-auto"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeGroup === 'all'}
          data-testid="special-chars-tab-all"
          onMouseDown={e => e.preventDefault()}
          onClick={() => setActiveGroup('all')}
          className={`px-2 py-0.5 rounded border text-[11px] font-semibold cursor-pointer transition-colors ${
            activeGroup === 'all'
              ? 'bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-900'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Todos
        </button>
        {allGroups.map(group => {
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
              className={`px-2 py-0.5 rounded border text-[11px] font-medium cursor-pointer transition-colors inline-flex items-center gap-1 ${
                isSelected
                  ? 'bg-blue-600 border-blue-600 text-white font-semibold'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={group.label}
            >
              {group.id === 'recent' && <Clock className="w-3 h-3 shrink-0" />}
              <span>{group.shortLabel}</span>
            </button>
          );
        })}
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

              {group.characters.length === 0 ? (
                <div className="py-3 text-[11px] text-slate-400 dark:text-slate-500 italic">
                  Nenhum caractere inserido recentemente ainda. Selecione qualquer símbolo abaixo para adicioná-lo aqui.
                </div>
              ) : (
                <div
                  role="grid"
                  dir={group.rtl ? 'rtl' : 'ltr'}
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
                      onClick={() => handlePickCharacter(item)}
                      className="h-8 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:border-blue-400 dark:hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm font-serif text-slate-900 dark:text-slate-100 cursor-pointer transition-colors select-none"
                    >
                      {item.char}
                    </button>
                  ))}
                </div>
              )}
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
