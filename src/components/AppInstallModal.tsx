import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Monitor,
  Download,
  CheckCircle2,
  X,
  Share,
  PlusSquare,
  Laptop,
  Wifi,
  LayoutGrid,
} from 'lucide-react';
import { AppDeviceMode, usePWAInstall } from '../hooks/usePWAInstall';
import { useExtensions } from '../context/ExtensionsContext';

interface AppInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceMode: AppDeviceMode;
  onChangeDeviceMode: (mode: AppDeviceMode) => void;
}

export const AppInstallModal: React.FC<AppInstallModalProps> = ({
  isOpen,
  onClose,
  deviceMode,
  onChangeDeviceMode,
}) => {
  const { siteTitleConfig } = useExtensions();
  const { isInstallable, isInstalled, isIOS, isMobileOS, platformOS, install } = usePWAInstall();
  const [selectedPlatform, setSelectedPlatform] = useState<'mobile' | 'desktop'>(() =>
    deviceMode === 'mobile' || isMobileOS ? 'mobile' : 'desktop'
  );
  const [installFeedback, setInstallFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedPlatform(deviceMode === 'mobile' || isMobileOS ? 'mobile' : 'desktop');
      setInstallFeedback(null);
    }
  }, [isOpen, deviceMode, isMobileOS]);

  if (!isOpen) return null;

  const handleTriggerInstall = async () => {
    setInstallFeedback(null);
    if (isInstallable) {
      const accepted = await install();
      if (accepted) {
        setInstallFeedback(
          `Aplicativo ${siteTitleConfig.siteTitle} instalado com sucesso neste dispositivo.`
        );
      } else {
        setInstallFeedback('Instalação cancelada no prompt do navegador. Você pode tentar novamente quando quiser.');
      }
      return;
    }

    if (selectedPlatform === 'mobile') {
      if (isIOS) {
        setInstallFeedback(
          'No iPhone/iPad (Safari), toque em Compartilhar e escolha "Adicionar à Tela de Início".'
        );
      } else {
        setInstallFeedback(
          'No Android (Chrome/Edge), abra o menu do navegador (⋮) e toque em "Instalar aplicativo" ou "Adicionar à tela inicial".'
        );
      }
    } else {
      setInstallFeedback(
        'No computador (Chrome ou Edge), clique no ícone de instalação na barra de endereços ou abra Menu (⋮) → Salvar e compartilhar → Instalar aplicativo.'
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-install-modal-title"
      data-testid="app-install-modal"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/80 dark:bg-slate-900/90">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/assets/aistudio/image_370f9ede.png"
              alt={`Ícone do aplicativo ${siteTitleConfig.siteTitle}`}
              className="w-9 h-9 rounded-lg object-contain border border-slate-200 dark:border-slate-700 bg-white p-0.5 shrink-0"
            />
            <div className="min-w-0">
              <h2
                id="app-install-modal-title"
                className="text-base font-bold text-slate-900 dark:text-slate-100 truncate"
              >
                Aplicativo Mobile &amp; para Computador
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {siteTitleConfig.siteTitle} · Modo atual:{' '}
                <strong className="text-slate-800 dark:text-slate-200">
                  {deviceMode === 'mobile'
                    ? 'Aplicativo Mobile'
                    : deviceMode === 'tv'
                      ? 'Smart TV'
                      : 'Aplicativo para Computador'}
                </strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar opções de aplicativo"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Status Strip when already running standalone */}
          {isInstalled && (
            <div
              data-testid="app-already-installed-banner"
              className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                Você já está executando o <strong>{siteTitleConfig.siteTitle}</strong> como aplicativo instalado em janela dedicada.
              </span>
            </div>
          )}

          {/* Segmented Platform Switcher */}
          <div
            className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            role="tablist"
            aria-label="Escolha entre aplicativo mobile e aplicativo para computador"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedPlatform === 'mobile'}
              data-testid="tab-platform-mobile"
              onClick={() => {
                setSelectedPlatform('mobile');
                setInstallFeedback(null);
              }}
              className={`min-h-[44px] px-3 py-2 rounded-md text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                selectedPlatform === 'mobile'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>Aplicativo Mobile</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={selectedPlatform === 'desktop'}
              data-testid="tab-platform-desktop"
              onClick={() => {
                setSelectedPlatform('desktop');
                setInstallFeedback(null);
              }}
              className={`min-h-[44px] px-3 py-2 rounded-md text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                selectedPlatform === 'desktop'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Monitor className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>Aplicativo para Computador</span>
            </button>
          </div>

          {/* Selected Platform Panel */}
          {selectedPlatform === 'mobile' ? (
            <div
              data-testid="panel-mobile-app-option"
              className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-4 bg-slate-50/50 dark:bg-slate-900"
            >
              <div className="space-y-1">
                <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  Android &amp; iOS (iPhone / iPad) · Interface Touch
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Versão e Aplicativo Mobile do {siteTitleConfig.siteTitle}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Ativa barra inferior fixa de navegação para o polegar, cartões em coluna única e alvos táteis ampliados. Pode ser instalado na tela inicial do celular com suporte offline.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  data-testid="btn-activate-mobile-mode"
                  onClick={() => onChangeDeviceMode('mobile')}
                  className={`min-h-[44px] px-4 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 border transition-colors cursor-pointer whitespace-nowrap ${
                    deviceMode === 'mobile'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4 shrink-0" />
                  <span>
                    {deviceMode === 'mobile'
                      ? 'Modo Aplicativo Mobile Ativo'
                      : 'Usar Interface Mobile Agora'}
                  </span>
                </button>

                {!isInstalled && (
                  <button
                    type="button"
                    data-testid="btn-install-mobile-app"
                    onClick={handleTriggerInstall}
                    className="min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    <span>
                      {isInstallable
                        ? 'Instalar App no Celular'
                        : isIOS
                          ? 'Ver Passos no iPhone / iPad'
                          : 'Instalar na Tela Inicial'}
                    </span>
                  </button>
                )}
              </div>

              {/* Platform Guide */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-300">
                <div className="space-y-1">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Android (Chrome / Edge)</span>
                  </div>
                  <p className="leading-relaxed text-[11px]">
                    Clique em <strong>Instalar App</strong> ou abra o menu <strong>(⋮)</strong> do navegador e toque em <strong>Instalar aplicativo</strong>.
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Share className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>iPhone &amp; iPad (Safari)</span>
                  </div>
                  <p className="leading-relaxed text-[11px]">
                    Toque no botão <strong>Compartilhar</strong> da barra do Safari e selecione <PlusSquare className="w-3 h-3 inline mx-0.5" /> <strong>Adicionar à Tela de Início</strong>.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div
              data-testid="panel-desktop-app-option"
              className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-4 bg-slate-50/50 dark:bg-slate-900"
            >
              <div className="space-y-1">
                <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  Windows, macOS &amp; Linux · Sistema detectado: {platformOS.toUpperCase()}
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Versão e Aplicativo para Computador do {siteTitleConfig.siteTitle}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Exibe o layout completo em múltiplas colunas com barras laterais de índice, atalho global de busca (Ctrl+K) e execução em janela independente na Área de Trabalho ou Dock.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  data-testid="btn-activate-desktop-mode"
                  onClick={() => onChangeDeviceMode('desktop')}
                  className={`min-h-[44px] px-4 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 border transition-colors cursor-pointer whitespace-nowrap ${
                    deviceMode === 'desktop'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Laptop className="w-4 h-4 shrink-0" />
                  <span>
                    {deviceMode === 'desktop'
                      ? 'Modo Computador Ativo'
                      : 'Usar Interface para Computador'}
                  </span>
                </button>

                {!isInstalled && (
                  <button
                    type="button"
                    data-testid="btn-install-desktop-app"
                    onClick={handleTriggerInstall}
                    className="min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    <span>
                      {isInstallable
                        ? 'Instalar App no Computador'
                        : 'Como Instalar no Computador'}
                    </span>
                  </button>
                )}
              </div>

              {/* Desktop Guide */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-300">
                <div className="space-y-1">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Windows &amp; Linux (Chrome / Edge)</span>
                  </div>
                  <p className="leading-relaxed text-[11px]">
                    Clique no ícone de instalação na barra de endereços para fixar na Barra de Tarefas ou Menu Iniciar.
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>macOS (Chrome / Safari / Edge)</span>
                  </div>
                  <p className="leading-relaxed text-[11px]">
                    Instale como janela standalone ou use <strong>Arquivo → Adicionar ao Dock</strong> no Safari para abrir direto pelo Launchpad.
                  </p>
                </div>
              </div>
            </div>
          )}

          {installFeedback && (
            <div
              role="status"
              className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200"
            >
              {installFeedback}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>Suporte offline ativo via Service Worker (/sw.js)</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
