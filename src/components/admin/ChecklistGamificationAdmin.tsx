import React, { useState, useEffect } from 'react';
import {
  Award,
  CheckCircle2,
  Trophy,
  Calendar,
  Sparkles,
  Users,
  Flame,
  Shield,
  Layers,
  Settings,
  RefreshCw,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { UserSession, UserMonthlyPointsLedger } from '../../types';
import {
  getCurrentMonthString,
  getTodayDateString,
  fetchMonthlyLeaderboard,
  recordDailyChecklistAction,
} from '../../firebase';
import { dailyChecklistExtension } from '../../extensions/dailyChecklistExtension';

interface ChecklistGamificationAdminProps {
  currentUser: UserSession | null;
}

export const ChecklistGamificationAdmin: React.FC<ChecklistGamificationAdminProps> = ({
  currentUser,
}) => {
  const [leaderboard, setLeaderboard] = useState<UserMonthlyPointsLedger[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const monthStr = getCurrentMonthString();
  const todayStr = getTodayDateString();

  const loadLeaderboard = async () => {
    setIsLoading(true);
    try {
      const data = await fetchMonthlyLeaderboard(monthStr);
      setLeaderboard(data);
    } catch (e) {
      console.warn('Error fetching leaderboard:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, [monthStr]);

  const handleTestAward = async (action: 'login' | 'contribution' | 'rating') => {
    if (!currentUser) return;
    try {
      const res = await recordDailyChecklistAction(currentUser.id, currentUser.username, action, {
        articleSlug: 'MediaWiki',
      });
      setTestResult(
        `Disparo executado com sucesso: Tarefa "${action}" processada. Total diário: ${res.newTotalDaily} pts. Total mensal: ${res.newMonthlyTotal} pts.`
      );
      loadLeaderboard();
      setTimeout(() => setTestResult(null), 5000);
    } catch (e: any) {
      setTestResult(`Erro ao disparar: ${e.message}`);
    }
  };

  const totalPointsDistributed = leaderboard.reduce((acc, curr) => acc + curr.totalMonthlyPoints, 0);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 shadow-xs space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-amber-500 text-white shadow-xs">
              <Award className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Extensão 3.05.3.af • Checklist Diário & Gamificação (3.05.8.b)
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-800">
                  Ativo no Firestore
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Monitoramento dos pontos diários acumulados pelos usuários ao longo do mês (Login, Edição, Avaliação).
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={loadLeaderboard}
          disabled={isLoading}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Atualizar Dados</span>
        </button>
      </div>

      {testResult && (
        <div className="bg-indigo-50 border border-indigo-200 dark:bg-indigo-950/60 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 p-3 rounded-lg text-xs font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>{testResult}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total de Usuários Pontuando</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{leaderboard.length}</span>
            <span className="text-xs text-slate-400 font-mono">editores</span>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Pontos Concedidos no Mês</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-amber-500">{totalPointsDistributed.toFixed(2)}</span>
            <span className="text-xs text-slate-400 font-mono">pts</span>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Regras em Vigor (3.05.8.b)</span>
          <div className="mt-1 text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
            Login: 1pt · Edição: 0.20pt · Avaliação: 1pt
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Mês de Referência</span>
          <div className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-200 font-mono">
            {monthStr} ({todayStr})
          </div>
        </div>
      </div>

      {/* Rules & Configuration Breakdown */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
        <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
          <Settings className="w-4 h-4 text-slate-500" />
          <span>Configuração da Extensão (Special:Version / dailyChecklistExtension.ts)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">3.05.8.b.a Login</span>
              <span className="text-xs font-mono font-black text-blue-600 dark:text-blue-400">1.00 pt</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Concedido automaticamente no login diário do usuário.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">3.05.8.b.b Contribuição</span>
              <span className="text-xs font-mono font-black text-purple-600 dark:text-purple-400">0.20 pt</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Concedido na primeira edição ou publicação de artigo no dia.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">3.05.8.b.c Avaliação</span>
              <span className="text-xs font-mono font-black text-amber-600 dark:text-amber-400">1.00 pt</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Concedido na submissão de avaliação de qualidade de um artigo.
            </p>
          </div>
        </div>

        {/* Admin test sandbox actions */}
        <div className="pt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Testar Disparo para Conta Atual:</span>
          <button
            onClick={() => handleTestAward('login')}
            className="px-2.5 py-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-950 dark:hover:bg-blue-900 text-blue-800 dark:text-blue-300 rounded text-[11px] font-bold cursor-pointer"
          >
            +1.00 pt Login
          </button>
          <button
            onClick={() => handleTestAward('contribution')}
            className="px-2.5 py-1 bg-purple-100 hover:bg-purple-200 dark:bg-purple-950 dark:hover:bg-purple-900 text-purple-800 dark:text-purple-300 rounded text-[11px] font-bold cursor-pointer"
          >
            +0.20 pt Contribuição
          </button>
          <button
            onClick={() => handleTestAward('rating')}
            className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 dark:bg-amber-950 dark:hover:bg-amber-900 text-amber-800 dark:text-amber-300 rounded text-[11px] font-bold cursor-pointer"
          >
            +1.00 pt Avaliação
          </button>
        </div>
      </div>

      {/* Community Monthly Leaderboard */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>Quadro Geral de Classificação do Mês ({monthStr})</span>
          </h3>
          <span className="text-[11px] text-slate-400 font-mono">
            Total registrado: {leaderboard.length} editores
          </span>
        </div>

        {leaderboard.length > 0 ? (
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
            {leaderboard.map((item, index) => (
              <div
                key={item.id}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                      index === 0
                        ? 'bg-amber-400 text-white shadow-xs'
                        : index === 1
                        ? 'bg-slate-300 text-slate-800'
                        : index === 2
                        ? 'bg-amber-700 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {item.username}
                    </span>
                    <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                      <span>Dias Ativos: <strong>{item.totalDaysActive}</strong></span>
                      <span>·</span>
                      <span>Sequência: <strong>{item.streakDays || 1}d</strong></span>
                      <span>·</span>
                      <span>Último: {item.lastActiveDate}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 self-end sm:self-auto font-mono text-xs">
                  <div className="text-right hidden md:block text-[11px] text-slate-400">
                    <span>L: {item.loginPointsTotal || 0}pt · </span>
                    <span>C: {item.contributionPointsTotal || 0}pt · </span>
                    <span>A: {item.ratingPointsTotal || 0}pt</span>
                  </div>
                  <div className="px-3 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-400 font-extrabold text-sm">
                    {item.totalMonthlyPoints.toFixed(2)} pts
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-400">
            Nenhum ponto registrado ainda no mês atual. Os dados aparecem automaticamente conforme os usuários fazem login, editam ou avaliam artigos.
          </div>
        )}
      </div>
    </div>
  );
};
