import React from 'react';
import { RefreshCw, X, GitCompare } from 'lucide-react';
import { Article, UserSession } from '../types';

export interface RealtimeToastPayload {
  visible: boolean;
  editorName: string;
  summary: string;
  timestamp: string;
  revId: string;
}

export interface ArticleBaseline {
  revisionId: string | null;
  wikitext: string | null;
  updatedAt?: string | null;
}

/**
 * Pure helper that determines whether an incoming Firestore article snapshot
 * represents a new edit by another collaborator that should trigger a toast.
 */
export function detectCollaboratorArticleUpdate(
  liveArticle: Article & {
    authorUid?: string;
    author?: { id?: string; name?: string; username?: string; email?: string };
    lastEditedBy?: string;
    comment?: string;
  },
  baseline: ArticleBaseline,
  currentUser: Pick<UserSession, 'id' | 'username' | 'email'> | null | undefined,
  authUid?: string | null,
  dismissedRevId?: string | null
): RealtimeToastPayload | null {
  const isNewRev = Boolean(
    liveArticle.latestRevisionId &&
      baseline.revisionId &&
      liveArticle.latestRevisionId !== baseline.revisionId
  );
  const isNewWikitext = Boolean(
    liveArticle.wikitext &&
      baseline.wikitext &&
      liveArticle.wikitext !== baseline.wikitext
  );
  const isNewTimestamp = Boolean(
    liveArticle.updatedAt &&
      baseline.updatedAt &&
      liveArticle.updatedAt !== baseline.updatedAt
  );

  if (!isNewRev && !isNewWikitext && !isNewTimestamp) {
    return null;
  }

  const incomingRevId =
    liveArticle.latestRevisionId || liveArticle.updatedAt || 'nova-revisao';

  // Do not re-open if the user already dismissed this exact revision
  if (dismissedRevId && dismissedRevId === incomingRevId) {
    return null;
  }

  // Suppress self-edits by comparing UID, email, or username
  const editorUid = liveArticle.authorUid || liveArticle.author?.id;
  const currentUserId = currentUser?.id || authUid || null;
  if (currentUserId && editorUid && editorUid === currentUserId) {
    return null;
  }

  const editorName =
    liveArticle.lastEditedBy ||
    liveArticle.author?.name ||
    liveArticle.author?.username ||
    'Outro colaborador';

  if (
    currentUser?.username &&
    editorName.trim().toLowerCase() === currentUser.username.trim().toLowerCase()
  ) {
    return null;
  }

  if (
    currentUser?.email &&
    liveArticle.author?.email &&
    liveArticle.author.email.trim().toLowerCase() === currentUser.email.trim().toLowerCase()
  ) {
    return null;
  }

  const summary =
    liveArticle.comment || liveArticle.summary || 'Alterações publicadas no conteúdo';

  return {
    visible: true,
    editorName,
    summary,
    timestamp: liveArticle.updatedAt || new Date().toISOString(),
    revId: incomingRevId,
  };
}

export interface RealtimeUpdateToastProps {
  toast: RealtimeToastPayload | null;
  isRefreshing: boolean;
  onReload: () => void;
  onDismiss: () => void;
  onViewHistory?: () => void;
}

export const RealtimeUpdateToast: React.FC<RealtimeUpdateToastProps> = ({
  toast,
  isRefreshing,
  onReload,
  onDismiss,
  onViewHistory,
}) => {
  if (!toast || !toast.visible) {
    return null;
  }

  const formattedTime = (() => {
    try {
      return new Date(toast.timestamp).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  })();

  return (
    <aside
      role="status"
      aria-live="polite"
      data-testid="realtime-update-toast"
      className="fixed bottom-20 right-5 z-50 max-w-sm sm:max-w-md w-[calc(100vw-2.5rem)] bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl shadow-xl p-4 transition-all duration-200"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                Artigo atualizado em tempo real
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                {formattedTime ? `Às ${formattedTime} · ` : ''}
                Revisão {toast.revId}
              </p>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Fechar notificação de atualização"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
            O colaborador <strong className="text-slate-900 dark:text-slate-100">{toast.editorName}</strong> publicou uma nova versão deste artigo no Firestore.
          </p>

          {toast.summary && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-1 truncate">
              &ldquo;{toast.summary}&rdquo;
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button
              type="button"
              onClick={onReload}
              disabled={isRefreshing}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Atualizando...' : 'Atualizar conteúdo'}</span>
            </button>

            {onViewHistory && (
              <button
                type="button"
                onClick={onViewHistory}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <GitCompare className="w-3.5 h-3.5" />
                <span>Ver histórico</span>
              </button>
            )}

            <button
              type="button"
              onClick={onDismiss}
              className="px-2 py-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 text-xs font-medium transition-colors cursor-pointer"
            >
              Continuar lendo
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default RealtimeUpdateToast;
