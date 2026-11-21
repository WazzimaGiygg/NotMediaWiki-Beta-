import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Palette } from 'lucide-react';
import { useExtensions } from '../context/ExtensionsContext';

export const WikidiotaParodyBanner: React.FC = () => {
  const { activeTheme, openThemeSelector } = useExtensions();
  const [isExpanded, setIsExpanded] = useState(true);

  if (activeTheme.id !== 'wikidiota' || !activeTheme.parodyMetadata) {
    return null;
  }

  const { foundationName, parodyTitle, parodyTagline, entries } = activeTheme.parodyMetadata;

  return (
    <section
      data-testid="wikidiota-parody-banner"
      aria-label="Crônica satírica do tema Wikidiota"
      className="bg-[#fdfbf7] border-b border-[#d6cfc2] text-[#1f1c18] no-print print:hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 space-y-3">
        {/* Institutional Parody Masthead Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#7f1d1d] font-mono">
              <span className="font-bold uppercase tracking-wider">{foundationName}</span>
              <span aria-hidden="true">·</span>
              <span>Edição Paródia</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-[#1f1c18]">{parodyTitle}</span>
            </div>
            <p className="text-sm font-serif font-semibold text-[#1f1c18] leading-snug">
              {parodyTitle} — {parodyTagline}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsExpanded(prev => !prev)}
              className="px-3 py-1.5 rounded border border-[#d6cfc2] bg-[#f4f1ea] hover:bg-[#ebe5d8] text-[#1f1c18] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Recolher crônica</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>Exibir crônica</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={openThemeSelector}
              className="px-3 py-1.5 rounded bg-[#b91c1c] hover:bg-[#991b1b] text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Trocar tema</span>
            </button>
          </div>
        </div>

        {/* Satirical Chronicle Ledger Grid */}
        {isExpanded && (
          <div className="pt-2 border-t border-[#e2dbce] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {entries.map((entry, idx) => (
              <div
                key={entry.title}
                className="p-2.5 rounded border border-[#d6cfc2] bg-[#f4f1ea]/80 space-y-1"
              >
                <div className="text-[11px] font-mono text-[#7f1d1d]">
                  0{idx + 1}. Registro Satírico
                </div>
                <div className="text-xs font-serif font-bold text-[#1f1c18]">
                  {entry.title}
                </div>
                <p className="text-[11px] text-[#44403c] leading-relaxed">
                  {entry.subtitle}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
