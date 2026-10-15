import React, { useState, useEffect } from 'react';
import { Star, CheckCircle, Award, Sparkles, MessageSquare } from 'lucide-react';
import { UserSession, ArticleRating } from '../types';
import {
  submitArticleRatingToFirestore,
  subscribeToArticleRatings,
} from '../firebase';

interface ArticleRatingWidgetProps {
  articleSlug: string;
  articleTitle: string;
  currentUser: UserSession | null;
  onRatingSubmitted?: (rating: ArticleRating) => void;
  onOpenChecklist?: () => void;
}

export const ArticleRatingWidget: React.FC<ArticleRatingWidgetProps> = ({
  articleSlug,
  articleTitle,
  currentUser,
  onRatingSubmitted,
  onOpenChecklist,
}) => {
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRating, setSubmittedRating] = useState<ArticleRating | null>(null);
  const [ratings, setRatings] = useState<ArticleRating[]>([]);
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);

  // Subscribe to real-time ratings for this article from Firestore
  useEffect(() => {
    setSelectedRating(0);
    setSubmittedRating(null);
    setShowFeedbackInput(false);
    setFeedback('');

    const unsub = subscribeToArticleRatings(articleSlug, fetchedRatings => {
      setRatings(fetchedRatings);
      if (currentUser) {
        const userRating = fetchedRatings.find(r => r.userId === currentUser.id);
        if (userRating) {
          setSubmittedRating(userRating);
          setSelectedRating(userRating.rating);
        }
      }
    });

    return () => unsub();
  }, [articleSlug, currentUser]);

  const averageRating =
    ratings.length > 0
      ? (ratings.reduce((acc, curr) => acc + curr.rating, 0) / ratings.length).toFixed(1)
      : null;

  const handleRate = async (stars: number) => {
    if (!currentUser) return;
    setSelectedRating(stars);
    setIsSubmitting(true);

    try {
      const res = await submitArticleRatingToFirestore({
        articleSlug,
        userId: currentUser.id,
        username: currentUser.username,
        rating: stars,
        feedback: feedback.trim() || undefined,
      });

      setSubmittedRating(res);
      if (onRatingSubmitted) onRatingSubmitted(res);
    } catch (err) {
      console.error('Error submitting article rating:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-linear-to-r from-amber-50/70 to-orange-50/60 dark:from-slate-800/80 dark:to-slate-800/60 border border-amber-200/80 dark:border-amber-900/40 rounded-xl p-5 my-6 shadow-2xs font-sans transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500 text-white shadow-xs">
              <Award className="w-4 h-4" />
            </span>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <span>Avaliação do Artigo</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-semibold border border-amber-300 dark:border-amber-800">
                Checklist Diário • 3.05.8.b.c (+1.00 pt)
              </span>
            </h4>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Avalie a clareza, fontes e neutralidade deste artigo para cumprir a meta do dia e acumular pontos mensais.
          </p>
        </div>

        {/* Global Average Rating */}
        {averageRating && (
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-900/60 shadow-2xs shrink-0 self-start sm:self-center">
            <div className="flex items-center text-amber-500">
              <Star className="w-4 h-4 fill-amber-400" />
              <span className="font-bold text-sm ml-1 text-slate-800 dark:text-slate-200">{averageRating}</span>
              <span className="text-xs text-slate-400 ml-0.5">/ 5</span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              ({ratings.length} {ratings.length === 1 ? 'avaliação' : 'avaliações'})
            </span>
          </div>
        )}
      </div>

      {/* Rating Stars Section */}
      <div className="mt-4 pt-3 border-t border-amber-200/60 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 mr-1">
            {submittedRating ? 'Sua Avaliação:' : 'Classifique este artigo:'}
          </span>
          <div className="flex items-center gap-1" onMouseLeave={() => setHoverRating(0)}>
            {[1, 2, 3, 4, 5].map(star => {
              const active = (hoverRating || selectedRating) >= star;
              return (
                <button
                  key={star}
                  type="button"
                  disabled={isSubmitting || !currentUser}
                  onClick={() => handleRate(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  className={`p-1 rounded-sm transition-transform hover:scale-110 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    active ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600'
                  }`}
                  title={`Avaliar com ${star} estrela${star > 1 ? 's' : ''}`}
                >
                  <Star className={`w-5 h-5 ${active ? 'fill-amber-400' : ''}`} />
                </button>
              );
            })}
          </div>

          {selectedRating > 0 && (
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400 ml-1">
              {selectedRating === 5 && 'Excelente!'}
              {selectedRating === 4 && 'Muito Bom!'}
              {selectedRating === 3 && 'Razoável'}
              {selectedRating === 2 && 'Precisa Melhorar'}
              {selectedRating === 1 && 'Insuficiente'}
            </span>
          )}
        </div>

        {/* Status / Checklist Success Banner */}
        {submittedRating ? (
          <div className="flex items-center gap-2 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 px-3 py-1.5 rounded-lg text-xs font-medium animate-fadeIn">
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Missão 3.05.8.b.c concluída! <strong>+1.00 ponto</strong> creditado hoje.</span>
            {onOpenChecklist && (
              <button
                onClick={onOpenChecklist}
                className="underline font-bold hover:text-emerald-900 dark:hover:text-emerald-200 ml-1 cursor-pointer"
              >
                Ver Checklist
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {!showFeedbackInput ? (
              <button
                type="button"
                onClick={() => setShowFeedbackInput(true)}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Adicionar observação (opcional)</span>
              </button>
            ) : null}
            {!currentUser && (
              <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                Faça login para pontuar no Checklist
              </span>
            )}
          </div>
        )}
      </div>

      {/* Optional Feedback Input */}
      {showFeedbackInput && !submittedRating && (
        <div className="mt-3 pt-3 border-t border-amber-200/40 dark:border-slate-700/40 flex items-center gap-2">
          <input
            type="text"
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="Comentário sobre qualidade, precisão ou correções recomendadas..."
            className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-amber-500"
          />
          <button
            type="button"
            disabled={!selectedRating || isSubmitting}
            onClick={() => handleRate(selectedRating)}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md cursor-pointer transition-colors"
          >
            Salvar Avaliação
          </button>
        </div>
      )}
    </div>
  );
};
