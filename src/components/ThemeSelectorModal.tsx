import React from 'react';
import { Palette, X, Check, Lock, RotateCcw, Sparkles, Sun, Moon } from 'lucide-react';
import { useExtensions } from '../context/ExtensionsContext';

export const ThemeSelectorModal: React.FC = () => {
  const {
    themeAppearanceConfig,
    activeTheme,
    setUserTheme,
    resetToDefaultTheme,
    isThemeSelectorOpen,
    closeThemeSelector,
    siteTitleConfig,
  } = useExtensions();

  if (!isThemeSelectorOpen) return null;

  const isLockedByBureaucrat =
    themeAppearanceConfig.extensionEnabled && !themeAppearanceConfig.allowUserThemeSwitch;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="theme-selector-modal-title"
      data-testid="theme-selector-modal"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/80 dark:bg-slate-900/90">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <Palette className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="theme-selector-modal-title"
                className="text-base font-bold text-slate-900 dark:text-slate-100 truncate"
              >
                Aparência &amp; Temas do {siteTitleConfig.siteTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Ativo: <strong>{activeTheme.name}</strong> • Padrão do burocrata:{' '}
                <span className="font-mono">{themeAppearanceConfig.defaultTheme.shortLabel}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeThemeSelector}
            aria-label="Fechar seletor de temas"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Evolution Info Banner */}
          <div className="p-3 rounded-lg bg-blue-50/70 dark:bg-slate-800/70 border border-blue-200/80 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                Catálogo evolutivo de temas do Wiki-site
              </p>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Escolha uma das aparências disponíveis abaixo. Novos temas e skins são adicionados gradualmente conforme este Wiki-site é aprimorado.
              </p>
            </div>
          </div>

          {/* Bureaucrat Lock Notice */}
          {isLockedByBureaucrat && (
            <div
              data-testid="theme-switch-locked-notice"
              className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5"
            >
              <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Tema fixado pela administração (Burocrata)</p>
                <p className="text-amber-800/90 dark:text-amber-300/90 mt-0.5">
                  A troca livre de tema pelos leitores foi desativada em <code className="font-mono">$wgAllowUserThemeSwitch</code>. O Wiki-site exibe o tema padrão <strong>{themeAppearanceConfig.defaultTheme.name}</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Themes Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {themeAppearanceConfig.availableThemes.map(theme => {
              const isActive = activeTheme.id === theme.id;
              const isDefault = themeAppearanceConfig.defaultThemeId === theme.id;

              return (
                <button
                  key={theme.id}
                  type="button"
                  data-testid={`theme-card-${theme.id}`}
                  disabled={isLockedByBureaucrat}
                  onClick={() => {
                    setUserTheme(theme.id);
                  }}
                  className={`text-left p-3.5 rounded-lg border transition-all flex flex-col justify-between gap-3 ${
                    isActive
                      ? 'border-blue-600 dark:border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 ring-1 ring-blue-600/30'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  } ${isLockedByBureaucrat ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="space-y-2.5 w-full">
                    {/* Swatch Preview Bar */}
                    <div
                      className="w-full h-14 rounded-md border overflow-hidden flex flex-col justify-between p-2"
                      style={{
                        backgroundColor: theme.preview.canvas,
                        borderColor: theme.preview.border,
                        color: theme.preview.text,
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full inline-block"
                            style={{ backgroundColor: theme.preview.accent }}
                          />
                          <span className="text-[11px] font-bold tracking-tight">
                            {theme.shortLabel}
                          </span>
                        </div>
                        <span
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
                          style={{
                            backgroundColor: theme.preview.surface,
                            borderColor: theme.preview.border,
                            color: theme.preview.text,
                          }}
                        >
                          {theme.colorScheme === 'dark' ? 'Escuro' : 'Claro'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-1.5 w-12 rounded-xs"
                          style={{ backgroundColor: theme.preview.accent }}
                        />
                        <span
                          className="h-1.5 flex-1 rounded-xs opacity-35"
                          style={{ backgroundColor: theme.preview.text }}
                        />
                      </div>
                    </div>

                    {/* Title & Checkmark */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <span>{theme.name}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                          {theme.description}
                        </p>
                        {theme.parodyMetadata && (
                          <p className="text-[11px] text-rose-800 dark:text-rose-300 mt-1.5 leading-snug font-medium">
                            {theme.parodyMetadata.entries.map(e => e.title).join(' · ')}
                          </p>
                        )}
                      </div>
                      {isActive && (
                        <span
                          className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0"
                          aria-label="Tema ativo"
                        >
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Clean Footer Metadata Line (single concise text line, no pill clutter) */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 text-[10px] font-mono text-slate-500 dark:text-slate-400 w-full">
                    <span className="flex items-center gap-1 truncate">
                      {theme.colorScheme === 'dark' ? (
                        <Moon className="w-3 h-3 text-indigo-400 shrink-0" />
                      ) : (
                        <Sun className="w-3 h-3 text-amber-500 shrink-0" />
                      )}
                      <span>v{theme.addedInVersion}</span>
                      <span>•</span>
                      <span className="truncate">{theme.author}</span>
                    </span>
                    {isDefault && (
                      <span className="text-blue-600 dark:text-blue-400 font-semibold whitespace-nowrap shrink-0">
                        Padrão do Wiki
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            disabled={isLockedByBureaucrat}
            onClick={resetToDefaultTheme}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar Padrão ({themeAppearanceConfig.defaultTheme.shortLabel})</span>
          </button>

          <button
            type="button"
            onClick={closeThemeSelector}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
