import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Save, Eye, Code, ArrowLeft, AlertCircle, CheckCircle, HelpCircle, Columns, Sparkles, Bot, ShieldAlert, X, FileCode2, BookOpen, Cloud, CloudOff, RotateCcw, Trash2, Loader2, Blocks, Wand2, AlertTriangle } from 'lucide-react';
import { Article, ArticleDraft, AutoSaveStatus, UserSession } from '../types';
import { api } from '../api';
import { botAgentService } from '../services/botAgentService';
import { syncMediaWikiToFirestore, recordDailyChecklistAction, loginWithGoogle, auth } from '../firebase';
import {
  AUTOSAVE_INACTIVITY_MS,
  AUTOSAVE_PERIODIC_MS,
  saveArticleDraft,
  loadArticleDraft,
  deleteArticleDraft,
  hasMeaningfulDraftChanges,
  formatDraftTimestamp,
} from '../services/draftService';
import {
  templateService,
  applyTemplateSuggestionFix,
  applyAllTemplateSuggestionFixes,
  appendTemplateParameterSnippet,
  TemplateCorrectionSuggestion,
  ExpectedTemplateParamInfo,
} from '../services/templateService';
import { enhanceCodeBlocks } from '../utils/syntaxHighlighter';
import { INFOBOX_SOFTWARE_FIELDS, buildInfoboxSoftwareWikitext } from '../utils/infoboxSoftware';
import { InfoboxTutorialPanel } from './InfoboxTutorialPanel';
import { ArticleFootnotes } from './ArticleFootnotes';
import { ReferenceManagerModal } from './ReferenceManagerModal';
import { TemplateManagerModal } from './TemplateManagerModal';
import { TemplateFixAssistantPanel } from './TemplateFixAssistantPanel';
import { buildDefaultTemplatePageSkeleton } from '../data/defaultTemplates';
import { parseTitle } from '../utils/namespaces';
import { useExtensions } from '../context/ExtensionsContext';

interface WikiEditorProps {
  slug: string;
  currentUser: UserSession | null;
  onSaved: (slug: string) => void;
  onCancel: () => void;
}

