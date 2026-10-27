import React, { useState, useEffect } from 'react';
import {
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Zap,
  Award,
  CheckCircle2,
  TrendingUp,
  User,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { UserSession, ArticleVoteSummary, VoteType, UserKarmaProfile } from '../types';
import { api } from '../api';

interface ArticleFeedbackWidgetProps {
  articleSlug: string;
  articleTitle: string;
  authorUid?: string;
  authorName?: string;
  currentUser: UserSession | null;
  onNavigateUser?: (userSlug: string) => void;
  className?: string;
}

export const ArticleFeedbackWidget: React.FC<ArticleFeedbackWidgetProps> = ({
  articleSlug,
  articleTitle,
  authorUid,
  authorName,
  currentUser,
  onNavigateUser,
  className = '',
}) => {
  const [summary, setSummary] = useState<ArticleVoteSummary>({
    upvotes: 0,
    downvotes: 0,
    totalVotes: 0,
    score: 0,
    approvalPercentage: 100,
    userVote: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type: 'success' | 'info' | 'warn' } | null>(null);
  const [authorKarma, setAuthorKarma] = useState<UserKarmaProfile | null>(null);

  // Subscribe to real-time votes for this article
  useEffect(() => {
    const unsub = api.subscribeArticleVotes(
      articleSlug,
      currentUser?.id,
      (newSummary) => {
        setSummary(newSummary);
      }
    );

    return () => unsub();
  }, [articleSlug, currentUser?.id]);

  // Load and listen to the article editor's Karma
  useEffect(() => {
    if (!authorUid) {
      setAuthorKarma(null);
      return;
    }

    let isMounted = true;
    api.getUserKarma(authorUid)
      .then(profile => {
        if (isMounted) setAuthorKarma(profile);
      })
      .catch(console.warn);

    const unsubKarma = api.subscribeUserKarma(authorUid, updated => {
      if (isMounted) setAuthorKarma(updated);
    });

    return () => {
      isMounted = false;
      unsubKarma();
    };
  }, [authorUid]);

  const handleVote = async (voteType: VoteType) => {
    if (!currentUser) {
      setFeedbackToast({
        message: 'Faça login com sua conta Google para votar e recompensar os editores com Karma!',
        type: 'warn',
      });
      setTimeout(() => setFeedbackToast(null), 4000);
      return;
    }

    if (authorUid && authorUid === currentUser.id) {
      setFeedbackToast({
        message: 'Você é o autor desta edição. O sistema de Karma não permite votar em seus próprios artigos.',
        type: 'info',
      });
      setTimeout(() => setFeedbackToast(null), 4000);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.submitArticleVote({
        articleSlug,
        vote: voteType,
        currentUser,
        authorUid,
        authorName,
      });

      if (res.action === 'created' || res.action === 'updated') {
        if (voteType === 'up') {
          setFeedbackToast({
            message: `Você curtiu este artigo! +10 Karma foram concedidos a ${authorName || 'o editor'}.`,
            type: 'success',
          });
        } else {
          setFeedbackToast({
            message: 'Feedback registrado. Agradecemos sua contribuição para a melhoria do artigo.',
            type: 'info',
          });
        }
      } else if (res.action === 'removed') {
        setFeedbackToast({
          message: 'Seu voto foi removido deste artigo.',
          type: 'info',
        });
      }

      setTimeout(() => setFeedbackToast(null), 3500);
    } catch (err: any) {
      console.error('Error submitting vote:', err);
      setFeedbackToast({
        message: err.message || 'Falha ao registrar voto.',
        type: 'warn',
      });
      setTimeout(() => setFeedbackToast(null), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isUpvoted = summary.userVote === 'up';
  const isDownvoted = summary.userVote === 'down';
  const displayAuthor = authorName || 'Wikipedian';

  return (
    <div
      className={`border border-slate-200 dark:border-slate-800 bg-linear-to-br from-white via-slate-50/70 to-blue-50/30 dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-800/40 rounded-xl p-5 my-6 shadow-xs font-sans transition-all ${className}`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Quality Feedback Prompt */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-blue-600 text-white shadow-xs">
              <TrendingUp className="w-3.5 h-3.5" />
            </span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Este artigo foi útil para você?</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-300 dark:border-emerald-800">
                Qualidade da Enciclopédia
              </span>
            </h3>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Seu voto ajuda a medir a qualidade do verbete e recompensa os editores responsáveis com pontos de <strong>Karma</strong>.
          </p>
        </div>

        {/* Voting Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Like / Upvote Button */}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleVote('up')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
              isUpvoted
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 shadow-sm scale-102 ring-2 ring-emerald-400/40'
                : 'bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-300 border-slate-300 dark:border-slate-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={isUpvoted ? 'Clique para remover sua curtida' : 'Curtir este artigo (+10 Karma para o autor)'}
          >
            <ThumbsUp className={`w-4 h-4 ${isUpvoted ? 'fill-white stroke-white' : ''}`} />
            <span>Útil</span>
            <span
              className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${
                isUpvoted
                  ? 'bg-emerald-800/60 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {summary.upvotes}
            </span>
          </button>

          {/* Dislike / Downvote Button */}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleVote('down')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
              isDownvoted
                ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-700 shadow-sm scale-102 ring-2 ring-rose-400/40'
                : 'bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-200 hover:text-rose-700 dark:hover:text-rose-300 border-slate-300 dark:border-slate-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={isDownvoted ? 'Clique para remover seu voto' : 'Não achei este artigo útil'}
          >
            <ThumbsDown className={`w-4 h-4 ${isDownvoted ? 'fill-white stroke-white' : ''}`} />
            <span>Não foi útil</span>
            <span
              className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${
                isDownvoted
                  ? 'bg-rose-800/60 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {summary.downvotes}
            </span>
          </button>
        </div>
      </div>

      {/* Progress & Quality Metrics */}
      <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        {/* Quality Approval Bar */}
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="flex-1 bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{ width: `${summary.totalVotes > 0 ? summary.approvalPercentage : 100}%` }}
              title={`Aprovação: ${summary.approvalPercentage}%`}
            />
            <div
              className="bg-rose-500 h-full transition-all duration-500"
              style={{ width: `${summary.totalVotes > 0 ? 100 - summary.approvalPercentage : 0}%` }}
              title={`Desaprovação: ${100 - summary.approvalPercentage}%`}
            />
          </div>
          <span className="font-semibold text-slate-800 dark:text-slate-200 shrink-0 text-xs font-mono">
            {summary.totalVotes > 0 ? `${summary.approvalPercentage}% de aprovação` : '100% de aprovação (Sem votos)'}
          </span>
          <span className="text-[11px] text-slate-400 font-mono shrink-0">
            ({summary.totalVotes} {summary.totalVotes === 1 ? 'voto' : 'votos'})
          </span>
        </div>

        {/* Editor Karma Attribution Info */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />
            <span>Editor:</span>
          </span>
          {authorUid ? (
            <button
              onClick={() => onNavigateUser?.(`Usuário:${displayAuthor}`)}
              className="inline-flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer group"
              title="Ver Perfil e Karma do Editor"
            >
              <span>{displayAuthor}</span>
              {authorKarma && (
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border flex items-center gap-0.5 ${authorKarma.rankColor}`}>
                  <span>{authorKarma.rankIcon}</span>
                  <span>{authorKarma.karma} Karma</span>
                </span>
              )}
            </button>
          ) : (
            <span className="font-semibold text-slate-700 dark:text-slate-300">{displayAuthor}</span>
          )}
        </div>
      </div>

      {/* Interactive Toast / Feedback banner */}
      {feedbackToast && (
        <div
          className={`mt-3 p-2.5 rounded-lg text-xs flex items-center justify-between gap-2 animate-fadeIn transition-all border ${
            feedbackToast.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : feedbackToast.type === 'warn'
              ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
              : 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackToast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : feedbackToast.type === 'warn' ? (
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            )}
            <span>{feedbackToast.message}</span>
          </div>
          <button
            onClick={() => setFeedbackToast(null)}
            className="text-[11px] font-semibold hover:underline opacity-80 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}
    </div>
  );
};
