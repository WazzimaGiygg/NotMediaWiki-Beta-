import React from 'react';
import { BotOff, ShieldAlert, ExternalLink } from 'lucide-react';
import { PRIMARY_CANONICAL_ORIGIN } from '../utils/seoManager';

interface ChatbotBlockedScreenProps {
  siteTitle: string;
  blockMessage: string;
  matchedAgent?: string;
  reason?: string;
}

export const ChatbotBlockedScreen: React.FC<ChatbotBlockedScreenProps> = ({
  siteTitle,
  blockMessage,
  matchedAgent,
  reason,
}) => {
  return (
    <main
      role="main"
      aria-label="Acesso bloqueado para chatbots pela extensão ChatbotBlocker"
      className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans"
    >
      <section
        role="region"
        aria-label="Aviso de proteção contra abertura por chatbots"
        className="max-w-lg w-full bg-slate-900 border border-rose-800/70 rounded-xl p-6 sm:p-8 space-y-5 shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-rose-950 border border-rose-700/70 flex items-center justify-center text-rose-400 shrink-0">
            <BotOff className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              Extensão ChatbotBlocker (ext-chatbot-blocker)
            </div>
            <h1 className="text-xl font-serif font-bold text-white mt-0.5">
              Acesso bloqueado para chatbots
            </h1>
          </div>
        </div>

        <p className="text-sm text-slate-200 leading-relaxed">
          {blockMessage}
        </p>

        <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3.5 space-y-1.5 text-xs font-mono text-slate-300">
          <div>
            <span className="text-slate-500">Wiki-site:</span>{' '}
            <span className="text-slate-100 font-semibold">{siteTitle}</span>
          </div>
          {matchedAgent && (
            <div>
              <span className="text-slate-500">Agente/Origem detectada:</span>{' '}
              <span className="text-rose-300">{matchedAgent}</span>
            </div>
          )}
          {reason && (
            <div className="text-slate-400 font-sans text-[11px] pt-0.5">
              {reason}
            </div>
          )}
        </div>

        <div className="pt-1 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800">
          <span className="text-[11px] text-slate-400">
            Navegação permitida exclusivamente para visitantes humanos e navegadores padrão.
          </span>
          <a
            href={PRIMARY_CANONICAL_ORIGIN}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-medium rounded-lg transition-colors"
          >
            <span>Abrir diretamente no navegador</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </section>
    </main>
  );
};