export const WikiEditor: React.FC<WikiEditorProps> = ({
  slug,
  currentUser,
  onSaved,
  onCancel,
}) => {
  const [title, setTitle] = useState(slug.replace(/_/g, ' '));
  const [wikitext, setWikitext] = useState('');
  const [summary, setSummary] = useState('');
  const [isMinor, setIsMinor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [initialWikitext, setInitialWikitext] = useState<string>('');
  const [botNotice, setBotNotice] = useState<{ title: string; text: string; type: 'info' | 'warning' } | null>(null);
  const [isCheckingGemini, setIsCheckingGemini] = useState<boolean>(false);

  const { isExtensionEnabled } = useExtensions();
  const isDraftAutosaveEnabled = isExtensionEnabled ? isExtensionEnabled('DraftAutoSaveRealtime', true) : true;
  const isVisualEditorEnabled = isExtensionEnabled ? isExtensionEnabled('VisualEditor', true) : true;
  const isTemplatesEnabled = isExtensionEnabled ? isExtensionEnabled('MediaWikiTemplates', true) : true;
  const isInfoboxEnabled = isExtensionEnabled ? isExtensionEnabled('InfoboxBuilder', true) : true;
  const isCiteEnabled = isExtensionEnabled ? isExtensionEnabled('Cite', true) : true;
  const isSyntaxEnabled = isExtensionEnabled ? isExtensionEnabled('SyntaxHighlight_Prism', true) : true;
  const isBotsEnabled = isExtensionEnabled ? isExtensionEnabled('BotAgent', true) : true;
  const isChecklistEnabled = isExtensionEnabled ? isExtensionEnabled('DailyChecklist', true) : true;
  const isSpamBlacklistEnabled = isExtensionEnabled ? isExtensionEnabled('SpamBlacklist', true) : true;
  const isAbuseFilterEnabled = isExtensionEnabled ? isExtensionEnabled('AbuseFilter', true) : true;
  const isParsoidEnabled = isExtensionEnabled ? isExtensionEnabled('ParsoidCompiler', true) : true;

  // Live Parsoid Preview state
  const [activeTab, setActiveTab] = useState<'split' | 'edit' | 'preview'>(
    isVisualEditorEnabled ? 'split' : 'edit'
  );
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewTimeMs, setPreviewTimeMs] = useState<number>(0);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!isVisualEditorEnabled && activeTab !== 'edit') {
      setActiveTab('edit');
    }
  }, [isVisualEditorEnabled, activeTab]);

  // Infobox Software Builder Modal state
  const [isInfoboxModalOpen, setIsInfoboxModalOpen] = useState(false);
  const [infoboxModalTab, setInfoboxModalTab] = useState<'builder' | 'tutorial'>('builder');
  const [infoboxValues, setInfoboxValues] = useState<Record<string, string>>({});

  // Bibliographic Reference Manager Modal state
  const [isRefModalOpen, setIsRefModalOpen] = useState(false);

  // MediaWiki Template Manager Modal, Auto-Fix Assistant & Custom Namespace 10 Templates state
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isTemplateFixPanelOpen, setIsTemplateFixPanelOpen] = useState(false);
  const [cursorOffset, setCursorOffset] = useState<number>(0);
  const [customTemplates, setCustomTemplates] = useState<Article[]>([]);

  // Firestore Auto-Save state
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<string | null>(null);
  const [lastDraftSource, setLastDraftSource] = useState<'firestore' | 'local' | null>(null);
  const [recoverableDraft, setRecoverableDraft] = useState<ArticleDraft | null>(null);

  const baselineRef = useRef<{ title: string; wikitext: string; summary: string }>({
    title: slug.replace(/_/g, ' '),
    wikitext: '',
    summary: '',
  });
  const lastPersistedSnapshotRef = useRef<string>('');
  const latestEditorStateRef = useRef({ title, wikitext, summary, isMinor });
  latestEditorStateRef.current = { title, wikitext, summary, isMinor };

  const effectiveUserId = auth.currentUser?.uid || currentUser?.id || 'guest';

  const openInfoboxBuilder = () => {
    setInfoboxValues(prev => ({
      name: prev.name || title,
      developer: prev.developer || '',
      author: prev.author || '',
      maintainer: prev.maintainer || '',
      email: prev.email || '',
      latest_release_version: prev.latest_release_version || '',
      initial_release: prev.initial_release || '',
      status: prev.status || 'Ativo',
      programming_language: prev.programming_language || '',
      operating_system: prev.operating_system || '',
      platform: prev.platform || '',
      genre: prev.genre || '',
      license: prev.license || '',
      repository: prev.repository || '',
      website: prev.website || '',
      support_url: prev.support_url || '',
      logo: prev.logo || '',
      caption: prev.caption || '',
    }));
    setIsInfoboxModalOpen(true);
  };

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setRecoverableDraft(null);
    setAutoSaveStatus('idle');
    setLastDraftSavedAt(null);
    setLastDraftSource(null);

    const checkExistingDraft = async (baseTitle: string, baseWikitext: string) => {
      if (!isDraftAutosaveEnabled) return;
      try {
        const draft = await loadArticleDraft(effectiveUserId, slug);
        if (
          isMounted &&
          draft &&
          hasMeaningfulDraftChanges(
            { title: draft.title, wikitext: draft.wikitext, summary: draft.summary },
            { title: baseTitle, wikitext: baseWikitext, summary: '' }
          )
        ) {
          setRecoverableDraft(draft);
        }
      } catch {
        // Ignore draft lookup failures
      }
    };

    if (isTemplatesEnabled) {
      api.getTemplates()
        .then(tpls => {
          if (isMounted) setCustomTemplates(tpls);
        })
        .catch(() => {});
    } else {
      setCustomTemplates([]);
    }

    api.getArticle(slug)
      .then(art => {
        if (isMounted) {
          setTitle(art.title);
          setWikitext(art.wikitext);
          setInitialWikitext(art.wikitext);
          baselineRef.current = { title: art.title, wikitext: art.wikitext, summary: '' };
          lastPersistedSnapshotRef.current = JSON.stringify([art.title, art.wikitext, '', false]);
          setLoading(false);
          checkExistingDraft(art.title, art.wikitext);
        }
      })
      .catch(() => {
        // New article or new Predefinição template
        if (isMounted) {
          const defaultTitle = slug.replace(/_/g, ' ');
          const parsedNewTitle = parseTitle(defaultTitle);
          const template =
            parsedNewTitle.namespaceId === 10
              ? buildDefaultTemplatePageSkeleton(parsedNewTitle.baseTitle || defaultTitle)
              : `'''${defaultTitle}''' é um artigo no NotMediaWiki, parte do desenvolvimento de projetos WazzimaGiygg (wazzimagiygg.com).\n\n== Visão Geral ==\nEscreva o conteúdo aqui...\n\n== Referências ==\n<ref>[https://wazzimagiygg.com Portal WazzimaGiygg]</ref>\n`;
          setTitle(defaultTitle);
          setWikitext(template);
          setInitialWikitext('');
          baselineRef.current = { title: defaultTitle, wikitext: template, summary: '' };
          lastPersistedSnapshotRef.current = JSON.stringify([defaultTitle, template, '', false]);
          setLoading(false);
          checkExistingDraft(defaultTitle, template);
        }
      });

    return () => { isMounted = false; };
  }, [slug, effectiveUserId, isDraftAutosaveEnabled, isTemplatesEnabled]);

  const persistDraftNow = useCallback(async () => {
    if (!isDraftAutosaveEnabled || loading || saving || currentUser?.isBanned || recoverableDraft) return;
    const current = latestEditorStateRef.current;
    if (!hasMeaningfulDraftChanges(current, baselineRef.current)) {
      return;
    }

    const snapshot = JSON.stringify([current.title, current.wikitext, current.summary, current.isMinor]);
    if (snapshot === lastPersistedSnapshotRef.current) {
      return;
    }

    setAutoSaveStatus('saving');
    try {
      const saved = await saveArticleDraft({
        userId: effectiveUserId,
        articleSlug: slug,
        title: current.title,
        wikitext: current.wikitext,
        summary: current.summary,
        isMinor: current.isMinor,
      });
      lastPersistedSnapshotRef.current = snapshot;
      setLastDraftSavedAt(saved.updatedAt);
      setLastDraftSource(saved.storageSource || 'firestore');
      setAutoSaveStatus('saved');
    } catch {
      setLastDraftSource('local');
      setAutoSaveStatus('error');
    }
  }, [isDraftAutosaveEnabled, loading, saving, currentUser?.isBanned, recoverableDraft, effectiveUserId, slug]);

  // Auto-save on typing inactivity (debounced)
  useEffect(() => {
    if (!isDraftAutosaveEnabled || loading || saving || currentUser?.isBanned || recoverableDraft) return;

    const current = { title, wikitext, summary };
    if (!hasMeaningfulDraftChanges(current, baselineRef.current)) {
      return;
    }

    const snapshot = JSON.stringify([title, wikitext, summary, isMinor]);
    if (snapshot === lastPersistedSnapshotRef.current) {
      return;
    }

    setAutoSaveStatus('pending');
    const inactivityTimer = setTimeout(() => {
      void persistDraftNow();
    }, AUTOSAVE_INACTIVITY_MS);

    return () => clearTimeout(inactivityTimer);
  }, [isDraftAutosaveEnabled, title, wikitext, summary, isMinor, loading, saving, currentUser?.isBanned, recoverableDraft, persistDraftNow]);

  // Periodic auto-save safety net (every 30s if dirty)
  useEffect(() => {
    if (!isDraftAutosaveEnabled || loading || saving || currentUser?.isBanned || recoverableDraft) return;

    const intervalId = setInterval(() => {
      void persistDraftNow();
    }, AUTOSAVE_PERIODIC_MS);

    return () => clearInterval(intervalId);
  }, [isDraftAutosaveEnabled, loading, saving, currentUser?.isBanned, recoverableDraft, persistDraftNow]);

  const handleRestoreDraft = () => {
    if (!recoverableDraft) return;
    setTitle(recoverableDraft.title);
    setWikitext(recoverableDraft.wikitext);
    setSummary(recoverableDraft.summary || '');
    setIsMinor(Boolean(recoverableDraft.isMinor));
    lastPersistedSnapshotRef.current = JSON.stringify([
      recoverableDraft.title,
      recoverableDraft.wikitext,
      recoverableDraft.summary || '',
      Boolean(recoverableDraft.isMinor),
    ]);
    setLastDraftSavedAt(recoverableDraft.updatedAt);
    setLastDraftSource(recoverableDraft.storageSource || 'firestore');
    setAutoSaveStatus('saved');
    setRecoverableDraft(null);
  };

  const handleDiscardDraft = async () => {
    setRecoverableDraft(null);
    setAutoSaveStatus('idle');
    setLastDraftSavedAt(null);
    await deleteArticleDraft(effectiveUserId, slug);
  };

  // Live Parsoid parse preview effect
  useEffect(() => {
    if (!wikitext || !isVisualEditorEnabled) return;
    const isTemplatePage = parseTitle(title).namespaceId === 10;
    const timer = setTimeout(() => {
      api.parseWikitext(wikitext, title, { customTemplates, isTemplatePage })
        .then(res => {
          setPreviewHtml(res.html);
          setPreviewTimeMs(res.parseTimeMs);
          setPreviewError(null);
        })
        .catch(err => setPreviewError(err.message));
    }, 250);
    return () => clearTimeout(timer);
  }, [wikitext, title, customTemplates, isVisualEditorEnabled, isParsoidEnabled, isTemplatesEnabled, isCiteEnabled, isInfoboxEnabled]);

  const previewRef = useRef<HTMLDivElement>(null);

  // Enhance code blocks in preview pane with syntax highlighting
  useEffect(() => {
    if (!previewRef.current || !previewHtml || !isSyntaxEnabled || !isParsoidEnabled) return;
    enhanceCodeBlocks(previewRef.current);
  }, [previewHtml, activeTab, isSyntaxEnabled, isParsoidEnabled]);

  const insertMarkup = (before: string, after: string = '', defaultText: string = '') => {
    const textarea = document.getElementById('wikitext-input') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = wikitext.substring(start, end) || defaultText;
    const replacement = `${before}${selected}${after}`;

    const updated = wikitext.substring(0, start) + replacement + wikitext.substring(end);
    setWikitext(updated);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
      setCursorOffset(start + before.length + selected.length);
    }, 0);
  };

  const isTemplatePage = parseTitle(title).namespaceId === 10;

  const templateFixAnalysis = useMemo(() => {
    if (!isTemplatesEnabled) {
      return { suggestions: [], activeCursorTemplate: null };
    }
    return templateService.analyzeTemplateSyntaxSuggestions(wikitext, {
      customTemplates,
      cursorOffset,
      isTemplatePage,
    });
  }, [isTemplatesEnabled, wikitext, customTemplates, cursorOffset, isTemplatePage]);

  const syncCursorFromTextarea = (el?: HTMLTextAreaElement | null) => {
    const target = el || (document.getElementById('wikitext-input') as HTMLTextAreaElement | null);
    if (target && typeof target.selectionStart === 'number') {
      setCursorOffset(target.selectionStart);
    }
  };

  const focusAndSelectTextareaRange = (selStart: number, selEnd: number) => {
    if (activeTab === 'preview' && isVisualEditorEnabled) {
      setActiveTab('split');
    }
    setTimeout(() => {
      const textarea = document.getElementById('wikitext-input') as HTMLTextAreaElement | null;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(selStart, selEnd);
      setCursorOffset(selStart);
    }, 0);
  };

  const handleApplyTemplateFix = (suggestion: TemplateCorrectionSuggestion) => {
    if (suggestion.suggestedSnippet === undefined) return;
    const updated = applyTemplateSuggestionFix(wikitext, suggestion);
    setWikitext(updated);
    const fixedEnd = suggestion.start + suggestion.suggestedSnippet.length;
    focusAndSelectTextareaRange(suggestion.start, fixedEnd);
  };

  const handleApplyAllTemplateFixes = () => {
    const updated = applyAllTemplateSuggestionFixes(wikitext, templateFixAnalysis.suggestions);
    setWikitext(updated);
    focusAndSelectTextareaRange(0, 0);
  };

  const handleInsertExpectedTemplateParam = (
    range: { start: number; end: number; isUnclosed?: boolean },
    param: ExpectedTemplateParamInfo
  ) => {
    const result = appendTemplateParameterSnippet(wikitext, range, param);
    setWikitext(result.nextWikitext);
    focusAndSelectTextareaRange(result.selectionStart, result.selectionEnd);
  };

  const handleCheckCitationsInline = async () => {
    setIsCheckingGemini(true);
    setBotNotice(null);
    try {
      const res = await api.verifyCitationsWithGemini(title, wikitext);
      if (res && res.analysis) {
        const hasMissing = res.analysis.hasMissingCitations;
        setBotNotice({
          title: hasMissing ? 'CitationBot (Gemini 3.8 Flash): Fontes Necessárias' : 'CitationBot: Citações Adequadas',
          text: res.analysis.summary || 'Análise de citações concluída com sucesso.',
          type: hasMissing ? 'warning' : 'info',
        });
      }
    } catch (e: any) {
      setBotNotice({
        title: 'CitationBot',
        text: 'Não foi possível verificar com o Gemini no momento.',
        type: 'info',
      });
    } finally {
      setIsCheckingGemini(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setSaving(true);

    try {
      let activeUser = currentUser;
      if (!auth.currentUser) {
        try {
          activeUser = await loginWithGoogle();
        } catch (loginErr: any) {
          setErrorMessage(
            loginErr?.code === 'auth/popup-closed-by-user'
              ? 'Login com Google cancelado. Autentique-se com sua conta Google para salvar alterações.'
              : `Falha ao autenticar com Google: ${loginErr?.message || 'Tente novamente.'}`
          );
          setSaving(false);
          return;
        }
      } else if (!activeUser) {
        activeUser = await api.getCurrentUser();
      }

      if (activeUser?.isBanned) {
        setErrorMessage('Sua conta está banida e não possui permissão para editar páginas.');
        setSaving(false);
        return;
      }

      if (activeUser?.role === 'reader') {
        setErrorMessage('Contas com papel de leitor (reader) não possuem permissão de edição.');
        setSaving(false);
        return;
      }

      const cleanSlug = title.trim().replace(/\s+/g, '_');
      const tempArticle: Article = {
        id: 'tmp',
        slug: cleanSlug,
        title: title.trim(),
        namespace: 0,
        wikitext,
        summary: summary.trim(),
        latestRevisionId: 'rev_tmp',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        categories: [],
        views: 1,
      };

      if (isBotsEnabled) {
        // 4.1.1.E0.1: Análise prévia por LgpdBot (Bloqueio de PII/CPF)
        const lgpdIssues = botAgentService.inspectLgpd(tempArticle);
        const criticalPii = lgpdIssues.find(i => i.severity === 'critical');
        if (criticalPii) {
          setErrorMessage(`Alerta LgpdBot (4.1.1.E0.1): ${criticalPii.title}. ${criticalPii.details}`);
          setSaving(false);
          return;
        }

        // 4.1.1.11E.1: Análise prévia por AntiVandalBot
        const vandalIssues = botAgentService.inspectVandalism(tempArticle, initialWikitext);
        const criticalVandal = vandalIssues.find(i => i.severity === 'critical');
        if (criticalVandal) {
          setErrorMessage(`Alerta AntiVandalBot (4.1.1.11E.1): ${criticalVandal.title}. ${criticalVandal.details}`);
          setSaving(false);
          return;
        }
      }

      if (isSpamBlacklistEnabled && /(?:bit\.ly\/|tinyurl\.com\/|spam-phishing|free-crypto-giveaway)/i.test(wikitext)) {
        setErrorMessage('Bloqueado pelo SpamBlacklist: URL externa suspeita detectada no conteúdo.');
        setSaving(false);
        return;
      }

      if (isAbuseFilterEnabled && /<script\b|javascript:/i.test(wikitext)) {
        setErrorMessage('Bloqueado pelo AbuseFilter: Padrão XSS ou script embutido não permitido.');
        setSaving(false);
        return;
      }

      const resolvedNs = parseTitle(title.trim()).namespaceId;
      const res = await api.saveArticle({
        slug: cleanSlug,
        title: title.trim(),
        wikitext,
        comment: summary.trim() || 'Updated wikitext via Node.js Parsoid editor',
        isMinor,
        namespace: resolvedNs,
        authorUser: activeUser,
      });

      // 4.1.1.18C.1: Auditoria contínua de contribuições de usuário
      if (activeUser) {
        if (isBotsEnabled) {
          botAgentService.auditUserContributions(activeUser, {
            articleSlug: cleanSlug,
            charDelta: wikitext.length - initialWikitext.length,
            isVandal: false,
          }).catch(console.warn);
        }

        if (isChecklistEnabled) {
          // 3.05.8.b.b: Conceder 0.20 ponto diário por contribuição
          recordDailyChecklistAction(activeUser.id, activeUser.username, 'contribution', {
            articleSlug: cleanSlug,
          }).catch(console.warn);
        }
      }

      // Clear auto-saved draft after successful publication
      if (isDraftAutosaveEnabled) {
        const activeUid = auth.currentUser?.uid || activeUser?.id || effectiveUserId;
        deleteArticleDraft(activeUid, slug).catch(console.warn);
        if (cleanSlug !== slug) {
          deleteArticleDraft(activeUid, cleanSlug).catch(console.warn);
        }
      }
      setAutoSaveStatus('idle');
      setLastDraftSavedAt(null);

      setSuccessMessage(
        isChecklistEnabled
          ? `Artigo "${res.article.title}" salvo com sucesso no Firebase Firestore! (+0.20 pt no Checklist Diário - 3.05.8.b.b)`
          : `Artigo "${res.article.title}" salvo com sucesso no Firebase Firestore!`
      );
      setTimeout(() => {
        onSaved(res.article.slug);
      }, 700);
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao salvar artigo no Firebase Firestore');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 flex items-center justify-center">
        <div className="text-sm text-slate-500 font-mono">Loading article wikitext source...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Editor Sub-header */}
      <div className="border-b border-slate-200 pb-3 mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
            title="Return to reader"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Editing: <span className="font-serif italic">{title}</span>
            </h1>
            <div className="text-xs text-slate-500 font-sans">
              Committed via Node.js ContentService & EventStreams
            </div>
          </div>
        </div>

        {/* Auto-Save Status + View Layout Tabs */}
        <div className="flex flex-wrap items-center justify-end gap-2.5">
          {isDraftAutosaveEnabled && autoSaveStatus !== 'idle' && (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-medium transition-colors ${
                autoSaveStatus === 'saving'
                  ? 'bg-slate-50 border-slate-200 text-slate-600'
                  : autoSaveStatus === 'saved'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : autoSaveStatus === 'pending'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}
              title={
                lastDraftSource === 'firestore'
                  ? 'Rascunho sincronizado automaticamente no Firebase Firestore'
                  : 'Rascunho salvo localmente no navegador (faça login para sincronizar no Firestore)'
              }
            >
              {autoSaveStatus === 'saving' && (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-slate-500" />
                  <span>Salvando rascunho...</span>
                </>
              )}
              {autoSaveStatus === 'pending' && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>Alterações não salvas</span>
                  <button
                    type="button"
                    onClick={() => void persistDraftNow()}
                    className="ml-1 underline hover:text-amber-950 cursor-pointer"
                  >
                    Salvar agora
                  </button>
                </>
              )}
              {autoSaveStatus === 'saved' && (
                <>
                  <Cloud className="w-3 h-3 text-emerald-600" />
                  <span>
                    Rascunho salvo{lastDraftSavedAt ? ` às ${formatDraftTimestamp(lastDraftSavedAt)}` : ''}
                    {lastDraftSource === 'firestore' ? ' (Firestore)' : ' (Local)'}
                  </span>
                </>
              )}
              {autoSaveStatus === 'error' && (
                <>
                  <CloudOff className="w-3 h-3 text-rose-600" />
                  <span>Falha na nuvem (salvo localmente)</span>
                  <button
                    type="button"
                    onClick={() => void persistDraftNow()}
                    className="ml-1 underline hover:text-rose-900 cursor-pointer"
                  >
                    Tentar novamente
                  </button>
                </>
              )}
            </div>
          )}

          {/* View Layout Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded">
            {isVisualEditorEnabled && (
              <button
                onClick={() => setActiveTab('split')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
                  activeTab === 'split' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Columns className="w-3 h-3" />
                Dual Split
              </button>
            )}
            <button
              onClick={() => setActiveTab('edit')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
                activeTab === 'edit' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Code className="w-3 h-3" />
              Wikitext
            </button>
            {isVisualEditorEnabled && (
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
                  activeTab === 'preview' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3 h-3" />
                Parsoid Preview
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Recoverable Draft Banner */}
      {isDraftAutosaveEnabled && recoverableDraft && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-300 text-amber-950 text-xs rounded-lg flex flex-wrap items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <RotateCcw className="w-4 h-4 text-amber-700 shrink-0" />
            <div>
              <strong className="font-semibold">Rascunho automático encontrado</strong>
              <span className="ml-1.5 text-amber-800">
                Salvo {recoverableDraft.storageSource === 'firestore' ? 'no Firestore' : 'localmente'} em{' '}
                {new Date(recoverableDraft.updatedAt).toLocaleString('pt-BR')}. Deseja continuar de onde parou?
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleRestoreDraft}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restaurar rascunho
            </button>
            <button
              type="button"
              onClick={() => void handleDiscardDraft()}
              className="px-2.5 py-1.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded font-medium flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Descartar
            </button>
          </div>
        </div>
      )}

      {/* Alerts */}
      {currentUser?.isBanned && (
        <div className="mb-4 p-4 bg-rose-50 border border-rose-300 text-rose-900 text-xs rounded-lg flex items-start gap-3 shadow-2xs">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-rose-800 text-sm">Conta Bloqueada / Banida</div>
            <div>
              Seu usuário está marcado como banido no sistema. Permissões de escrita, edição e criação de revisões foram revogadas pelo administrador.
            </div>
            {currentUser.banReason && (
              <div className="font-mono text-[11px] bg-rose-100/80 p-1.5 rounded text-rose-800 border border-rose-200">
                Motivo registrado: {currentUser.banReason}
              </div>
            )}
          </div>
        </div>
      )}

      {!currentUser?.isBanned && currentUser?.role === 'reader' && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-300 text-amber-900 text-xs rounded-lg flex items-start gap-3 shadow-2xs">
          <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-amber-900 text-sm">Conta em Modo Leitor (Somente Leitura)</div>
            <div>
              Seu perfil está configurado com o papel <code className="font-mono font-semibold">reader</code>. Solicite promoção para <code className="font-mono font-semibold">editor</code> a um burocrata ou administrador para publicar edições.
            </div>
          </div>
        </div>
      )}

      {!currentUser && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 text-xs rounded-lg flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>
              Você está editando como visitante. Para publicar alterações ou criar novos artigos no NotMediaWiki, autentique-se com sua conta Google.
            </span>
          </div>
          <button
            type="button"
            onClick={async () => {
              try {
                setErrorMessage(null);
                await loginWithGoogle();
              } catch (err: any) {
                setErrorMessage('Falha ao autenticar com Google: ' + err.message);
              }
            }}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium shrink-0 cursor-pointer transition-colors shadow-2xs"
          >
            Fazer Login com Google
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {botNotice && (
        <div
          className={`mb-4 p-3 rounded-lg border text-xs flex items-start gap-2.5 shadow-2xs ${
            botNotice.type === 'warning'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
              : 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200'
          }`}
        >
          <Bot className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="block font-semibold">{botNotice.title}</strong>
            <span>{botNotice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setBotNotice(null)}
            className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      <form onSubmit={handleSave}>
        {/* Wikitext Syntax Quick-Bar */}
        {(isVisualEditorEnabled || isTemplatesEnabled || isInfoboxEnabled || isCiteEnabled || isSyntaxEnabled || isBotsEnabled) && (
        <div className="bg-slate-50 border border-slate-200 rounded-t p-2 flex flex-wrap items-center gap-1 text-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-2">Markup:</span>
          {isVisualEditorEnabled && (
            <>
              <button
                type="button"
                onClick={() => insertMarkup('== ', ' ==', 'Section heading')}
                className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-700 font-medium"
              >
                Heading
              </button>
              <button
                type="button"
                onClick={() => insertMarkup("'''", "'''", 'bold text')}
                className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-700 font-bold"
              >
                Bold
              </button>
              <button
                type="button"
                onClick={() => insertMarkup("''", "''", 'italic text')}
                className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-700 italic"
              >
                Italic
              </button>
              <button
                type="button"
                onClick={() => insertMarkup('[[', ']]', 'Article Title')}
                className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-blue-700 font-medium"
              >
                [[Wikilink]]
              </button>
            </>
          )}
          {isTemplatesEnabled && (
            <>
              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(true)}
                data-testid="open-template-manager-btn"
                className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded text-indigo-800 dark:text-indigo-200 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                title="Inserir predefinição MediaWiki ({{Aviso}}, {{Esboço}}, {{Navbox}}, {{Infocaixa}}, {{Predefinição:...}})"
              >
                <Blocks className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                <span>{'{{ Predefinição }}'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsTemplateFixPanelOpen(prev => !prev)}
                aria-expanded={isTemplateFixPanelOpen}
                data-testid="toggle-template-fix-assistant-btn"
                className={`px-2.5 py-1 border rounded font-semibold text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                  templateFixAnalysis.suggestions.length > 0
                    ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}
                title="Sugerir correções para chaves {{...}} mal formadas e listar parâmetros esperados do templateService.ts"
              >
                {templateFixAnalysis.suggestions.length > 0 ? (
                  <AlertTriangle className="w-3 h-3 text-amber-700 dark:text-amber-300 shrink-0" />
                ) : (
                  <Wand2 className="w-3 h-3 text-slate-500 dark:text-slate-400 shrink-0" />
                )}
                <span>
                  {templateFixAnalysis.suggestions.length > 0
                    ? `Corrigir {{}} (${templateFixAnalysis.suggestions.length})`
                    : 'Parâmetros {{}}'}
                </span>
              </button>
            </>
          )}
          {isInfoboxEnabled && (
            <button
              type="button"
              onClick={openInfoboxBuilder}
              className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-700 font-mono text-[11px] cursor-pointer"
              title="Abrir assistente de Infobox software (nome, e-mail, desenvolvedor, versão, licença, links e mais)"
            >
              {'{Infobox software}'}
            </button>
          )}
          {isVisualEditorEnabled && (
            <button
              type="button"
              onClick={() => insertMarkup('{| class="wikitable"\n! Header 1 !! Header 2\n|-\n| Cell 1 || Cell 2\n|}\n')}
              className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-700 font-mono text-[11px]"
            >
              {'{| Table |}'}
            </button>
          )}
          {isCiteEnabled && (
            <>
              <button
                type="button"
                onClick={() => insertMarkup('<ref>', '</ref>', 'Citation source')}
                className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-700 font-mono text-[11px] cursor-pointer"
                title="Inserir tag <ref> simples"
              >
                &lt;ref&gt;
              </button>
              <button
                type="button"
                onClick={() => setIsRefModalOpen(true)}
                className="px-2 py-1 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded text-amber-800 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                title="Abrir Gestor de Referências Bibliográficas (inserir ou reutilizar <ref>)"
              >
                <BookOpen className="w-3 h-3 text-amber-600" />
                <span>Referências</span>
              </button>
            </>
          )}
          {isVisualEditorEnabled && (
            <button
              type="button"
              onClick={() => insertMarkup('* ', '', 'Bullet item')}
              className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-700 font-medium"
            >
              * List
            </button>
          )}
          {isSyntaxEnabled && (
            <button
              type="button"
              onClick={() => insertMarkup('<syntaxhighlight lang="typescript">\n', '\n</syntaxhighlight>\n', '// Escreva seu código aqui\nconst answer: number = 42;')}
              className="px-2 py-1 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded text-blue-700 font-mono text-[11px] font-semibold"
              title="Inserir bloco de código formatado com realce de sintaxe"
            >
              &lt;code&gt; Syntax
            </button>
          )}
          {isBotsEnabled && (
            <button
              type="button"
              onClick={handleCheckCitationsInline}
              disabled={isCheckingGemini}
              className="px-2 py-1 bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300 rounded font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
              title="4.1.1.WV.1: Verificar fontes e citações faltantes com CitationBot (Gemini 3.8 Flash)"
            >
              <Sparkles className="w-3 h-3 text-purple-600 animate-pulse" />
              <span>{isCheckingGemini ? 'Checando...' : 'CitationBot (Gemini)'}</span>
            </button>
          )}

          {isVisualEditorEnabled && (
            <div className="ml-auto flex items-center gap-2 text-[11px] text-slate-500 font-mono">
              <span>Parsoid preview:</span>
              <span className="text-emerald-700 font-semibold">{previewTimeMs}ms</span>
            </div>
          )}
        </div>
        )}

        {/* Template Key Correction Suggestion & Expected Parameters Assistant */}
        {isTemplatesEnabled && isTemplateFixPanelOpen && (
          <TemplateFixAssistantPanel
            suggestions={templateFixAnalysis.suggestions}
            activeCursorTemplate={templateFixAnalysis.activeCursorTemplate}
            onApplyFix={handleApplyTemplateFix}
            onApplyAllFixes={handleApplyAllTemplateFixes}
            onInsertParam={handleInsertExpectedTemplateParam}
            onLocateRange={focusAndSelectTextareaRange}
            onOpenTemplateManager={() => setIsTemplateModalOpen(true)}
            onClose={() => setIsTemplateFixPanelOpen(false)}
          />
        )}

        {/* Editor Main Content Area */}
        <div className={`grid border border-slate-200 bg-white ${
          activeTab === 'split' && isVisualEditorEnabled ? 'grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200' : 'grid-cols-1'
        }`}>
          {/* Source Input */}
          {(activeTab === 'split' || activeTab === 'edit' || !isVisualEditorEnabled) && (
            <div className="p-2">
              <textarea
                id="wikitext-input"
                value={wikitext}
                onChange={e => {
                  setWikitext(e.target.value);
                  setCursorOffset(e.target.selectionStart ?? 0);
                }}
                onClick={e => syncCursorFromTextarea(e.currentTarget)}
                onKeyUp={e => syncCursorFromTextarea(e.currentTarget)}
                onSelect={e => syncCursorFromTextarea(e.currentTarget)}
                rows={22}
                className="w-full h-full min-h-[460px] p-3 font-mono text-xs text-slate-800 leading-relaxed outline-none resize-y placeholder:text-slate-400"
                placeholder="Type MediaWiki markup here..."
              />
            </div>
          )}

          {/* Live Parsoid HTML Render */}
          {isVisualEditorEnabled && (activeTab === 'split' || activeTab === 'preview') && (
            <div className="p-4 bg-slate-50/40 overflow-y-auto max-h-[520px]">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 pb-1 border-b border-slate-200 flex items-center justify-between">
                <span>Parsoid AST Rendered Output</span>
                <span className="font-mono text-slate-400 font-normal">HTML5 DOM</span>
              </div>
              {previewError ? (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded">{previewError}</div>
              ) : (
                <>
                  <div
                    ref={previewRef}
                    className="wiki-content text-justify prose max-w-none text-slate-800 font-serif text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: previewHtml || '<p class="text-slate-400 italic">No content to render</p>' }}
                  />
                  {isParsoidEnabled && isCiteEnabled && (
                    <ArticleFootnotes
                      wikitext={wikitext}
                      articleTitle={title}
                      className="mt-6 pt-4"
                    />
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Commit / Save Metadata Form */}
        <div className="mt-4 p-4 border border-slate-200 rounded bg-slate-50 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-8">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Edit summary (Briefly describe your changes):
              </label>
              <input
                type="text"
                value={summary}
                onChange={e => setSummary(e.target.value)}
                placeholder="e.g. Updated architecture table and added Parsoid documentation"
                className="w-full bg-white border border-slate-200 text-xs px-3 py-2 rounded outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div className="md:col-span-4 flex items-center gap-4 pt-4 md:pt-0">
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isMinor}
                  onChange={e => setIsMinor(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>This is a minor edit</span>
              </label>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              Autor: <span className="font-semibold text-slate-800 dark:text-slate-200">{currentUser?.username || 'Visitante (autentique-se com Google para salvar)'}</span> · Papel: <span className="font-mono text-slate-700 dark:text-slate-300">{currentUser?.role || 'editor'}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-100 rounded text-xs font-medium text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || currentUser?.isBanned || currentUser?.role === 'reader'}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {currentUser?.isBanned
                  ? 'Bloqueado (Usuário Banido)'
                  : currentUser?.role === 'reader'
                  ? 'Somente Leitura (Reader)'
                  : saving
                  ? 'Committing Revision...'
                  : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Infobox Software Builder & Usage Reference Modal */}
      {isInfoboxEnabled && isInfoboxModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Assistente de Infobox software"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Assistente de Uso — {'{{Infobox software}}'}
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Preencha os campos desejados. Campos vazios são ocultados automaticamente na renderização do artigo; e-mails e URLs viram links clicáveis.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setInfoboxModalTab('builder')}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                      infoboxModalTab === 'builder'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Construtor
                  </button>
                  <button
                    type="button"
                    onClick={() => setInfoboxModalTab('tutorial')}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                      infoboxModalTab === 'tutorial'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Tutorial de Uso
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setIsInfoboxModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded cursor-pointer"
                  aria-label="Fechar assistente"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {infoboxModalTab === 'tutorial' ? (
                <InfoboxTutorialPanel
                  defaultTab="software"
                  onInsertSnippet={snippet => {
                    insertMarkup(snippet);
                    setIsInfoboxModalOpen(false);
                  }}
                  insertButtonLabel="Inserir no editor"
                />
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {INFOBOX_SOFTWARE_FIELDS.map(field => (
                      <div key={field.key} className="space-y-1">
                        <label className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                          <span>{field.label}</span>
                          <code className="text-[10px] font-mono text-slate-400">| {field.key}</code>
                        </label>
                        <input
                          type={field.type || 'text'}
                          value={infoboxValues[field.key] ?? ''}
                          onChange={e =>
                            setInfoboxValues(prev => ({
                              ...prev,
                              [field.key]: e.target.value,
                            }))
                          }
                          placeholder={field.placeholder}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                        />
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-snug">
                          {field.description}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      Pré-visualização do Wikitext gerado:
                    </div>
                    <pre className="text-[11px] font-mono text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      {buildInfoboxSoftwareWikitext(infoboxValues)}
                    </pre>
                  </div>
                </>
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  insertMarkup(buildInfoboxSoftwareWikitext());
                  setIsInfoboxModalOpen(false);
                }}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750 rounded text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                Inserir modelo completo em branco
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsInfoboxModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 rounded text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    insertMarkup(buildInfoboxSoftwareWikitext(infoboxValues));
                    setIsInfoboxModalOpen(false);
                  }}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold cursor-pointer shadow-xs"
                >
                  Inserir Infobox no Wikitext
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Bibliographic Reference Manager Modal */}
      {isCiteEnabled && (
        <ReferenceManagerModal
          isOpen={isRefModalOpen}
          wikitext={wikitext}
          onClose={() => setIsRefModalOpen(false)}
          onInsertMarkup={markup => insertMarkup(markup)}
        />
      )}

      {/* MediaWiki Predefinições (Templates) Modal */}
      {isTemplatesEnabled && (
        <TemplateManagerModal
          isOpen={isTemplateModalOpen}
          onClose={() => setIsTemplateModalOpen(false)}
          onInsertTemplate={tplWikitext => insertMarkup(tplWikitext)}
          customTemplates={customTemplates}
          pageTitle={title}
          currentUser={currentUser}
          onTemplatesChanged={setCustomTemplates}
        />
      )}
    </div>
  );
};
