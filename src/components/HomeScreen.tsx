import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  BookOpen,
  Edit3,
  Users,
  Clock,
  Shield,
  Eye,
  Plus,
  Code2,
  Check,
  RotateCcw,
  Save,
  X,
  ExternalLink,
  MessageSquare,
  TrendingUp,
  FileText,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { Article, UserSession, HomePageMetadata } from '../types';
import { api } from '../api';
import { wrapExternalUrl } from '../utils/urlHelper';
import {
  fetchHomePageMetadata,
  saveHomePageMetadata,
  subscribeToHomePageMetadata,
  DEFAULT_HOMEPAGE_HTML,
  fetchArticlesFromFirestore,
  subscribeToFirestoreArticles,
  syncArticlesAndEditorsToFirebase,
} from '../firebase';

interface HomeScreenProps {
  currentUser: UserSession | null;
  onNavigateArticle: (slug: string) => void;
  onEditArticle: (slug: string) => void;
  onOpenNewArticle: () => void;
  onSwitchUser?: (userId: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  currentUser,
  onNavigateArticle,
  onEditArticle,
  onOpenNewArticle,
  onSwitchUser,
}) => {
  const [homeMeta, setHomeMeta] = useState<HomePageMetadata>({
    id: 'home_page',
    htmlContent: DEFAULT_HOMEPAGE_HTML,
    title: 'Portal da Comunidade NotMediaWiki',
    updatedBy: 'NodeArchitect (Burocrata)',
    updatedByRole: 'bureaucrat',
    updatedAt: new Date().toISOString(),
  });
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Bureaucrat HTML Editor Modal state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingHtml, setEditingHtml] = useState('');
  const [editingTitle, setEditingTitle] = useState('');
  const [savingHtml, setSavingHtml] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeEditorTab, setActiveEditorTab] = useState<'code' | 'preview' | 'split'>('split');

  // Check if current user has bureaucrat rights
  const isBureaucrat = currentUser?.role === 'bureaucrat' || currentUser?.role === 'sysop';

  // 1. Subscribe to Home Page HTML from Firestore
  useEffect(() => {
    fetchHomePageMetadata().then(meta => {
      setHomeMeta(meta);
      setEditingHtml(meta.htmlContent);
      setEditingTitle(meta.title || 'Portal da Comunidade NotMediaWiki');
      setLoading(false);
    });

    const unsubscribeMeta = subscribeToHomePageMetadata(
      updatedMeta => {
        setHomeMeta(updatedMeta);
        if (!isEditorOpen) {
          setEditingHtml(updatedMeta.htmlContent);
          setEditingTitle(updatedMeta.title || 'Portal da Comunidade NotMediaWiki');
        }
      },
      err => {
        console.warn('Real-time home page metadata notice:', err);
      }
    );

    return () => {
      unsubscribeMeta();
    };
  }, [isEditorOpen]);

  // 2. Fetch and subscribe strictly to recent articles from Firestore in real-time
  useEffect(() => {
    fetchArticlesFromFirestore()
      .then(arts => {
        const sorted = [...arts].sort(
          (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
        );
        setArticles(sorted);
      })
      .catch(console.error);

    const unsubscribeArticles = subscribeToFirestoreArticles(
      liveArts => {
        const sorted = [...liveArts].sort(
          (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
        );
        setArticles(sorted);
      },
      err => {
        console.warn('Real-time articles notice:', err);
      }
    );

    return () => {
      unsubscribeArticles();
    };
  }, []);

  // 3. Initial check: If Firestore has never been populated, bootstrap once
  useEffect(() => {
    fetchArticlesFromFirestore().then(async existing => {
      if (!existing || existing.length === 0) {
        try {
          await syncArticlesAndEditorsToFirebase('AutoBootstrap');
          const freshArticles = await fetchArticlesFromFirestore();
          setArticles(
            [...freshArticles].sort(
              (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
            )
          );
        } catch (e) {
          console.warn('Initial bootstrap sync notice:', e);
        }
      }
    });
  }, []);

  // Manual Firebase synchronization handler
  const handleSyncWithFirebase = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await syncArticlesAndEditorsToFirebase(currentUser?.username || 'Burocrata');
      const freshArticles = await fetchArticlesFromFirestore();
      setArticles(
        [...freshArticles].sort(
          (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
        )
      );
      setSyncFeedback(
        `Sincronização concluída com o Firebase! ${res.articles} artigos sincronizados no Cloud Firestore.`
      );
      setTimeout(() => setSyncFeedback(null), 6000);
    } catch (err: any) {
      console.error('Error synchronizing with Firebase:', err);
      setSyncFeedback('Erro ao sincronizar com o Firebase: ' + (err.message || 'Falha de comunicação'));
      setTimeout(() => setSyncFeedback(null), 6000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle open HTML editor for bureaucrat
  const handleOpenHtmlEditor = () => {
    setEditingHtml(homeMeta.htmlContent);
    setEditingTitle(homeMeta.title || 'Portal da Comunidade NotMediaWiki');
    setSaveSuccess(false);
    setIsEditorOpen(true);
  };

  // Handle save HTML to Firestore
  const handleSaveHtml = async () => {
    if (!isBureaucrat) return;
    setSavingHtml(true);
    setSaveSuccess(false);

    try {
      const saved = await saveHomePageMetadata({
        htmlContent: editingHtml,
        title: editingTitle,
        updatedBy: currentUser?.username || 'Burocrata do Sistema',
        updatedByRole: currentUser?.role || 'bureaucrat',
      });
      setHomeMeta(saved);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setIsEditorOpen(false);
      }, 1200);
    } catch (err) {
      console.error('Failed to save home HTML:', err);
      alert('Falha ao salvar a página inicial no Firebase Firestore. Verifique as permissões.');
    } finally {
      setSavingHtml(false);
    }
  };

  // Preset HTML Templates for the Bureaucrat
  const applyTemplate = (templateName: string) => {
    if (templateName === 'default') {
      setEditingHtml(DEFAULT_HOMEPAGE_HTML);
      setEditingTitle('Portal da Comunidade NotMediaWiki');
    } else if (templateName === 'announcements') {
      setEditingHtml(`<div class="space-y-6">
  <div class="bg-amber-500 text-slate-900 rounded-xl p-8 shadow-md">
    <span class="px-2.5 py-1 bg-black/10 rounded text-xs font-bold uppercase tracking-wider">Aviso da Burocracia</span>
    <h1 class="text-3xl font-serif font-black mt-2 mb-2">Quadro de Avisos & Destaques Oficiais</h1>
    <p class="text-sm font-medium">Comunicações oficiais do comitê editorial e diretrizes para colaboradores ativos.</p>
  </div>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div class="border border-slate-200 bg-white rounded-lg p-5">
      <h3 class="font-bold text-slate-900 mb-2">📢 Mutirão de Revisão de Artigos</h3>
      <p class="text-xs text-slate-600 mb-3">Convidamos todos os editores para o mutirão de padronização das referências bibliográficas.</p>
      <a href="#/wiki/MediaWiki" class="text-xs font-semibold text-blue-600 hover:underline">Ver Artigos Prioritários →</a>
    </div>
    <div class="border border-slate-200 bg-white rounded-lg p-5">
      <h3 class="font-bold text-slate-900 mb-2">⚖️ Novas Diretrizes de Consenso</h3>
      <p class="text-xs text-slate-600 mb-3">As propostas de fusão de páginas agora requerem votação mínima de 7 dias úteis.</p>
      <a href="#/wiki/Talk:MediaWiki" class="text-xs font-semibold text-blue-600 hover:underline">Debater na Página de Discussão →</a>
    </div>
  </div>
</div>`);
      setEditingTitle('Quadro de Avisos & Destaques Oficiais');
    } else if (templateName === 'academic') {
      setEditingHtml(`<div class="space-y-6">
  <div class="bg-slate-900 text-white rounded-xl p-8 border border-slate-800">
    <span class="px-2.5 py-1 bg-blue-500/20 text-blue-300 rounded text-xs font-bold uppercase">Repositório Técnico</span>
    <h1 class="text-3xl font-serif font-bold mt-2 mb-2">Portal de Arquitetura e Engenharia de Software</h1>
    <p class="text-sm text-slate-300">Base de conhecimento sobre microsserviços Node.js, compilação AST e sistemas distribuídos.</p>
  </div>
  <div class="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
    <h3 class="font-bold text-slate-900 border-b border-slate-100 pb-2">Trilhas de Estudo Recomendadas</h3>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
      <div class="p-3 bg-slate-50 rounded border border-slate-200">
        <strong class="block text-slate-900 mb-1">1. Compilador Parsoid</strong>
        <p class="text-slate-600">Gramáticas de Wikitext, AST bidirecional e HTML5 semântico.</p>
      </div>
      <div class="p-3 bg-slate-50 rounded border border-slate-200">
        <strong class="block text-slate-900 mb-1">2. EventStreams & SSE</strong>
        <p class="text-slate-600">Streaming de eventos de edição em tempo real com barramentos desacoplados.</p>
      </div>
      <div class="p-3 bg-slate-50 rounded border border-slate-200">
        <strong class="block text-slate-900 mb-1">3. Criptografia & Ledger</strong>
        <p class="text-slate-600">Verificação criptográfica SHA-256 e auditoria distribuída.</p>
      </div>
    </div>
  </div>
</div>`);
      setEditingTitle('Portal de Arquitetura e Engenharia de Software');
    }
  };

  // Helper to insert snippet into textarea
  const insertSnippet = (snippet: string) => {
    setEditingHtml(prev => prev + '\n' + snippet);
  };

  // Format relative date
  const formatTimeAgo = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
      if (diffSec < 60) return 'agora há pouco';
      if (diffSec < 3600) return `há ${Math.floor(diffSec / 60)} min`;
      if (diffSec < 86400) return `há ${Math.floor(diffSec / 3600)} h`;
      const diffDays = Math.floor(diffSec / 86400);
      if (diffDays === 1) return 'ontem';
      if (diffDays < 30) return `há ${diffDays} dias`;
      return date.toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8 font-sans">
      {/* Top Banner / Ticker */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
              NotMediaWiki • Desenvolvimento de Projetos
            </span>
            <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-[11px] font-medium">
              WazzimaGiygg
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-black text-slate-900 tracking-tight">
            NotMediaWiki — Enciclopédia Colaborativa
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
            Este site faz parte do desenvolvimento de projetos <strong className="text-slate-800">WazzimaGiygg</strong>, do site{' '}
            <a
              href={wrapExternalUrl("https://wazzimagiygg.com")}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline font-semibold inline-flex items-center gap-1"
            >
              wazzimagiygg.com
              <ExternalLink className="w-3 h-3" />
            </a>. Sincronização em tempo real via Cloud Firestore.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={onOpenNewArticle}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Criar Novo Artigo
          </button>

          {isBureaucrat && (
            <button
              onClick={handleOpenHtmlEditor}
              className="px-4 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
              title="Personalizar a página inicial em HTML (Exclusivo para Burocratas)"
            >
              <Code2 className="w-4 h-4 text-purple-600" />
              Editar Página Inicial HTML
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {syncFeedback && (
        <div className="bg-blue-50 border border-blue-200 text-blue-900 px-4 py-3 rounded-xl flex items-center justify-between text-xs animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
            <span>{syncFeedback}</span>
          </div>
          <button
            onClick={() => setSyncFeedback(null)}
            className="text-blue-500 hover:text-blue-700 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* SECTION 1: Bureaucrat-Customized Home Page (HTML) */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {/* Section Header with Bureaucrat Info */}
        <div className="bg-slate-50 px-6 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold text-slate-800 font-serif">
              {homeMeta.title || 'Página Inicial da Comunidade'}
            </h2>
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[11px] font-mono">
              HTML Personalizado
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-purple-600" />
              Personalizado por:{' '}
              <strong className="text-slate-700 font-medium">{homeMeta.updatedBy}</strong>
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-[11px] text-slate-400">
              {formatTimeAgo(homeMeta.updatedAt)}
            </span>

            {isBureaucrat && (
              <button
                onClick={handleOpenHtmlEditor}
                className="ml-2 text-xs text-purple-600 hover:text-purple-800 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3 h-3" />
                Editar HTML
              </button>
            )}
          </div>
        </div>

        {/* Rendered Bureaucrat HTML */}
        <div className="p-6 sm:p-8">
          <div
            className="prose prose-slate max-w-none text-slate-800 leading-relaxed font-sans"
            dangerouslySetInnerHTML={{ __html: homeMeta.htmlContent }}
          />
        </div>
      </section>

      {/* SECTION 2: Artigos Recentes (Recent Articles from Firebase) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-serif font-bold text-slate-900">
              Artigos Recentes
            </h2>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs font-mono font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {articles.length} no Firebase
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncWithFirebase}
              disabled={isSyncing}
              className="px-2.5 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
              title="Sincronizar artigos no Firebase Firestore"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
              {isSyncing ? 'Sincronizando...' : 'Sincronizar com Firebase'}
            </button>
            <button
              onClick={onOpenNewArticle}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded font-medium flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Criar Artigo
            </button>
          </div>
        </div>

        {articles.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-700 mb-1">
              Nenhum artigo encontrado no Firebase Firestore
            </h3>
            <p className="text-xs text-slate-500 mb-4 max-w-md mx-auto">
              Apenas artigos persistidos no banco de dados Firebase Firestore são exibidos. Dados pré-definidos não sincronizados foram desconsiderados.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleSyncWithFirebase}
                disabled={isSyncing}
                className="px-4 py-2 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                Sincronizar Artigos no Firebase
              </button>
              <button
                onClick={onOpenNewArticle}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Criar Primeiro Artigo
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map(article => {
              const isTalk = article.slug.startsWith('Talk:');
              return (
                <div
                  key={article.slug}
                  className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-blue-300 hover:shadow-sm transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => onNavigateArticle(article.slug)}
                          className="font-serif font-bold text-slate-900 text-base hover:text-blue-600 text-left transition-colors cursor-pointer"
                        >
                          {article.title}
                        </button>
                        {article.isProtected && (
                          <span title="Artigo Protegido">
                            <Shield className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          </span>
                        )}
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                          isTalk
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {isTalk ? 'Discussão' : 'Principal'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-3 mb-3 leading-relaxed">
                      {article.summary || article.wikitext.substring(0, 150).replace(/[\[\]{}|=#*]/g, '') || 'Sem resumo disponível.'}
                    </p>

                    {article.categories && article.categories.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 mb-3">
                        {article.categories.slice(0, 3).map(cat => (
                          <span
                            key={cat}
                            className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono"
                          >
                            #{cat}
                          </span>
                        ))}
                        {article.categories.length > 3 && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            +{article.categories.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3 text-slate-400" />
                        {article.views || 0}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <Clock className="w-3 h-3" />
                        {formatTimeAgo(article.updatedAt || article.createdAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onEditArticle(article.slug)}
                        className="px-2 py-1 text-slate-600 hover:text-blue-600 hover:bg-slate-50 rounded text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                        title="Editar no Wikitext Editor"
                      >
                        <Edit3 className="w-3 h-3" />
                        Editar
                      </button>
                      <button
                        onClick={() => onNavigateArticle(article.slug)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-800 rounded font-medium text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        Ler
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* BUREAUCRAT HTML EDITOR MODAL */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-600/30 border border-purple-500/40 rounded-lg">
                  <Code2 className="w-5 h-5 text-purple-300" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base">
                    Personalização da Página Inicial em HTML
                  </h3>
                  <p className="text-xs text-slate-400">
                    Modo Burocrata • O HTML inserido será renderizado diretamente na tela inicial do sistema
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsEditorOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Toolbar & Templates */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Modelos Prontos:</span>
                <button
                  type="button"
                  onClick={() => applyTemplate('default')}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                >
                  Portal Padrão
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate('announcements')}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                >
                  Quadro de Avisos
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate('academic')}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                >
                  Portal Técnico
                </button>
              </div>

              {/* View Switcher */}
              <div className="flex items-center gap-1 bg-slate-200 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setActiveEditorTab('code')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    activeEditorTab === 'code' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600'
                  }`}
                >
                  Código HTML
                </button>
                <button
                  type="button"
                  onClick={() => setActiveEditorTab('preview')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    activeEditorTab === 'preview' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600'
                  }`}
                >
                  Pré-visualização
                </button>
                <button
                  type="button"
                  onClick={() => setActiveEditorTab('split')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    activeEditorTab === 'split' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600'
                  }`}
                >
                  Dividido (Split)
                </button>
              </div>
            </div>

            {/* Quick Tag Snippets */}
            <div className="bg-white border-b border-slate-100 px-6 py-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[11px] text-slate-500 font-medium">Inserir tag:</span>
              <button
                type="button"
                onClick={() => insertSnippet('<h2 class="text-2xl font-bold text-slate-900 mb-2">Novo Título</h2>')}
                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-mono text-[11px]"
              >
                + Título H2
              </button>
              <button
                type="button"
                onClick={() => insertSnippet('<p class="text-sm text-slate-600 leading-relaxed mb-4">Texto de exemplo.</p>')}
                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-mono text-[11px]"
              >
                + Parágrafo
              </button>
              <button
                type="button"
                onClick={() => insertSnippet('<div class="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">\n  <h4 class="font-bold text-blue-900">Card de Destaque</h4>\n  <p class="text-xs text-blue-700">Conteúdo em destaque.</p>\n</div>')}
                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-mono text-[11px]"
              >
                + Card Azul
              </button>
              <button
                type="button"
                onClick={() => insertSnippet('<div class="p-4 bg-amber-50 border border-amber-300 rounded-lg mb-4 text-amber-900 text-xs font-medium">\n  ⚠️ <strong>Alerta:</strong> Comunicado importante para a comunidade.\n</div>')}
                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-mono text-[11px]"
              >
                + Alerta
              </button>
              <button
                type="button"
                onClick={() => insertSnippet('<a href="#/wiki/MediaWiki" class="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-500 inline-block">Botão de Link</a>')}
                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-mono text-[11px]"
              >
                + Botão Link
              </button>
              <button
                type="button"
                onClick={() => insertSnippet('<a href="https://wazzimagiygg.com/rv/?uid=https://wazzimagiygg.com" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 bg-purple-600 text-white rounded text-xs font-semibold hover:bg-purple-500 inline-block">Visitar WazzimaGiygg ↗</a>')}
                className="px-2 py-0.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded font-mono text-[11px]"
              >
                + Link WazzimaGiygg
              </button>
            </div>

            {/* Modal Body: Code and/or Preview */}
            <div className="flex-1 overflow-hidden p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Code Area */}
              {(activeEditorTab === 'code' || activeEditorTab === 'split') && (
                <div className={`flex flex-col h-full ${activeEditorTab === 'code' ? 'md:col-span-2' : ''}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
                      Código HTML (Personalização Burocrata)
                    </label>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {editingHtml.length} caracteres
                    </span>
                  </div>
                  <textarea
                    value={editingHtml}
                    onChange={e => setEditingHtml(e.target.value)}
                    rows={16}
                    className="flex-1 w-full bg-slate-900 text-emerald-400 font-mono text-xs p-4 rounded-lg border border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-purple-500 resize-none leading-relaxed"
                    placeholder="Digite o código HTML customizado..."
                    spellCheck={false}
                  />
                </div>
              )}

              {/* Live Preview Area */}
              {(activeEditorTab === 'preview' || activeEditorTab === 'split') && (
                <div className={`flex flex-col h-full overflow-hidden ${activeEditorTab === 'preview' ? 'md:col-span-2' : ''}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                      Visualização em Tempo Real
                    </label>
                    <span className="text-[11px] text-emerald-600 font-medium">
                      ● Renderizado
                    </span>
                  </div>
                  <div className="flex-1 w-full border border-slate-200 rounded-lg p-5 overflow-y-auto bg-white shadow-inner">
                    <div
                      className="prose prose-slate max-w-none text-slate-800 text-xs leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: editingHtml }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editingTitle}
                  onChange={e => setEditingTitle(e.target.value)}
                  placeholder="Título da Seção Inicial"
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-800 font-medium w-64"
                />
                <button
                  type="button"
                  onClick={() => applyTemplate('default')}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restaurar Original
                </button>
              </div>

              <div className="flex items-center gap-3">
                {saveSuccess && (
                  <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Salvo no Firebase Firestore com sucesso!
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleSaveHtml}
                  disabled={savingHtml}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
                >
                  {savingHtml ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Gravando no Firestore...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Publicar no Firebase
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
