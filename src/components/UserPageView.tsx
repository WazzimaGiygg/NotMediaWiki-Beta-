import React, { useState, useEffect } from 'react';
import {
  User,
  Shield,
  Award,
  Calendar,
  MessageSquare,
  Edit3,
  Save,
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle,
  Hash,
  Send,
  ArrowLeft,
  Sparkles,
  Zap,
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react';
import { UserPage, UserSession, UserPageTalkPost, UserBoxItem, UserDailyChecklist, UserMonthlyPointsLedger, UserKarmaProfile } from '../types';
import { api } from '../api';
import {
  fetchUserPageFromFirestore,
  ensureUserPageInFirestore,
  saveUserPageToFirestore,
  subscribeToUserPage,
  addUserPageTalkPost,
  fetchDailyChecklistFromFirestore,
  fetchMonthlyPointsFromFirestore,
  subscribeToDailyChecklist,
  subscribeToMonthlyPoints,
  getTodayDateString,
  getCurrentMonthString,
} from '../firebase';

interface UserPageViewProps {
  targetUser: UserSession;
  currentUser: UserSession | null;
  onBack: () => void;
  onStartChat: (targetUser: UserSession) => void;
}

export const UserPageView: React.FC<UserPageViewProps> = ({
  targetUser,
  currentUser,
  onBack,
  onStartChat,
}) => {
  const [userPage, setUserPage] = useState<UserPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pagina' | 'userboxes' | 'discussao' | 'checklist' | 'karma'>('pagina');
  const [dailyChecklist, setDailyChecklist] = useState<UserDailyChecklist | null>(null);
  const [monthlyLedger, setMonthlyLedger] = useState<UserMonthlyPointsLedger | null>(null);
  const [karmaProfile, setKarmaProfile] = useState<UserKarmaProfile | null>(null);

  // Edit Mode
  const [isEditing, setIsEditing] = useState(false);
  const [editedWikitext, setEditedWikitext] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Talk Page Message State
  const [newTalkText, setNewTalkText] = useState('');
  const [isSendingTalk, setIsSendingTalk] = useState(false);

  const isOwner = currentUser?.id === targetUser.id;
  const isBureaucrat = currentUser?.role === 'bureaucrat';
  const canEdit = isOwner || isBureaucrat;

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    // 1. Ensure user page is created if not present
    ensureUserPageInFirestore(targetUser)
      .then(({ userPage: page }) => {
        if (!isMounted) return;
        setUserPage(page);
        setEditedWikitext(page.wikitext);
        setIsLoading(false);
      })
      .catch(err => {
        console.warn('Notice: Error loading or ensuring user page in Firestore:', err);
        // Fallback fetch
        fetchUserPageFromFirestore(targetUser.id).then(fallbackPage => {
          if (!isMounted) return;
          if (fallbackPage) {
            setUserPage(fallbackPage);
            setEditedWikitext(fallbackPage.wikitext);
          }
          setIsLoading(false);
        });
      });

    // 2. Real-time subscription to User Page
    const unsubscribe = subscribeToUserPage(targetUser.id, updated => {
      if (isMounted && updated) {
        setUserPage(updated);
        if (!isEditing) {
          setEditedWikitext(updated.wikitext);
        }
      }
    });

    // 3. Real-time subscription to Daily Checklist & Monthly Ledger
    const todayStr = getTodayDateString();
    const monthStr = getCurrentMonthString();

    fetchDailyChecklistFromFirestore(targetUser.id, todayStr)
      .then(res => {
        if (isMounted && res) setDailyChecklist(res);
      })
      .catch(console.warn);

    fetchMonthlyPointsFromFirestore(targetUser.id, monthStr)
      .then(res => {
        if (isMounted && res) setMonthlyLedger(res);
      })
      .catch(console.warn);

    const unsubChecklist = subscribeToDailyChecklist(targetUser.id, updated => {
      if (isMounted && updated) setDailyChecklist(updated);
    }, todayStr);

    const unsubMonthly = subscribeToMonthlyPoints(targetUser.id, updated => {
      if (isMounted && updated) setMonthlyLedger(updated);
    }, monthStr);

    // 4. Real-time subscription to User Karma and Article Vote reputation
    const unsubKarma = api.subscribeUserKarma(targetUser.id, (profile: UserKarmaProfile) => {
      if (isMounted && profile) setKarmaProfile(profile);
    });

    return () => {
      isMounted = false;
      unsubscribe();
      unsubChecklist();
      unsubMonthly();
      unsubKarma();
    };
  }, [targetUser.id, targetUser.username]);

  const handleSavePage = async () => {
    if (!userPage) return;
    setIsSaving(true);
    try {
      const updated: UserPage = {
        ...userPage,
        wikitext: editedWikitext,
        updatedAt: new Date().toISOString(),
      };
      await saveUserPageToFirestore(updated);
      setUserPage(updated);
      setIsEditing(false);
    } catch (err: any) {
      alert(`Falha ao salvar página de usuário: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTalkMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPage || !newTalkText.trim() || !currentUser) return;

    setIsSendingTalk(true);
    const post: UserPageTalkPost = {
      id: `talk-${Date.now()}`,
      authorId: currentUser.id,
      authorUsername: currentUser.username,
      authorTag: currentUser.userTag || '',
      authorAvatar: currentUser.avatar,
      authorRole: currentUser.role,
      text: newTalkText.trim(),
      timestamp: new Date().toISOString(),
    };

    try {
      await addUserPageTalkPost(userPage.id, post);
      setUserPage(prev => (prev ? { ...prev, talkPosts: [...(prev.talkPosts || []), post] } : null));
      setNewTalkText('');
    } catch (err: any) {
      alert(`Erro ao postar na discussão do usuário: ${err.message}`);
    } finally {
      setIsSendingTalk(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'bureaucrat':
        return { label: 'Burocrata Oficial', color: 'bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300' };
      case 'sysop':
        return { label: 'Administrador', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300' };
      case 'moderator':
        return { label: 'Moderador', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300' };
      default:
        return { label: 'Editor Comunitário', color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300' };
    }
  };

  const roleInfo = getRoleBadge(targetUser.role);
  const tagDisplay = targetUser.userTag || userPage?.userTag || '#1100';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Navigation & Header Breadcrumb */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Leitor</span>
        </button>

        <div className="flex items-center gap-2">
          {!isOwner && (
            <button
              onClick={() => onStartChat(targetUser)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Iniciar Chat em Tempo Real</span>
            </button>
          )}

          {canEdit && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editar Minha Página</span>
            </button>
          )}

          {isEditing && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePage}
                disabled={isSaving}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Salvando...' : 'Salvar no Firestore'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* User Page Profile Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-600 to-pink-500 text-white font-bold text-xl flex items-center justify-center shrink-0 shadow-md">
              {targetUser.avatar || targetUser.username.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  {targetUser.username}
                </h1>
                <span className="font-mono text-purple-600 dark:text-purple-400 text-base font-bold bg-purple-50 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800 px-2 py-0.5 rounded">
                  {tagDisplay}
                </span>
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${roleInfo.color}`}>
                  {roleInfo.label}
                </span>
              </div>
              <div className="font-mono text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                <span>Página Oficial: <strong>{userPage?.slug || `Usuário:${targetUser.username}${tagDisplay}`}</strong></span>
                <span>•</span>
                <span>{targetUser.email || 'Conta Autenticada'}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-col sm:items-end gap-2 text-xs text-slate-500 dark:text-slate-400">
            {/* Karma Badge & Rank (User Karma System) */}
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-900 dark:text-amber-200 shadow-2xs">
              <Zap className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-sm font-extrabold text-amber-700 dark:text-amber-300">
                  {karmaProfile?.karma ?? targetUser.karma ?? 10}
                </span>
                <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-400">Karma</span>
              </div>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200">
                {karmaProfile?.rankTitle || 'Editor Novato'}
              </span>
            </div>

            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium" title="Votos positivos recebidos em artigos">
                <ThumbsUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <strong>{karmaProfile?.positiveVotesReceived ?? targetUser.positiveVotesReceived ?? 0}</strong> curtidas
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                <Award className="w-3.5 h-3.5 text-indigo-500" />
                <strong className="font-mono">{targetUser.editCount || 0}</strong> edições
              </span>
            </div>

            <div className="text-[10px] text-slate-400 font-mono">
              Taxa de Aprovação: {karmaProfile?.approvalRate ?? 100}%
            </div>
          </div>
        </div>

        {/* Discriminator Tag Explanation Banner */}
        <div className="p-3 bg-purple-50/60 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 rounded-md text-xs text-purple-900 dark:text-purple-300 flex items-start gap-2">
          <Hash className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
          <div>
            <strong>Identificador Exclusivo ({tagDisplay}):</strong> Esta tag é associada à conta do usuário para
            diferenciar homônimos e garantir que nunca haja duplicidade de páginas de usuário com o mesmo nickname na
            enciclopédia.
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pt-2 flex-wrap">
          <button
            onClick={() => setActiveTab('pagina')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'pagina'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Página de Usuário (Wikitext)
          </button>
          <button
            onClick={() => setActiveTab('karma')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'karma'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span>Karma & Reputação</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold">
              {karmaProfile?.karma ?? targetUser.karma ?? 10} pts
            </span>
          </button>
          <button
            onClick={() => setActiveTab('userboxes')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'userboxes'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Userboxes & Condecorações ({userPage?.userboxes?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('discussao')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'discussao'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Página de Discussão ({userPage?.talkPosts?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('checklist')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'checklist'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Award className="w-3.5 h-3.5 text-amber-500" />
            <span>Checklist & Pontos (3.05.8.b)</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold">
              {(monthlyLedger?.totalMonthlyPoints || 0).toFixed(2)} pts
            </span>
          </button>
        </div>

        {/* Tab 1: Wikitext Body */}
        {activeTab === 'pagina' && (
          <div className="space-y-4 pt-2">
            {isEditing ? (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Edição do Wikitext da Página de Usuário ({userPage?.slug})
                </label>
                <textarea
                  rows={14}
                  value={editedWikitext}
                  onChange={e => setEditedWikitext(e.target.value)}
                  className="w-full p-3 font-mono text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed"
                />
                <p className="text-[11px] text-slate-400">
                  Dica: Utilize formatação MediaWiki clássica como == Seções ==, '''negrito''', [[Links Internos]] e
                  listas numeradas.
                </p>
              </div>
            ) : (
              <div className="prose dark:prose-invert max-w-none text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line bg-slate-50/50 dark:bg-slate-800/30 p-5 rounded-lg border border-slate-100 dark:border-slate-800">
                {userPage?.wikitext || 'Página de usuário em criação...'}
              </div>
            )}
          </div>
        )}

        {/* Tab: Karma & Reputação Enciclopédica */}
        {activeTab === 'karma' && (
          <div className="space-y-6 pt-2">
            {/* Karma Overview Header */}
            <div className="p-5 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-purple-500/10 border border-amber-300/40 dark:border-amber-700/40">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-300/60 dark:border-amber-600/60 shadow-xs">
                    <Zap className="w-6 h-6 fill-amber-500 text-amber-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {karmaProfile?.rankTitle || 'Editor Novato'}
                      </h3>
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                        Nível {karmaProfile?.badgeLevel || 1}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Índice de confiabilidade e pontuação acumulada por avaliações positivas de artigos editados por {targetUser.username}.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start md:self-auto">
                  <div className="px-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/80 shadow-xs text-right">
                    <span className="block text-[10px] uppercase font-mono tracking-wider text-slate-400">Total Karma</span>
                    <span className="font-mono text-xl font-black text-amber-600 dark:text-amber-400">
                      {karmaProfile?.karma ?? targetUser.karma ?? 10} <span className="text-xs font-normal text-slate-400">pts</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress to next rank */}
              {(() => {
                const currentKarma = karmaProfile?.karma ?? targetUser.karma ?? 10;
                const nextThreshold = karmaProfile?.nextRankKarma;
                const pointsNeeded = nextThreshold ? Math.max(0, nextThreshold - currentKarma) : 0;
                const nextRankName =
                  currentKarma < 30
                    ? 'Colaborador Confiável (30 pts)'
                    : currentKarma < 100
                    ? 'Editor Destaque (100 pts)'
                    : currentKarma < 250
                    ? 'Guardião do Conhecimento (250 pts)'
                    : currentKarma < 500
                    ? 'Curador da Enciclopédia (500 pts)'
                    : currentKarma < 1000
                    ? 'Mestre Wikimediano (1000 pts)'
                    : 'Ranque Máximo Atingido';

                return (
                  <div className="mt-4 pt-4 border-t border-amber-200/50 dark:border-amber-800/50 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-300 font-medium">
                        Progresso para o próximo ranque:{' '}
                        <strong>{nextRankName}</strong>
                      </span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                        {currentKarma} / {nextThreshold || currentKarma} pts ({karmaProfile?.progressToNextRank ?? 100}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200/80 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-amber-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${karmaProfile?.progressToNextRank ?? 100}%` }}
                      />
                    </div>
                    {pointsNeeded > 0 ? (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Faltam <strong>{pointsNeeded} pontos</strong> para subir de ranque ({Math.ceil(pointsNeeded / 10)} curtidas em artigos ou {Math.ceil(pointsNeeded / 5)} edições).
                      </p>
                    ) : (
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                        Parabéns! Nível máximo de prestígio e autoridade na enciclopédia atingido.
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* 4 Metric Breakdown Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[11px] font-medium uppercase tracking-wider">Pontuação Total</span>
                  <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                </div>
                <div className="font-mono text-2xl font-black text-slate-900 dark:text-slate-100">
                  {karmaProfile?.karma ?? targetUser.karma ?? 10}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Total de pontos de reputação ativa
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[11px] font-medium uppercase tracking-wider">Votos Positivos</span>
                  <ThumbsUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {karmaProfile?.positiveVotesReceived ?? targetUser.positiveVotesReceived ?? 0}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  +{(karmaProfile?.positiveVotesReceived ?? 0) * 10} Karma (+10 pts por curtida)
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[11px] font-medium uppercase tracking-wider">Edições Públicas</span>
                  <Award className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="font-mono text-2xl font-black text-indigo-600 dark:text-indigo-400">
                  {targetUser.editCount || 0}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  +{(targetUser.editCount || 0) * 5} Karma (+5 pts por edição)
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[11px] font-medium uppercase tracking-wider">Aprovação</span>
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                </div>
                <div className="font-mono text-2xl font-black text-blue-600 dark:text-blue-400">
                  {karmaProfile?.approvalRate ?? 100}%
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Feedback favorável da comunidade
                </p>
              </div>
            </div>

            {/* Ranques Oficiais da Enciclopédia */}
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs space-y-3">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                Escala de Ranques e Hierarquia de Karma
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                O Karma reflete a qualidade dos artigos e revisões feitas pelo usuário, sendo validado diretamente por leitores e outros editores.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
                {[
                  { rank: 'Editor Novato', range: '0 - 29 pts', desc: 'Início da jornada na enciclopédia' },
                  { rank: 'Colaborador Confiável', range: '30 - 99 pts', desc: 'Edições consistentes e aprovadas' },
                  { rank: 'Editor Destaque', range: '100 - 249 pts', desc: 'Reconhecimento comunitário comprovado' },
                  { rank: 'Guardião do Conhecimento', range: '250 - 499 pts', desc: 'Alto padrão de qualidade e fontes' },
                  { rank: 'Curador da Enciclopédia', range: '500 - 999 pts', desc: 'Referência editorial e revisor sênior' },
                  { rank: 'Mestre Wikimediano', range: '1000+ pts', desc: 'Lenda enciclopédica e autoridade máxima' },
                ].map((item, idx) => {
                  const isCurrent = karmaProfile?.rankTitle === item.rank;
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border text-xs transition-all ${
                        isCurrent
                          ? 'border-amber-400 bg-amber-50/70 dark:bg-amber-950/40 shadow-xs ring-1 ring-amber-400'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-bold ${isCurrent ? 'text-amber-900 dark:text-amber-200' : 'text-slate-900 dark:text-slate-100'}`}>
                          {item.rank}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-500 text-white rounded-full">
                            Atual
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[11px] text-amber-700 dark:text-amber-400 font-bold block mb-1">
                        {item.range}
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {item.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Como funciona o sistema de Karma e Votação */}
            <div className="p-4 bg-slate-50 dark:bg-slate-850/50 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Regras de Concessão de Karma no Firestore
              </h4>
              <ul className="space-y-1.5 text-slate-600 dark:text-slate-300 text-[11px] list-disc list-inside">
                <li><strong>+10 pontos de Karma</strong> para o autor/editor por cada voto positivo (👍 Curtir) recebido de leitores em seus artigos.</li>
                <li><strong>+5 pontos de Karma</strong> por cada edição enciclopédica publicada e registrada no histórico de versões.</li>
                <li><strong>Proteção anti-autovoto:</strong> Usuários podem avaliar artigos, mas autovotos não concedem pontos de Karma à própria conta.</li>
                <li><strong>Sincronização em tempo real:</strong> Votos e Karma são calculados e persistidos na coleção <code className="font-mono text-[10px] bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">article_votes</code> e no perfil de usuário.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Tab 2: Userboxes */}
        {activeTab === 'userboxes' && (
          <div className="space-y-4 pt-2">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
              Userboxes de {targetUser.username}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {(userPage?.userboxes || []).map((ub, idx) => (
                <div
                  key={idx}
                  className="border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden flex items-stretch shadow-2xs text-xs"
                >
                  <div
                    className={`w-14 font-black font-mono flex items-center justify-center shrink-0 ${ub.bgClass} ${ub.textClass}`}
                  >
                    {ub.label}
                  </div>
                  <div className="p-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex-1 flex items-center">
                    {ub.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Talk Page */}
        {activeTab === 'discussao' && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                Discussão de Usuário ({userPage?.slug?.replace('Usuário:', 'Discussão_Usuário:')})
              </h3>
              <span className="text-[11px] text-slate-400">Comentários registrados e assinados</span>
            </div>

            {/* Posts List */}
            <div className="space-y-3">
              {(!userPage?.talkPosts || userPage.talkPosts.length === 0) ? (
                <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-800 rounded-lg">
                  Nenhuma mensagem registrada nesta página de discussão ainda.
                </div>
              ) : (
                userPage.talkPosts.map(post => (
                  <div
                    key={post.id}
                    className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 dark:text-slate-100">{post.authorUsername}</span>
                        {post.authorTag && (
                          <span className="font-mono text-purple-600 dark:text-purple-400 text-[11px] font-semibold">
                            {post.authorTag}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 uppercase">({post.authorRole || 'editor'})</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {new Date(post.timestamp).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{post.text}</p>
                  </div>
                ))
              )}
            </div>

            {/* Leave a message form */}
            {currentUser ? (
              <form onSubmit={handleSendTalkMessage} className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Deixar uma mensagem pública para {targetUser.username}:
                </label>
                <div className="flex gap-2">
                  <textarea
                    rows={3}
                    required
                    placeholder="Escreva sua mensagem comunitária com cordialidade..."
                    value={newTalkText}
                    onChange={e => setNewTalkText(e.target.value)}
                    className="flex-1 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={isSendingTalk || !newTalkText.trim()}
                    className="px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 self-end py-2.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSendingTalk ? 'Enviando...' : 'Postar'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded text-xs text-amber-800 dark:text-amber-300">
                Faça login para assinar e postar na discussão deste usuário.
              </div>
            )}
          </div>
        )}

        {/* Tab 4: 3.05.3.af & 3.05.8.b - Checklist Diário & Pontos Mensais */}
        {activeTab === 'checklist' && (
          <div className="space-y-4 pt-2">
            {/* Top Score Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Pontos Hoje</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                    {(dailyChecklist?.dailyPointsEarned || 0).toFixed(2)}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">/ 2.20</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden mt-2">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(((dailyChecklist?.dailyPointsEarned || 0) / 2.2) * 100)
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Acumulado no Mês (3.05.8.b)</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black text-amber-500">
                    {(monthlyLedger?.totalMonthlyPoints || 0).toFixed(2)}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">pts</span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-2">
                  Contabilizado no Firestore
                </span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Dias Ativos / Sequência</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {monthlyLedger?.totalDaysActive || (dailyChecklist?.dailyPointsEarned ? 1 : 0)}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">dias</span>
                </div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mt-2 font-medium">
                  Seq: {monthlyLedger?.streakDays || 1} dias consecutivos
                </span>
              </div>
            </div>

            {/* Checklist Tasks Grid */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Status das Metas do Dia (Extensão 3.05.3.af)
              </h4>

              {/* 3.05.8.b.a Login */}
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      dailyChecklist?.items.login.completed
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                    }`}
                  >
                    ✓
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                        3.05.8.b.a
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Fazer login no Wiki-Site
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Presença diária confirmada na enciclopédia
                    </span>
                  </div>
                </div>
                <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                  +1.00 pt
                </span>
              </div>

              {/* 3.05.8.b.b Contribution */}
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      dailyChecklist?.items.contribution.completed
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                    }`}
                  >
                    ✓
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                        3.05.8.b.b
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Fazer uma contribuição
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Edição, revisão ou publicação de novo conteúdo
                    </span>
                  </div>
                </div>
                <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300">
                  +0.20 pt
                </span>
              </div>

              {/* 3.05.8.b.c Rating */}
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      dailyChecklist?.items.rating.completed
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                    }`}
                  >
                    ✓
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                        3.05.8.b.c
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Fazer avaliação de um artigo
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Auditoria de qualidade com nota de 1 a 5 estrelas
                    </span>
                  </div>
                </div>
                <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                  +1.00 pt
                </span>
              </div>
            </div>

            {/* Monthly Points Ledger Breakdown */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2">
                Livro Contábil de Gamificação do Usuário
              </h4>
              <div className="grid grid-cols-3 gap-3 font-mono text-[11px]">
                <div className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Logins (1 pt):</span>
                  <strong>{monthlyLedger?.loginPointsTotal || 0} pts</strong>
                </div>
                <div className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Edições (0.20 pt):</span>
                  <strong>{monthlyLedger?.contributionPointsTotal || 0} pts</strong>
                </div>
                <div className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Avaliações (1 pt):</span>
                  <strong>{monthlyLedger?.ratingPointsTotal || 0} pts</strong>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
