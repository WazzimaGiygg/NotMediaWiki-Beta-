import React, { useState, useEffect } from 'react';
import { Smartphone, Monitor, Tv, Palette, Heart, ExternalLink } from 'lucide-react';
import { wrapExternalUrl } from '../utils/urlHelper';
import { useExtensions } from '../context/ExtensionsContext';

export type FooterDeviceMode = 'auto' | 'mobile' | 'desktop' | 'tv';

export interface WikiFooterProps {
  onNavigateHome: () => void;
  onNavigateLgpd: () => void;
  deviceMode?: FooterDeviceMode;
  onChangeDeviceMode?: (mode: FooterDeviceMode) => void;
}

export const WikiFooter: React.FC<WikiFooterProps> = ({
  onNavigateHome,
  onNavigateLgpd,
  deviceMode: controlledDeviceMode,
  onChangeDeviceMode,
}) => {
  const [internalDeviceMode, setInternalDeviceMode] = useState<FooterDeviceMode>(() => {
    try {
      const saved = localStorage.getItem('notmediawiki_device_mode') as FooterDeviceMode | null;
      if (saved && ['auto', 'mobile', 'desktop', 'tv'].includes(saved)) return saved;
    } catch {
      // Ignore storage errors
    }
    return 'desktop';
  });

  const {
    supportTicketsConfig,
    siteTitleConfig,
    themeAppearanceConfig,
    activeTheme,
    setUserTheme,
    openThemeSelector,
  } = useExtensions();
  const isDark = activeTheme.colorScheme === 'dark';
  const deviceMode = controlledDeviceMode ?? internalDeviceMode;

  const handleSelectDeviceMode = (mode: FooterDeviceMode) => {
    setInternalDeviceMode(mode);
    try {
      localStorage.setItem('notmediawiki_device_mode', mode);
    } catch {
      // Ignore storage errors
    }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-device-mode', mode);
    }
    onChangeDeviceMode?.(mode);
  };

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-device-mode', deviceMode);
    }
  }, [deviceMode]);

  const handleToggleAppearance = () => {
    if (themeAppearanceConfig.extensionEnabled) {
      openThemeSelector();
      return;
    }
    setUserTheme(isDark ? 'vector-light' : 'vector-dark');
  };

  return (
    <footer
      data-testid="wiki-global-footer"
      className="mt-12 bg-[#f8f9fa] dark:bg-[#0b0f17] border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 py-6 pb-20 md:pb-6 transition-colors select-none font-sans no-print print:hidden w-full max-w-full overflow-x-clip"
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 space-y-4 min-w-0">
        {/* Modo de Exibição & Aparência Bar (WikiZero standard) */}
        <div className="bg-slate-200/70 dark:bg-slate-900/90 p-2.5 rounded-lg flex flex-wrap items-center justify-between gap-2 border border-slate-300/80 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
              Modo de Exibição:
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              (Escolha como deseja visualizar a enciclopédia)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              id="btn-footer-mobile-view"
              type="button"
              onClick={() => handleSelectDeviceMode('mobile')}
              className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                deviceMode === 'mobile'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700'
              }`}
              title="Ativar layout e navegação otimizados para smartphones e telas touch"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Versão móvel</span>
              {deviceMode === 'mobile' && (
                <span className="text-[9px] bg-blue-500 text-white px-1 rounded-xs uppercase">Ativo</span>
              )}
            </button>

            <button
              id="btn-footer-desktop-view"
              type="button"
              onClick={() => handleSelectDeviceMode('desktop')}
              className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                deviceMode === 'desktop'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700'
              }`}
              title="Ativar layout completo e painéis de computador"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Versão para computador</span>
              {deviceMode === 'desktop' && (
                <span className="text-[9px] bg-blue-500 text-white px-1 rounded-xs uppercase">Ativo</span>
              )}
            </button>

            <button
              id="btn-footer-tv-view"
              type="button"
              onClick={() => handleSelectDeviceMode('tv')}
              className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                deviceMode === 'tv'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700'
              }`}
              title="Ativar interface 10-foot otimizada para Smart TVs e controle remoto"
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Modo Smart TV</span>
              {deviceMode === 'tv' && (
                <span className="text-[9px] bg-indigo-500 text-white px-1 rounded-xs uppercase">Ativo</span>
              )}
            </button>

            <button
              id="btn-footer-appearance-page"
              type="button"
              onClick={handleToggleAppearance}
              className="px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 hover:text-blue-600 dark:hover:text-blue-400 shadow-2xs cursor-pointer"
              title="Abrir seletor de temas e aparência da enciclopédia"
            >
              <Palette className="w-3.5 h-3.5 text-amber-500" />
              <span>
                Aparência &amp; Temas (
                {themeAppearanceConfig.extensionEnabled
                  ? activeTheme.shortLabel
                  : isDark
                    ? 'Escuro'
                    : 'Claro'}
                )
              </span>
            </button>
          </div>
        </div>

        {/* Frase Principal da Wiki */}
        <div className="py-2.5 px-4 rounded-lg bg-blue-50/80 dark:bg-slate-900/90 border border-blue-200/80 dark:border-slate-800 text-center shadow-2xs">
          <p className="font-serif italic text-xs sm:text-sm font-bold text-blue-950 dark:text-blue-200">
            «Όχι, ο Χρόνος δεν είναι ο άρχοντας της γνώσης!»
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-400 font-sans mt-0.5">
            <strong className="text-blue-700 dark:text-blue-400">Frase Principal da Wiki</strong> • &ldquo;Não, o Tempo não é o senhor do conhecimento!&rdquo;
          </p>
        </div>

        {/* Apoie o Conhecimento Livre Banner */}
        <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5 text-center sm:text-left">
            <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
              <Heart className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                Apoie o Conhecimento Livre (Ecossistema WazzimaGiygg)
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Mantenha a enciclopédia no ar, rápida, independente e sem anúncios.
              </p>
            </div>
          </div>
          <a
            href={wrapExternalUrl('https://wazzimagiygg.com')}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 shadow-xs"
          >
            <span>Portal WazzimaGiygg</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Licenses, Legal Compliance & 88x31 Classic Web Badges */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center md:text-left text-[10px] text-slate-500 dark:text-slate-400 font-mono">
            <p>
              O texto está disponível sob a licença{' '}
              <a
                href={wrapExternalUrl('https://creativecommons.org/licenses/by-sa/4.0/')}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
              >
                Creative Commons Atribuição-CompartilhaIgual 4.0 Internacional (CC BY-SA 4.0)
              </a>{' '}
              e{' '}
              <a
                href={wrapExternalUrl('https://www.gnu.org/licenses/gpl-3.0.html')}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
              >
                GNU GPL v3.0
              </a>
              .
            </p>
            <p className="text-slate-500 dark:text-slate-400">
              {siteTitleConfig.siteTitle} · WikiWorldWeb Enciclopédia Aberta © 2026. Infraestrutura e Banco de Dados alimentados por{' '}
              <a
                href={wrapExternalUrl('https://firebase.google.com/products/firestore')}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-600 dark:text-amber-400 hover:underline font-semibold"
              >
                Google Firebase (Cloud Firestore DB)
              </a>{' '}
              • Domínio via{' '}
              <a
                href={wrapExternalUrl('https://www.godaddy.com')}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
              >
                GoDaddy
              </a>{' '}
              • Em conformidade com a <strong>LGPD (Lei nº 13.709/2018)</strong> e o{' '}
              <strong>Marco Civil (Lei nº 12.965/2014)</strong>. DPO: pedrohenriquecardonaperes@gmail.com
            </p>
            {activeTheme.id === 'wikidiota' && (
              <p className="text-rose-800 font-sans text-[11px] pt-1">
                <strong>Wikidiota (Edição Paródia)</strong> · Sátira institucional atribuída à{' '}
                <strong>Wikiomite Foundation</strong> — Crônicas do Feudo de LittleSunshine, Ditadura de Conde Edmond Dantès, Corrupção de Johannnes89 e Reinado do Chronus.
              </p>
            )}
          </div>

          {/* 88x31 Classic Footer Buttons (from wikizero.wazzimagiygg.com) */}
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 pt-1 shrink-0 max-w-md">
            {/* 1. OFFICIAL WikiWorldWeb */}
            <button
              type="button"
              onClick={onNavigateHome}
              title="WikiWorldWeb - Enciclopédia Aberta e Livre"
              className="inline-flex items-center justify-between w-[88px] h-[31px] bg-gradient-to-br from-slate-900 via-slate-800 to-black border border-slate-700 hover:border-blue-500 rounded transition p-1 shadow-xs group cursor-pointer"
            >
              <img
                src="/assets/aistudio/image_370f9ede.png"
                alt="WikiWorldWeb"
                className="w-5 h-5 object-contain rounded-xs shrink-0"
              />
              <div className="flex flex-col text-right leading-none pr-0.5">
                <span className="text-[5.5px] font-mono tracking-tighter text-blue-400 font-bold uppercase">
                  OFFICIAL
                </span>
                <span className="text-[7.5px] font-sans font-bold text-white group-hover:text-blue-300 tracking-tight">
                  WikiWorldWeb
                </span>
              </div>
            </button>

            {/* 2. SUPORTE Tickets 24h (Configured via Firebase SupportAndTickets extension) */}
            {supportTicketsConfig.enabled && (
              <a
                href={wrapExternalUrl(supportTicketsConfig.url)}
                target={supportTicketsConfig.openInNewTab ? '_blank' : '_self'}
                rel="noopener noreferrer"
                title="Central de Suporte, Tickets e Atendimento dos Serviços WazzimaGiygg"
                className="inline-flex items-center justify-between w-[88px] h-[31px] bg-gradient-to-br from-[#1e1b4b] via-[#0f172a] to-[#020617] border border-indigo-500/70 hover:border-indigo-400 rounded transition p-1 shadow-xs group"
              >
                <div className="w-5 h-5 rounded flex items-center justify-center bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 shrink-0">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current text-indigo-300">
                    <path d="M12 2C6.48 2 2 6.48 2 12v6c0 1.1.9 2 2 2h3v-8H4v-2c0-4.41 3.59-8 8-8s8 3.59 8 8v2h-3v8h3c1.1 0 2-.9 2-2v-6c0-5.52-4.48-10-10-10zm-6 12H4v-2h2v2zm14 0h-2v-2h2v2z" />
                  </svg>
                </div>
                <div className="flex flex-col text-right leading-none pr-0.5">
                  <span className="text-[5.2px] font-mono tracking-tighter text-indigo-400 font-bold uppercase">
                    SUPORTE
                  </span>
                  <span className="text-[7.5px] font-sans font-bold text-indigo-100 group-hover:text-white tracking-tight">
                    Tickets 24h
                  </span>
                </div>
              </a>
            )}

            {/* 3. CONFORME LGPD & MCI */}
            <button
              type="button"
              onClick={onNavigateLgpd}
              title="Conformidade integral com a LGPD (Lei nº 13.709/2018) e Marco Civil da Internet (Lei nº 12.965/2014) no Brasil"
              className="inline-flex items-center justify-between w-[88px] h-[31px] bg-gradient-to-br from-[#062c1e] via-[#051f15] to-[#02100b] border border-emerald-500/70 hover:border-emerald-400 rounded transition p-1 shadow-xs group cursor-pointer text-left"
            >
              <div className="w-5 h-5 rounded flex items-center justify-center bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shrink-0">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current text-emerald-400">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                </svg>
              </div>
              <div className="flex flex-col text-right leading-none pr-0.5">
                <span className="text-[5.2px] font-mono tracking-tighter text-emerald-400 font-bold uppercase">
                  CONFORME
                </span>
                <span className="text-[7.5px] font-sans font-bold text-emerald-100 group-hover:text-white tracking-tight">
                  LGPD &amp; MCI
                </span>
              </div>
            </button>

            {/* 4. POWERED BY Firebase DB */}
            <a
              href={wrapExternalUrl('https://firebase.google.com/products/firestore')}
              target="_blank"
              rel="noopener noreferrer"
              title="Banco de Dados e Infraestrutura Cloud fornecidos por Google Firebase Firestore"
              className="inline-flex items-center justify-between w-[88px] h-[31px] bg-gradient-to-br from-[#1a140b] via-[#241a0d] to-[#0f0c08] border border-amber-500/50 hover:border-amber-400 rounded transition p-1 shadow-xs group"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none">
                <path d="M5.4 17.5L8.2 2.8C8.3 2.3 9 2.1 9.4 2.5L13.1 9.3L5.4 17.5Z" fill="#FFA000" />
                <path d="M13.1 9.3L15.3 5.3C15.6 4.8 16.3 4.9 16.5 5.5L18.8 17.5L13.1 9.3Z" fill="#F57C00" />
                <path d="M3.2 19.8L5.4 17.5L13.1 9.3L15.3 13.5L3.8 20.3C3.3 20.6 2.8 20.2 3.2 19.8Z" fill="#FFCA28" />
                <path
                  d="M18.8 17.5L15.3 13.5L13.1 9.3L9.4 2.5C9 2.1 8.3 2.3 8.2 2.8L3.2 19.8C2.9 20.9 3.9 21.8 4.9 21.3L12 17.3L19.1 21.3C20.1 21.8 21.1 20.9 20.8 19.8L18.8 17.5Z"
                  fill="#FFA000"
                />
                <path
                  d="M12 17.3L4.9 21.3C3.9 21.8 2.9 20.9 3.2 19.8L3.8 20.3C3.3 20.2 2.8 20.6 3.2 19.8L4.9 21.3L12 17.3Z"
                  fill="#FF8F00"
                />
              </svg>
              <div className="flex flex-col text-right leading-none pr-0.5">
                <span className="text-[5.5px] font-mono tracking-tighter text-amber-400 font-bold uppercase">
                  POWERED BY
                </span>
                <span className="text-[7.5px] font-sans font-bold text-amber-200 group-hover:text-amber-100 tracking-tight">
                  Firebase DB
                </span>
              </div>
            </a>

            {/* 5. DOMÍNIO GoDaddy */}
            <a
              href={wrapExternalUrl('https://www.godaddy.com')}
              target="_blank"
              rel="noopener noreferrer"
              title="Domínio oficial registrado e adquirido via GoDaddy: https://www.godaddy.com"
              className="inline-flex items-center justify-between w-[88px] h-[31px] bg-gradient-to-br from-[#003734] via-[#002725] to-[#011413] border border-emerald-500/60 hover:border-emerald-400 rounded transition p-1 shadow-xs group"
            >
              <div className="w-5 h-5 rounded flex items-center justify-center bg-emerald-400/10 text-emerald-400 border border-emerald-500/30 shrink-0">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current text-[#00A4A6]">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.5h-2v-2h2v2zm0-4h-2V7h2v5.5z" />
                </svg>
              </div>
              <div className="flex flex-col text-right leading-none pr-0.5">
                <span className="text-[5.5px] font-mono tracking-tighter text-emerald-400 font-bold uppercase">
                  DOMÍNIO
                </span>
                <span className="text-[7.5px] font-sans font-bold text-emerald-100 group-hover:text-white tracking-tight">
                  GoDaddy
                </span>
              </div>
            </a>

            {/* 6. DOSSIÊ WIKI A Verdade */}
            <a
              href={wrapExternalUrl('https://wazzimagiygg.com/averdade/')}
              target="_blank"
              rel="noopener noreferrer"
              title="Investigação e Dossiê dos abusos da Wikipédia contra WazzimaGiygg: https://wazzimagiygg.com/averdade/"
              className="inline-flex items-center justify-between w-[88px] h-[31px] bg-gradient-to-br from-amber-950 via-slate-900 to-black border border-amber-500/60 hover:border-amber-400 rounded transition p-1 shadow-xs group"
            >
              <div className="w-5 h-5 rounded flex items-center justify-center bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                  <path d="M12 2L1 21h22L12 2zm0 3.5l7.53 13.5H4.47L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" />
                </svg>
              </div>
              <div className="flex flex-col text-right leading-none pr-0.5">
                <span className="text-[5.5px] font-mono tracking-tighter text-amber-400 font-bold uppercase">
                  DOSSIÊ WIKI
                </span>
                <span className="text-[7.5px] font-sans font-bold text-amber-100 group-hover:text-white tracking-tight">
                  A Verdade
                </span>
              </div>
            </a>

            {/* 7. OPEN SOURCE GitHub */}
            <a
              href={wrapExternalUrl('https://github.com/WazzimaGiygg/Wiki-alternative')}
              target="_blank"
              rel="noopener noreferrer"
              title="Código-fonte aberto e repositório oficial no GitHub: WazzimaGiygg/Wiki-alternative"
              className="inline-flex items-center justify-between w-[88px] h-[31px] bg-gradient-to-br from-[#24292e] to-[#181a1f] dark:from-[#1b1f24] dark:to-[#0d1117] border border-slate-700 hover:border-slate-400 rounded transition p-1 shadow-xs group"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0 text-white fill-current">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                />
              </svg>
              <div className="flex flex-col text-right leading-none pr-0.5">
                <span className="text-[5.5px] font-mono tracking-tighter text-slate-400 font-bold uppercase">
                  OPEN SOURCE
                </span>
                <span className="text-[7.5px] font-sans font-bold text-white group-hover:text-slate-200 tracking-tight">
                  GitHub
                </span>
              </div>
            </a>

            {/* 8. LICENSE CC BY-SA 4.0 */}
            <a
              href={wrapExternalUrl('https://creativecommons.org/licenses/by-sa/4.0/')}
              target="_blank"
              rel="noopener noreferrer"
              title="Conteúdo licenciado sob Creative Commons Atribuição-CompartilhaIgual (CC BY-SA 4.0)"
              className="inline-flex items-center justify-between w-[88px] h-[31px] bg-[#f8f9fa] dark:bg-[#1a202c] border border-slate-300 dark:border-slate-700 hover:border-slate-500 dark:hover:border-slate-400 rounded transition p-1 shadow-xs group"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-700 dark:text-slate-300 shrink-0" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2.5-9c.83 0 1.5.67 1.5 1.5v1c0 .83-.67 1.5-1.5 1.5H8v-4h1.5zm0 1.5H8.75v1H9.5c.28 0 .5-.22.5-.5s-.22-.5-.5-.5zm5.5-1.5c.83 0 1.5.67 1.5 1.5v1c0 .83-.67 1.5-1.5 1.5H13.5v-4H15zm0 1.5h-.75v1H15c.28 0 .5-.22.5-.5s-.22-.5-.5-.5z" />
              </svg>
              <div className="flex flex-col text-right leading-none pr-0.5">
                <span className="text-[5.5px] font-mono tracking-tighter text-slate-500 dark:text-slate-400 font-bold uppercase">
                  LICENSE
                </span>
                <span className="text-[7.5px] font-sans font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                  CC BY-SA 4.0
                </span>
              </div>
            </a>

            {/* 9. POWERED BY DeepSeek IA */}
            <a
              href={wrapExternalUrl('https://www.deepseek.com/')}
              target="_blank"
              rel="noopener noreferrer"
              title="Powered by DeepSeek IA - Modelos de Raciocínio e Inteligência Artificial Aberta"
              className="inline-flex items-center justify-between w-[88px] h-[31px] bg-gradient-to-br from-[#0c1829] to-[#040d1a] border border-cyan-800/80 hover:border-cyan-400 rounded transition p-1 shadow-xs group"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none">
                <path
                  d="M4 14.5C4 9.5 8 5.5 13 5.5C18 5.5 21 8.5 21 11.5C21 14.5 18 18 13 18C10 18 8 17 6.5 16L4 18.5V14.5Z"
                  fill="#00B4D8"
                />
                <circle cx="14" cy="9.5" r="1.5" fill="#FFFFFF" />
                <path d="M8.5 13C10 14.5 13.5 14.5 15.5 13" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <div className="flex flex-col text-right leading-none pr-0.5">
                <span className="text-[5.5px] font-mono tracking-tighter text-cyan-400 font-bold uppercase">
                  POWERED BY
                </span>
                <span className="text-[7.5px] font-sans font-bold text-white group-hover:text-cyan-300 tracking-tight">
                  DeepSeek IA
                </span>
              </div>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
