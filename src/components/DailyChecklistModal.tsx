import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  Circle,
  Award,
  Calendar,
  Flame,
  TrendingUp,
  LogIn,
  Edit3,
  Star,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Trophy,
  Info,
  Clock,
  RefreshCw,
} from 'lucide-react';
import {
  UserSession,
  UserDailyChecklist,
  UserMonthlyPointsLedger,
} from '../types';
import {
  getTodayDateString,
  getCurrentMonthString,
  fetchDailyChecklistFromFirestore,
  fetchMonthlyPointsFromFirestore,
  subscribeToDailyChecklist,
  subscribeToMonthlyPoints,
  recordDailyChecklistAction,
  fetchMonthlyLeaderboard,
  loginWithGoogle,
} from '../firebase';

interface DailyChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserSession | null;
  onUserChanged?: (user: UserSession) => void;
  onNavigateToArticle?: (slug: string) => void;
  onNavigateToEditor?: (slug?: string) => void;
}

export const DailyChecklistModal: React.FC<DailyChecklistModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserChanged,
  onNavigateToArticle,
  onNavigateToEditor,
}) => {
  const [activeTab, setActiveTab] = useState<'checklist' | 'history' | 'leaderboard'>('checklist');
  const [dailyChecklist, setDailyChecklist] = useState<UserDailyChecklist | null>(null);
  const [monthlyLedger, setMonthlyLedger] = useState<UserMonthlyPointsLedger | null>(null);
  const [leaderboard, setLeaderboard] = useState<UserMonthlyPointsLedger[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const todayStr = getTodayDateString();
  const currentMonthStr = getCurrentMonthString();

  // Format date readable in PT-BR
  const dateFormatted = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const monthName = new Date().toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });

  // Subscribe to user daily checklist and monthly points in Firestore
  useEffect(() => {
    if (!isOpen || !currentUser) return;

    setIsLoading(true);

    // Initial load
    fetchDailyChecklistFromFirestore(currentUser.id, todayStr)
      .then(res => {
        if (res) setDailyChecklist(res);
      })
      .catch(console.warn);

    fetchMonthlyPointsFromFirestore(currentUser.id, currentMonthStr)
      .then(res => {
        if (res) setMonthlyLedger(res);
      })
      .catch(console.warn);

    // Real-time listener
    const unsubDaily = subscribeToDailyChecklist(currentUser.id, updated => {
      if (updated) setDailyChecklist(updated);
      setIsLoading(false);
    });

    const unsubMonthly = subscribeToMonthlyPoints(currentUser.id, updated => {
      if (updated) setMonthlyLedger(updated);
    });

    // Load leaderboard
    fetchMonthlyLeaderboard(currentMonthStr).then(setLeaderboard).catch(console.warn);

    return () => {
      unsubDaily();
      unsubMonthly();
    };
  }, [isOpen, currentUser, todayStr, currentMonthStr]);

  // If user is logged in, ensure login point (3.05.8.b.a) is automatically credited
  useEffect(() => {
    if (isOpen && currentUser && currentUser.id) {
      if (!dailyChecklist?.items.login.completed) {
        recordDailyChecklistAction(currentUser.id, currentUser.username, 'login')
          .then(res => {
            setDailyChecklist(res.checklist);
            if (res.pointsAdded > 0) {
              setActionNotice('Login diário confirmado: +1.00 ponto creditado!');
              setTimeout(() => setActionNotice(null), 4000);
            }
          })
          .catch(console.warn);
      }
    }
  }, [isOpen, currentUser, dailyChecklist]);

  if (!isOpen) return null;

  const pointsToday = dailyChecklist?.dailyPointsEarned || 0;
  const maxPointsToday = 2.2;
  const percentComplete = Math.min(100, Math.round((pointsToday / maxPointsToday) * 100));
  const monthlyTotal = monthlyLedger?.totalMonthlyPoints || pointsToday;

  const handleManualAction = async (action: 'login' | 'contribution' | 'rating') => {
    if (!currentUser) {
      setActionNotice('Faça login primeiro para pontuar no checklist.');
      return;
    }

    try {
      const res = await recordDailyChecklistAction(currentUser.id, currentUser.username, action, {
        articleSlug: 'MediaWiki',
      });
      setDailyChecklist(res.checklist);
      if (res.pointsAdded > 0) {
        setActionNotice(`Sucesso! +${res.pointsAdded.toFixed(2)} pontos adicionados ao seu total mensal!`);
        setTimeout(() => setActionNotice(null), 4000);
      } else {
        setActionNotice('Esta tarefa já foi concluída hoje!');
        setTimeout(() => setActionNotice(null), 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col font-sans">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-linear-to-r from-blue-600 via-indigo-600 to-purple-600 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-white/20 backdrop-blur-xs">
              <Award className="w-5 h-5 text-yellow-300" />
            </span>
            <div>
              <span className="text-[11px] font-mono tracking-wider uppercase font-semibold text-blue-100">
                Extensão 3.05.3.af • NotMediaWiki
              </span>
              <h2 className="text-xl font-bold tracking-tight">Checklist Diário & Pontos Mensais</h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-white/15 text-xs text-blue-100">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span className="capitalize">{dateFormatted}</span>
            </div>
            <div className="flex items-center gap-1.5 font-medium">
              <Flame className="w-4 h-4 text-amber-300 fill-amber-300" />
              <span>Sequência: <strong>{monthlyLedger?.streakDays || 1} dias</strong></span>
            </div>
          </div>
        </div>

        {/* Action Notice Banner */}
        {actionNotice && (
          <div className="bg-emerald-500 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-inner">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              {actionNotice}
            </span>
            <button onClick={() => setActionNotice(null)} className="cursor-pointer text-white/80 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
          <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Pontos Hoje (3.05.8.b)</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                {pointsToday.toFixed(2)}
              </span>
              <span className="text-xs text-slate-400 font-mono">/ 2.20</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden mt-2">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${percentComplete}%` }}
              />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Acumulado no Mês</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black text-amber-500">
                {monthlyTotal.toFixed(2)}
              </span>
              <span className="text-xs text-slate-400 font-mono">pts</span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mt-2 capitalize">
              Referência: {monthName}
            </span>
          </div>

          <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Dias Ativos no Mês</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {monthlyLedger?.totalDaysActive || 1}
              </span>
              <span className="text-xs text-slate-400 font-mono">dias</span>
            </div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block mt-2 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Sincronizado no Firestore
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-4 pt-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 gap-2">
          <button
            onClick={() => setActiveTab('checklist')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'checklist'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Missões Diárias</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
              3/3
            </span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Histórico do Mês</span>
          </button>

          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'leaderboard'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>Classificação Mensal</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeTab === 'checklist' && (
            <div className="space-y-3">
              {/* Task 1: 3.05.8.b.a - Login */}
              <div
                className={`p-4 rounded-xl border transition-all ${
                  dailyChecklist?.items.login.completed
                    ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60'
                    : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-lg mt-0.5 ${
                        dailyChecklist?.items.login.completed
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <LogIn className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          3.05.8.b.a
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          Fazer login no Wiki-Site
                        </h4>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Acesse a sua conta ou confirme presença para receber a pontuação diária de acesso.
                      </p>
                      {dailyChecklist?.items.login.completedAt && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block mt-1">
                          Concluído às {new Date(dailyChecklist.items.login.completedAt).toLocaleTimeString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      +1.00 pt
                    </span>
                    {dailyChecklist?.items.login.completed ? (
                      <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Concluído
                      </span>
                    ) : (
                      <button
                        onClick={() => handleManualAction('login')}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
                      >
                        Confirmar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Task 2: 3.05.8.b.b - Contribuição */}
              <div
                className={`p-4 rounded-xl border transition-all ${
                  dailyChecklist?.items.contribution.completed
                    ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60'
                    : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-lg mt-0.5 ${
                        dailyChecklist?.items.contribution.completed
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <Edit3 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          3.05.8.b.b
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          Fazer uma contribuição
                        </h4>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Crie um novo artigo, edite um artigo existente ou faça correções no Wikitext.
                      </p>
                      {dailyChecklist?.items.contribution.completedAt && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block mt-1">
                          Concluído às {new Date(dailyChecklist.items.contribution.completedAt).toLocaleTimeString('pt-BR')}
                          {dailyChecklist.items.contribution.lastArticleSlug && (
                            <> no artigo "{dailyChecklist.items.contribution.lastArticleSlug}"</>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                      +0.20 pt
                    </span>
                    {dailyChecklist?.items.contribution.completed ? (
                      <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Concluído
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {onNavigateToEditor && (
                          <button
                            onClick={() => {
                              onClose();
                              onNavigateToEditor();
                            }}
                            className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
                          >
                            Editar Artigo
                          </button>
                        )}
                        <button
                          onClick={() => handleManualAction('contribution')}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg cursor-pointer"
                          title="Registrar contribuição agora"
                        >
                          Concluir
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Task 3: 3.05.8.b.c - Avaliação */}
              <div
                className={`p-4 rounded-xl border transition-all ${
                  dailyChecklist?.items.rating.completed
                    ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60'
                    : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-lg mt-0.5 ${
                        dailyChecklist?.items.rating.completed
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <Star className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          3.05.8.b.c
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          Fazer avaliação de um artigo
                        </h4>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Submeta uma nota de 1 a 5 estrelas em qualquer artigo da enciclopédia para auditar a qualidade.
                      </p>
                      {dailyChecklist?.items.rating.completedAt && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block mt-1">
                          Concluído às {new Date(dailyChecklist.items.rating.completedAt).toLocaleTimeString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      +1.00 pt
                    </span>
                    {dailyChecklist?.items.rating.completed ? (
                      <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Concluído
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {onNavigateToArticle && (
                          <button
                            onClick={() => {
                              onClose();
                              onNavigateToArticle('MediaWiki');
                            }}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
                          >
                            Ir para Artigo
                          </button>
                        )}
                        <button
                          onClick={() => handleManualAction('rating')}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg cursor-pointer"
                          title="Avaliar agora"
                        >
                          Concluir
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Informative Rule Card */}
              <div className="bg-blue-50/70 dark:bg-slate-800/50 border border-blue-200 dark:border-blue-900/40 rounded-xl p-3 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Regulamento 3.05.8.b:</strong> As pontuações são renovadas diariamente à meia-noite e
                  armazenadas no livro contábil mensal do Firebase Firestore. O valor acumulado ao final do mês qualifica
                  o usuário para condecorações da comunidade e permissões ampliadas.
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
                <h4 className="font-bold text-slate-800 dark:text-slate-200">
                  Extrato de Pontuação Mensal • {monthName}
                </h4>
                <div className="grid grid-cols-3 gap-2 mt-2 font-mono text-[11px]">
                  <div>Login: <strong>{monthlyLedger?.loginPointsTotal || 0} pts</strong></div>
                  <div>Contribuições: <strong>{monthlyLedger?.contributionPointsTotal || 0} pts</strong></div>
                  <div>Avaliações: <strong>{monthlyLedger?.ratingPointsTotal || 0} pts</strong></div>
                </div>
              </div>

              {monthlyLedger?.history && monthlyLedger.history.length > 0 ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                  {monthlyLedger.history.slice().reverse().map((item, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {item.date}
                        </span>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {item.itemsCompleted.join(' · ')}
                        </div>
                      </div>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        +{item.points.toFixed(2)} pts
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-xs text-slate-400">
                  Nenhum registro no histórico deste mês ainda. Conclua as missões de hoje para começar!
                </div>
              )}
            </div>
          )}

          {activeTab === 'leaderboard' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span>Quadro de Honra Mensal • {monthName}</span>
                </h4>
                <span className="text-[10px] font-mono text-slate-400">
                  Atualizado em tempo real
                </span>
              </div>

              {leaderboard.length > 0 ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                  {leaderboard.map((userLedger, idx) => {
                    const isSelf = currentUser && userLedger.userId === currentUser.id;
                    return (
                      <div
                        key={userLedger.id}
                        className={`p-3 flex items-center justify-between text-xs ${
                          isSelf ? 'bg-indigo-50/70 dark:bg-indigo-950/40 font-semibold' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${
                              idx === 0
                                ? 'bg-amber-400 text-white'
                                : idx === 1
                                ? 'bg-slate-300 text-slate-700'
                                : idx === 2
                                ? 'bg-amber-700 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div>
                            <span className="text-slate-900 dark:text-slate-100">
                              {userLedger.username}
                              {isSelf && ' (Você)'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono block">
                              {userLedger.totalDaysActive} dias ativos • Seq: {userLedger.streakDays || 1}d
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-sm">
                            {userLedger.totalMonthlyPoints.toFixed(2)} pts
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-xs text-slate-400">
                  Carregando ranking do mês atual...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between text-xs">
          <div className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Extensão <strong>3.05.3.af</strong> ativa e sincronizada no Firebase Firestore.</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg cursor-pointer transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
