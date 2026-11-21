import React from 'react';
import { Home, BookOpen, Shuffle, Smartphone } from 'lucide-react';
import { AppDeviceMode } from '../hooks/usePWAInstall';

interface MobileAppNavBarProps {
  currentView: string;
  deviceMode: AppDeviceMode;
  onSelectHome: () => void;
  onSelectReader: () => void;
  onRandomArticle: () => void;
  onOpenAppOptions: () => void;
}

export const MobileAppNavBar: React.FC<MobileAppNavBarProps> = ({
  currentView,
  deviceMode,
  onSelectHome,
  onSelectReader,
  onRandomArticle,
  onOpenAppOptions,
}) => {
  if (deviceMode === 'tv') return null;

  // Show permanently when Mobile App mode is explicitly selected, or on <768px viewports unless locked to desktop
  const visibilityClass =
    deviceMode === 'mobile'
      ? 'flex'
      : deviceMode === 'desktop'
        ? 'hidden'
        : 'flex md:hidden';

  return (
    <nav
      data-testid="mobile-app-bottom-nav"
      aria-label="Navegação do Aplicativo Mobile"
      className={`${visibilityClass} fixed bottom-0 left-0 right-0 z-40 h-15 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 items-center justify-around px-2 shadow-lg no-print print:hidden`}
    >
      <button
        type="button"
        onClick={onSelectHome}
        className={`min-h-[44px] min-w-[56px] flex flex-col items-center justify-center gap-0.5 rounded-lg px-2 transition-colors cursor-pointer ${
          currentView === 'home'
            ? 'text-blue-600 dark:text-blue-400 font-semibold'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
        }`}
      >
        <Home className="w-5 h-5" />
        <span className="text-[10px] leading-none">Início</span>
      </button>

      <button
        type="button"
        onClick={onSelectReader}
        className={`min-h-[44px] min-w-[56px] flex flex-col items-center justify-center gap-0.5 rounded-lg px-2 transition-colors cursor-pointer ${
          currentView === 'reader'
            ? 'text-blue-600 dark:text-blue-400 font-semibold'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
        }`}
      >
        <BookOpen className="w-5 h-5" />
        <span className="text-[10px] leading-none">Artigo</span>
      </button>

      <button
        type="button"
        onClick={onRandomArticle}
        className="min-h-[44px] min-w-[56px] flex flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
      >
        <Shuffle className="w-5 h-5" />
        <span className="text-[10px] leading-none">Aleatória</span>
      </button>

      <button
        type="button"
        onClick={onOpenAppOptions}
        className={`min-h-[44px] min-w-[56px] flex flex-col items-center justify-center gap-0.5 rounded-lg px-2 transition-colors cursor-pointer ${
          deviceMode === 'mobile'
            ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
        }`}
      >
        <Smartphone className="w-5 h-5" />
        <span className="text-[10px] leading-none">App</span>
      </button>
    </nav>
  );
};
