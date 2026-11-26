import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Save, Eye, Code, ArrowLeft, AlertCircle, CheckCircle, Columns, Sparkles, Bot, ShieldAlert, X, FileCode2, BookOpen, Cloud, CloudOff, RotateCcw, Trash2, Loader2, Blocks, Wand2, AlertTriangle, FileText, PanelRight, Plus, ChevronDown, Languages, Undo2, Redo2, Search, Settings2, IndentDecrease, IndentIncrease, MessageSquareCode, PenLine } from 'lucide-react';
import { Article, ArticleDraft, AutoSaveStatus, UserSession } from '../types';
import { api } from '../api';
import { botAgentService } from '../services/botAgentService';
import { loginWithGoogle, auth, recordDailyChecklistAction } from '../firebase';
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
import { TemplateManagementPanel } from './TemplateManagementPanel';
import { TemplateFixAssistantPanel } from './TemplateFixAssistantPanel';
import { RichFormattedEditor, RichFormattedEditorHandle } from './RichFormattedEditor';
import { SpecialCharactersMenu } from './SpecialCharactersMenu';
import { PageMetadataModal } from './PageMetadataModal';
import { FORMATTED_INSERT_OPTIONS } from '../utils/wikitextRichConverter';
import { buildDefaultTemplatePageSkeleton } from '../data/defaultTemplates';
import { parseTitle } from '../utils/namespaces';
import { useExtensions } from '../context/ExtensionsContext';

export type EditorViewMode = 'split-formatted' | 'formatted' | 'split' | 'edit' | 'preview';

export function insertTextAtCursor(
  source: string,
  insertedText: string,
  selectionStart: number,
  selectionEnd: number = selectionStart
): { nextText: string; nextCursor: number } {
  const safeStart = Math.max(0, Math.min(selectionStart, source.length));
  const safeEnd = Math.max(safeStart, Math.min(selectionEnd, source.length));
  const nextText = source.slice(0, safeStart) + insertedText + source.slice(safeEnd);
  const nextCursor = safeStart + insertedText.length;
  return { nextText, nextCursor };
}

export function applyLineIndentToWikitext(
  source: string,
  selectionStart: number,
  selectionEnd: number,
  direction: 'indent' | 'outdent'
): { nextText: string; nextStart: number; nextEnd: number } {
  const safeStart = Math.max(0, Math.min(selectionStart, source.length));
  const safeEnd = Math.max(safeStart, Math.min(selectionEnd, source.length));
  const lineStart = source.lastIndexOf('\n', Math.max(0, safeStart - 1)) + 1;
  const lineEndIdx = source.indexOf('\n', safeEnd);
  const lineEnd = lineEndIdx === -1 ? source.length : lineEndIdx;
  const block = source.slice(lineStart, lineEnd);
  const lines = block.split('\n');

  const transformed = lines.map(line => {
    if (direction === 'indent') {
      if (/^\*{1,2}\s/.test(line)) return `*${line}`;
      if (/^#{1,2}\s/.test(line)) return `#${line}`;
      if (/^:{1,3}/.test(line)) return `:${line}`;
      return `: ${line}`;
    }
    if (/^\*{2,3}\s/.test(line)) return line.slice(1);
    if (/^#{2,3}\s/.test(line)) return line.slice(1);
    if (/^:{1,4}\s?/.test(line)) return line.replace(/^:\s?/, '');
    if (line.startsWith('  ')) return line.slice(2);
    return line;
  });

  const nextBlock = transformed.join('\n');
  const nextText = source.slice(0, lineStart) + nextBlock + source.slice(lineEnd);
  const delta = nextBlock.length - block.length;
  return {
    nextText,
    nextStart: Math.max(lineStart, safeStart + (lines.length === 1 ? delta : 0)),
    nextEnd: Math.max(lineStart, safeEnd + delta),
  };
}

export function toggleWikitextBlockHierarchy(
  source: string,
  selectionStart: number,
  styleDigit: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8'
): { nextText: string; nextCursor: number } {
  const safePos = Math.max(0, Math.min(selectionStart, source.length));
  const lineStart = source.lastIndexOf('\n', Math.max(0, safePos - 1)) + 1;
  const lineEndIdx = source.indexOf('\n', safePos);
  const lineEnd = lineEndIdx === -1 ? source.length : lineEndIdx;
  const rawLine = source.slice(lineStart, lineEnd);

  // Strip existing heading / blockquote / pre wrappers cleanly
  let cleanContent = rawLine
    .replace(/^={1,6}\s*(.*?)\s*={1,6}$/, '$1')
    .replace(/^<blockquote>([\s\S]*)<\/blockquote>$/i, '$1')
    .replace(/^<pre>([\s\S]*)<\/pre>$/i, '$1')
    .trim();

  if (!cleanContent && styleDigit !== '0') {
    cleanContent =
      styleDigit === '7'
        ? 'Texto pré-formatado'
        : styleDigit === '8'
        ? 'Texto citado'
        : 'Título';
  }

  let formattedLine = cleanContent;
  if (styleDigit >= '1' && styleDigit <= '6') {
    const eq = '='.repeat(Number(styleDigit));
    formattedLine = `${eq} ${cleanContent} ${eq}`;
  } else if (styleDigit === '7') {
    formattedLine = `<pre>${cleanContent}</pre>`;
  } else if (styleDigit === '8') {
    formattedLine = `<blockquote>${cleanContent}</blockquote>`;
  }

  const nextText = source.slice(0, lineStart) + formattedLine + source.slice(lineEnd);
  return { nextText, nextCursor: lineStart + formattedLine.length };
}

export function applyFindAndReplace(
  source: string,
  findText: string,
  replaceText: string,
  options: { matchCase?: boolean; replaceAll?: boolean; fromIndex?: number } = {}
): { nextText: string; count: number; matchStart: number; matchEnd: number } {
  if (!findText) {
    return { nextText: source, count: 0, matchStart: -1, matchEnd: -1 };
  }
  const { matchCase = false, replaceAll = false, fromIndex = 0 } = options;

  if (replaceAll) {
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, matchCase ? 'g' : 'gi');
    let count = 0;
    const nextText = source.replace(regex, () => {
      count += 1;
      return replaceText;
    });
    return { nextText, count, matchStart: -1, matchEnd: -1 };
  }

  const haystack = matchCase ? source : source.toLowerCase();
  const needle = matchCase ? findText : findText.toLowerCase();
  let idx = haystack.indexOf(needle, Math.max(0, fromIndex));
  if (idx === -1 && fromIndex > 0) {
    idx = haystack.indexOf(needle, 0);
  }
  if (idx === -1) {
    return { nextText: source, count: 0, matchStart: -1, matchEnd: -1 };
  }
  const nextText = source.slice(0, idx) + replaceText + source.slice(idx + findText.length);
  return {
    nextText,
    count: 1,
    matchStart: idx,
    matchEnd: idx + replaceText.length,
  };
}

interface WikiEditorProps {
  slug: string;
  currentUser: UserSession | null;
  onSaved: (slug: string) => void;
  onCancel: () => void;
  initialWikitext?: string;
  initialTitle?: string;
  initialMode?: EditorViewMode;
}

export const WikiEditor: React.FC<WikiEditorProps> = ({
  slug,
  currentUser,
  onSaved,
  onCancel,
  initialWikitext: initialWikitextProp,
  initialTitle: initialTitleProp,
  initialMode,
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

  // Live Parsoid Preview & Formatted Editor state
  const [activeTab, setActiveTab] = useState<EditorViewMode>(
    isVisualEditorEnabled ? (initialMode || 'split-formatted') : 'edit'
  );
  const [isToolbarFormattedMenuOpen, setIsToolbarFormattedMenuOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewTimeMs, setPreviewTimeMs] = useState<number>(0);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!isVisualEditorEnabled && activeTab !== 'edit') {
      setActiveTab('edit');
    }
  }, [isVisualEditorEnabled, activeTab]);

  useEffect(() => {
    if (isVisualEditorEnabled && initialMode) {
      setActiveTab(initialMode);
    }
  }, [initialMode, isVisualEditorEnabled]);

  // Infobox Software Builder Modal state
  const [isInfoboxModalOpen, setIsInfoboxModalOpen] = useState(false);
  const [infoboxModalTab, setInfoboxModalTab] = useState<'builder' | 'tutorial'>('builder');
  const [infoboxValues, setInfoboxValues] = useState<Record<string, string>>({});

  // Bibliographic Reference Manager Modal state
  const [isRefModalOpen, setIsRefModalOpen] = useState(false);

  // MediaWiki Template Manager Modal, Gestão de Predefinições Panel, Auto-Fix Assistant & Custom Namespace 10 Templates state
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isTemplateManagementOpen, setIsTemplateManagementOpen] = useState(false);
  const [isTemplateFixPanelOpen, setIsTemplateFixPanelOpen] = useState(false);
  const [isSpecialCharsOpen, setIsSpecialCharsOpen] = useState(false);
  const [isMetadataModalOpen, setIsMetadataModalOpen] = useState(false);
  const [isFindReplaceOpen, setIsFindReplaceOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [findMatchCase, setFindMatchCase] = useState(false);
  const [findStatusMessage, setFindStatusMessage] = useState<string | null>(null);
  const [cursorOffset, setCursorOffset] = useState<number>(0);
  const [customTemplates, setCustomTemplates] = useState<Article[]>([]);

  // Undo / Redo History stack state
  const historyRef = useRef<{ stack: string[]; index: number }>({ stack: [''], index: 0 });
  const [historyMeta, setHistoryMeta] = useState<{ canUndo: boolean; canRedo: boolean }>({
    canUndo: false,
    canRedo: false,
  });

  // Firestore Auto-Save state
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<string | null>(null);
  const [lastDraftSource, setLastDraftSource] = useState<'firestore' | 'local' | null>(null);
  const [recoverableDraft, setRecoverableDraft] = useState<ArticleDraft | null>(null);

  const wikitextTextareaRef = useRef<HTMLTextAreaElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const richEditorHandleRef = useRef<RichFormattedEditorHandle>(null);
  const selectionRangeRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
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
          historyRef.current = { stack: [art.wikitext], index: 0 };
          setHistoryMeta({ canUndo: false, canRedo: false });
          baselineRef.current = { title: art.title, wikitext: art.wikitext, summary: '' };
          lastPersistedSnapshotRef.current = JSON.stringify([art.title, art.wikitext, '', false]);
          setLoading(false);
          checkExistingDraft(art.title, art.wikitext);
        }
      })
      .catch(() => {
        // New article or new Predefinição template
        if (isMounted) {
          const defaultTitle = initialTitleProp?.trim() || slug.replace(/_/g, ' ');
          const parsedNewTitle = parseTitle(defaultTitle);
          const template =
            initialWikitextProp !== undefined && initialWikitextProp.trim().length > 0
              ? initialWikitextProp
              : parsedNewTitle.namespaceId === 10
              ? buildDefaultTemplatePageSkeleton(parsedNewTitle.baseTitle || defaultTitle)
              : `'''${defaultTitle}''' é um artigo no NotMediaWiki, parte do desenvolvimento de projetos WazzimaGiygg (wazzimagiygg.com).\n\n== Visão Geral ==\nEscreva o conteúdo aqui...\n\n== Referências ==\n<ref>[https://wazzimagiygg.com Portal WazzimaGiygg]</ref>\n`;
          setTitle(defaultTitle);
          setWikitext(template);
          setInitialWikitext('');
          historyRef.current = { stack: [template], index: 0 };
          setHistoryMeta({ canUndo: false, canRedo: false });
          baselineRef.current = { title: defaultTitle, wikitext: template, summary: '' };
          lastPersistedSnapshotRef.current = JSON.stringify([defaultTitle, template, '', false]);
          setLoading(false);
          checkExistingDraft(defaultTitle, template);
        }
      });

    return () => { isMounted = false; };
  }, [slug, effectiveUserId, isDraftAutosaveEnabled, isTemplatesEnabled, initialWikitextProp, initialTitleProp]);

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

  const commitWikitextChange = useCallback((nextText: string, recordHistory = true) => {
    latestEditorStateRef.current.wikitext = nextText;
    setWikitext(nextText);
    if (!recordHistory) return;

    const hist = historyRef.current;
    if (hist.stack[hist.index] === nextText) return;
    const trimmed = hist.stack.slice(0, hist.index + 1);
    trimmed.push(nextText);
    if (trimmed.length > 100) {
      trimmed.shift();
    }
    hist.stack = trimmed;
    hist.index = trimmed.length - 1;
    setHistoryMeta({
      canUndo: hist.index > 0,
      canRedo: hist.index < hist.stack.length - 1,
    });
  }, []);

  const handleUndo = useCallback(() => {
    const hist = historyRef.current;
    if (hist.index <= 0) return;
    hist.index -= 1;
    const target = hist.stack[hist.index];
    latestEditorStateRef.current.wikitext = target;
    setWikitext(target);
    setHistoryMeta({
      canUndo: hist.index > 0,
      canRedo: hist.index < hist.stack.length - 1,
    });
  }, []);

  const handleRedo = useCallback(() => {
    const hist = historyRef.current;
    if (hist.index >= hist.stack.length - 1) return;
    hist.index += 1;
    const target = hist.stack[hist.index];
    latestEditorStateRef.current.wikitext = target;
    setWikitext(target);
    setHistoryMeta({
      canUndo: hist.index > 0,
      canRedo: hist.index < hist.stack.length - 1,
    });
  }, []);

  const insertMarkup = (before: string, after: string = '', defaultText: string = '') => {
    const textarea = wikitextTextareaRef.current || (document.getElementById('wikitext-input') as HTMLTextAreaElement | null);
    if (!textarea) {
      const inserted = `${before}${defaultText}${after}`;
      const prev = latestEditorStateRef.current.wikitext;
      const next = !prev.trim()
        ? inserted.trimStart()
        : `${prev}${!prev.endsWith('\n') && !inserted.startsWith('\n') ? '\n\n' : ''}${inserted}`;
      commitWikitextChange(next);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = latestEditorStateRef.current.wikitext;
    const selected = currentText.substring(start, end) || defaultText;
    const replacement = `${before}${selected}${after}`;

    const updated = currentText.substring(0, start) + replacement + currentText.substring(end);
    commitWikitextChange(updated);

    const selStart = start + before.length;
    const selEnd = start + before.length + selected.length;
    selectionRangeRef.current = { start: selStart, end: selEnd };

    setTimeout(() => {
      const target = wikitextTextareaRef.current || (document.getElementById('wikitext-input') as HTMLTextAreaElement | null);
      if (!target) return;
      target.focus();
      target.setSelectionRange(selStart, selEnd);
      setCursorOffset(selEnd);
    }, 0);
  };

  const handleInsertSpecialCharacter = (char: string) => {
    if (!char) return;

    if (activeTab === 'formatted' && isVisualEditorEnabled && richEditorHandleRef.current) {
      richEditorHandleRef.current.insertText(char);
      return;
    }

    const textarea =
      wikitextTextareaRef.current ||
      (document.getElementById('wikitext-input') as HTMLTextAreaElement | null);

    const currentWikitext = latestEditorStateRef.current.wikitext;
    const hasLiveTextareaSelection =
      textarea !== null && typeof textarea.selectionStart === 'number';
    const start = hasLiveTextareaSelection
      ? textarea.selectionStart
      : selectionRangeRef.current.start;
    const end = hasLiveTextareaSelection
      ? (textarea.selectionEnd ?? textarea.selectionStart)
      : selectionRangeRef.current.end;

    const { nextText, nextCursor } = insertTextAtCursor(currentWikitext, char, start, end);
    selectionRangeRef.current = { start: nextCursor, end: nextCursor };
    commitWikitextChange(nextText);
    setCursorOffset(nextCursor);

    if (activeTab === 'preview' && isVisualEditorEnabled) {
      setActiveTab('split');
    }

    setTimeout(() => {
      const target =
        wikitextTextareaRef.current ||
        (document.getElementById('wikitext-input') as HTMLTextAreaElement | null);
      if (!target) return;
      target.focus();
      target.setSelectionRange(nextCursor, nextCursor);
    }, 0);
  };

  const handleApplyIndent = (direction: 'indent' | 'outdent') => {
    const textarea = wikitextTextareaRef.current || (document.getElementById('wikitext-input') as HTMLTextAreaElement | null);
    const start = textarea ? textarea.selectionStart : selectionRangeRef.current.start;
    const end = textarea ? (textarea.selectionEnd ?? textarea.selectionStart) : selectionRangeRef.current.end;
    const { nextText, nextStart, nextEnd } = applyLineIndentToWikitext(
      latestEditorStateRef.current.wikitext,
      start,
      end,
      direction
    );
    commitWikitextChange(nextText);
    selectionRangeRef.current = { start: nextStart, end: nextEnd };
    setTimeout(() => {
      const target = wikitextTextareaRef.current || (document.getElementById('wikitext-input') as HTMLTextAreaElement | null);
      if (!target) return;
      target.focus();
      target.setSelectionRange(nextStart, nextEnd);
      setCursorOffset(nextStart);
    }, 0);
  };

  const handleFindNext = () => {
    if (!findQuery) {
      setFindStatusMessage('Digite um termo para localizar.');
      return;
    }
    const source = latestEditorStateRef.current.wikitext;
    const haystack = findMatchCase ? source : source.toLowerCase();
    const needle = findMatchCase ? findQuery : findQuery.toLowerCase();
    const from = selectionRangeRef.current.end;
    let idx = haystack.indexOf(needle, from);
    if (idx === -1 && from > 0) idx = haystack.indexOf(needle, 0);
    if (idx === -1) {
      setFindStatusMessage('Nenhuma ocorrência encontrada.');
      return;
    }
    const matchEnd = idx + findQuery.length;
    setFindStatusMessage(`Ocorrência encontrada na posição ${idx}.`);
    focusAndSelectTextareaRange(idx, matchEnd);
  };

  const handleReplaceCurrent = () => {
    if (!findQuery) return;
    const res = applyFindAndReplace(latestEditorStateRef.current.wikitext, findQuery, replaceQuery, {
      matchCase: findMatchCase,
      fromIndex: selectionRangeRef.current.start,
    });
    if (res.count === 0) {
      setFindStatusMessage('Nenhuma ocorrência encontrada para substituir.');
      return;
    }
    commitWikitextChange(res.nextText);
    setFindStatusMessage('1 ocorrência substituída.');
    focusAndSelectTextareaRange(res.matchStart, res.matchEnd);
  };

  const handleReplaceAll = () => {
    if (!findQuery) return;
    const res = applyFindAndReplace(latestEditorStateRef.current.wikitext, findQuery, replaceQuery, {
      matchCase: findMatchCase,
      replaceAll: true,
    });
    if (res.count === 0) {
      setFindStatusMessage('Nenhuma ocorrência encontrada.');
      return;
    }
    commitWikitextChange(res.nextText);
    setFindStatusMessage(`${res.count} ocorrência(s) substituída(s).`);
  };

  const handleWikitextKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    if (e.key === 'Tab') {
      e.preventDefault();
      handleApplyIndent(e.shiftKey ? 'outdent' : 'indent');
      return;
    }

    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;

    if (e.altKey && e.key.toLowerCase() === 'm') {
      e.preventDefault();
      insertMarkup('<!-- ', ' -->', 'Comentário editorial oculto');
      return;
    }

    if (['0', '1', '2', '3', '4', '5', '6', '7', '8'].includes(e.key)) {
      e.preventDefault();
      const res = toggleWikitextBlockHierarchy(
        latestEditorStateRef.current.wikitext,
        textarea.selectionStart,
        e.key as '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8'
      );
      commitWikitextChange(res.nextText);
      focusAndSelectTextareaRange(res.nextCursor, res.nextCursor);
      return;
    }

    const lower = e.key.toLowerCase();
    if (lower === 'b') {
      e.preventDefault();
      insertMarkup("'''", "'''", 'negrito');
    } else if (lower === 'i') {
      e.preventDefault();
      insertMarkup("''", "''", 'itálico');
    } else if (lower === 'k') {
      e.preventDefault();
      insertMarkup('[[', ']]', 'Artigo destino');
    } else if (lower === 'z' && !e.shiftKey) {
      e.preventDefault();
      handleUndo();
    } else if (lower === 'y' || (lower === 'z' && e.shiftKey)) {
      e.preventDefault();
      handleRedo();
    } else if (lower === 'f') {
      e.preventDefault();
      setIsFindReplaceOpen(true);
      setTimeout(() => findInputRef.current?.focus(), 0);
    }
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
    const target = el || wikitextTextareaRef.current || (document.getElementById('wikitext-input') as HTMLTextAreaElement | null);
    if (target && typeof target.selectionStart === 'number') {
      const start = target.selectionStart;
      const end = target.selectionEnd ?? start;
      selectionRangeRef.current = { start, end };
      setCursorOffset(start);
    }
  };

  const focusAndSelectTextareaRange = (selStart: number, selEnd: number) => {
    if (activeTab === 'preview' && isVisualEditorEnabled) {
      setActiveTab('split');
    }
    selectionRangeRef.current = { start: selStart, end: selEnd };
    setTimeout(() => {
      const textarea = wikitextTextareaRef.current || (document.getElementById('wikitext-input') as HTMLTextAreaElement | null);
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
          <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded">
            {isVisualEditorEnabled && (
              <>
                <button
                  type="button"
                  data-testid="tab-split-formatted"
                  onClick={() => setActiveTab('split-formatted')}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'split-formatted'
                      ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-2xs font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Editar em código Wikitexto e Edição Formatada lado a lado com sincronização em tempo real"
                >
                  <PanelRight className="w-3 h-3" />
                  Código + Formatado
                </button>
                <button
                  type="button"
                  data-testid="tab-formatted"
                  onClick={() => setActiveTab('formatted')}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'formatted'
                      ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-2xs font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Edição visual formatada em tela cheia"
                >
                  <FileText className="w-3 h-3" />
                  Edição Formatada
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('split')}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'split'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Columns className="w-3 h-3" />
                  Dual Split
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('edit')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'edit'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Code className="w-3 h-3" />
              Wikitext
            </button>
            {isVisualEditorEnabled && (
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'preview'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
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
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t p-2 flex flex-wrap items-center gap-1 text-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-2">Markup:</span>
          {isVisualEditorEnabled && (
            <>
              <div className="relative">
                <button
                  type="button"
                  data-testid="toolbar-insert-formatted-btn"
                  onClick={() => setIsToolbarFormattedMenuOpen(prev => !prev)}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0 shadow-2xs"
                  title="Inserir bloco ou opção formatada diretamente no artigo (funciona em código e edição formatada)"
                >
                  <Plus className="w-3 h-3" />
                  <span>Inserir Formatado</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                {isToolbarFormattedMenuOpen && (
                  <div
                    data-testid="toolbar-insert-formatted-menu"
                    className="absolute left-0 top-full mt-1 z-40 w-72 max-h-80 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1.5 space-y-1"
                  >
                    {FORMATTED_INSERT_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          insertMarkup(opt.wikitextSnippet);
                          setIsToolbarFormattedMenuOpen(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer block"
                      >
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                          {opt.label}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {opt.description}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleUndo}
                disabled={!historyMeta.canUndo}
                data-testid="editor-undo-btn"
                className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer"
                title="Desfazer (Ctrl+Z)"
                aria-label="Desfazer alteração"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={!historyMeta.canRedo}
                data-testid="editor-redo-btn"
                className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer"
                title="Refazer (Ctrl+Y)"
                aria-label="Refazer alteração"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertMarkup('== ', ' ==', 'Section heading')}
                className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-200 font-medium"
                title="Cabeçalho de Seção (Ctrl+2)"
              >
                Heading
              </button>
              <button
                type="button"
                onClick={() => insertMarkup("'''", "'''", 'bold text')}
                className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-200 font-bold"
                title="Negrito (Ctrl+B)"
              >
                Bold
              </button>
              <button
                type="button"
                onClick={() => insertMarkup("''", "''", 'italic text')}
                className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-200 italic"
                title="Itálico (Ctrl+I)"
              >
                Italic
              </button>
              <button
                type="button"
                onClick={() => insertMarkup('<u>', '</u>', 'sublinhado')}
                className="px-1.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-200 underline text-[11px]"
                title="Sublinhado (<u>)"
              >
                U
              </button>
              <button
                type="button"
                onClick={() => insertMarkup('<s>', '</s>', 'tachado')}
                className="px-1.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-200 line-through text-[11px]"
                title="Tachado (<s>)"
              >
                S
              </button>
              <button
                type="button"
                onClick={() => insertMarkup('<sup>', '</sup>', '2')}
                className="px-1.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-200 text-[11px]"
                title="Sobrescrito (<sup>)"
              >
                x²
              </button>
              <button
                type="button"
                onClick={() => insertMarkup('<sub>', '</sub>', '2')}
                className="px-1.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-200 text-[11px]"
                title="Subscrito (<sub>)"
              >
                H₂
              </button>
              <button
                type="button"
                onClick={() => insertMarkup('[[', ']]', 'Article Title')}
                className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-blue-700 dark:text-blue-400 font-medium"
                title="Inserir link interno [[Artigo]] (Ctrl+K)"
              >
                [[Wikilink]]
              </button>
            </>
          )}
          {isTemplatesEnabled && (
            <>
              <button
                type="button"
                onClick={() => setIsTemplateManagementOpen(prev => !prev)}
                aria-expanded={isTemplateManagementOpen}
                data-testid="toggle-template-management-panel-btn"
                className={`px-2.5 py-1 border rounded font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                  isTemplateManagementOpen
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-800 dark:text-blue-200'
                }`}
                title="Abrir painel de Gestão de Predefinições para pré-visualizar e inserir blocos Wikidot (infobox, callout, navbox) e Wikipédia"
              >
                <Blocks className="w-3 h-3 shrink-0" />
                <span>Gestão de Predefinições</span>
              </button>

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

          <button
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={() => handleApplyIndent('outdent')}
            className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-200 cursor-pointer"
            title="Diminuir recuo (Shift+Tab)"
            aria-label="Diminuir recuo"
          >
            <IndentDecrease className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={() => handleApplyIndent('indent')}
            className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-200 cursor-pointer"
            title="Aumentar recuo (Tab)"
            aria-label="Aumentar recuo"
          >
            <IndentIncrease className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={() => insertMarkup('<!-- ', ' -->', 'Comentário editorial oculto')}
            className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-200 cursor-pointer"
            title="Inserir comentário oculto (Ctrl+Alt+M)"
            aria-label="Inserir comentário oculto"
          >
            <MessageSquareCode className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={() => insertMarkup(' ~~~~', '', '')}
            className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-200 cursor-pointer"
            title="Inserir assinatura editorial (~~~~)"
            aria-label="Inserir assinatura"
          >
            <PenLine className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={() => setIsSpecialCharsOpen(prev => !prev)}
            aria-expanded={isSpecialCharsOpen}
            data-testid="toggle-special-characters-btn"
            className={`px-2.5 py-1 border rounded font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              isSpecialCharsOpen
                ? 'bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-900'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}
            title="Inserir caracteres especiais (Usados recentemente, Símbolos, Latino, AFI/IPA, Grego, Cirílico e sistemas de escrita mundiais)"
          >
            <Languages className="w-3 h-3 shrink-0" />
            <span>Ω Caracteres</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsFindReplaceOpen(prev => {
                const next = !prev;
                if (next) setTimeout(() => findInputRef.current?.focus(), 0);
                return next;
              });
            }}
            aria-expanded={isFindReplaceOpen}
            data-testid="toggle-find-replace-btn"
            className={`px-2 py-1 border rounded font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              isFindReplaceOpen
                ? 'bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-900'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}
            title="Localizar e substituir texto (Ctrl+F)"
          >
            <Search className="w-3 h-3 shrink-0" />
            <span>Localizar</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMetadataModalOpen(true)}
            data-testid="open-page-metadata-btn"
            className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-200 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0"
            title="Metadados da Página: Categorias, Configurações da página, Configurações avançadas, Idiomas e Predefinições usadas"
          >
            <Settings2 className="w-3 h-3 shrink-0" />
            <span>Metadados</span>
          </button>

          {isVisualEditorEnabled && (
            <div className="ml-auto flex items-center gap-2 text-[11px] text-slate-500 font-mono">
              <span>Parsoid preview:</span>
              <span className="text-emerald-700 font-semibold">{previewTimeMs}ms</span>
            </div>
          )}
        </div>

        {/* Inline Find & Replace Bar (Ctrl+F) */}
        {isFindReplaceOpen && (
          <div
            data-testid="find-replace-bar"
            className="px-3 py-2 border-x border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/95 flex flex-wrap items-center gap-2 text-xs"
          >
            <input
              ref={findInputRef}
              type="text"
              value={findQuery}
              onChange={e => setFindQuery(e.target.value)}
              placeholder="Localizar..."
              aria-label="Texto para localizar"
              className="px-2.5 py-1 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600"
            />
            <input
              type="text"
              value={replaceQuery}
              onChange={e => setReplaceQuery(e.target.value)}
              placeholder="Substituir por..."
              aria-label="Texto para substituir"
              className="px-2.5 py-1 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600"
            />
            <label className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={findMatchCase}
                onChange={e => setFindMatchCase(e.target.checked)}
                className="rounded text-blue-600"
              />
              <span>Diferenciar maiúsc./minúsc.</span>
            </label>
            <button
              type="button"
              onClick={handleFindNext}
              className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded font-medium cursor-pointer"
            >
              Próximo
            </button>
            <button
              type="button"
              onClick={handleReplaceCurrent}
              className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded font-medium cursor-pointer"
            >
              Substituir
            </button>
            <button
              type="button"
              onClick={handleReplaceAll}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold cursor-pointer"
            >
              Substituir Tudo
            </button>
            {findStatusMessage && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {findStatusMessage}
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsFindReplaceOpen(false)}
              aria-label="Fechar localizar e substituir"
              className="ml-auto p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Inline Special Characters Menu (30 script/symbol groups) */}
        {isSpecialCharsOpen && (
          <SpecialCharactersMenu
            onSelectCharacter={handleInsertSpecialCharacter}
            onClose={() => setIsSpecialCharsOpen(false)}
          />
        )}

        {/* Inline Gestão de Predefinições (Wikidot + Wikipédia + NS10) */}
        {isTemplatesEnabled && isTemplateManagementOpen && (
          <TemplateManagementPanel
            customTemplates={customTemplates}
            pageTitle={title}
            onInsertCode={snippet => insertMarkup(`${snippet}\n`)}
            onOpenFullCatalog={() => setIsTemplateModalOpen(true)}
            onClose={() => setIsTemplateManagementOpen(false)}
          />
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
        <div
          className={`grid border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 ${
            (activeTab === 'split' || activeTab === 'split-formatted') && isVisualEditorEnabled
              ? 'grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800'
              : 'grid-cols-1'
          }`}
        >
          {/* Source Input (Wikitext Code) */}
          {(activeTab === 'split' || activeTab === 'split-formatted' || activeTab === 'edit' || !isVisualEditorEnabled) && (
            <div className="flex flex-col">
              {activeTab === 'split-formatted' && isVisualEditorEnabled && (
                <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5 text-slate-500" />
                    Código Wikitexto
                  </span>
                  <span className="font-mono text-slate-400">Sincronizado lado a lado</span>
                </div>
              )}
              <div className="p-2 flex-1">
                <textarea
                  ref={wikitextTextareaRef}
                  id="wikitext-input"
                  value={wikitext}
                  onChange={e => {
                    const nextStart = e.target.selectionStart ?? 0;
                    const nextEnd = e.target.selectionEnd ?? nextStart;
                    selectionRangeRef.current = { start: nextStart, end: nextEnd };
                    commitWikitextChange(e.target.value);
                    setCursorOffset(nextStart);
                  }}
                  onKeyDown={handleWikitextKeyDown}
                  onClick={e => syncCursorFromTextarea(e.currentTarget)}
                  onKeyUp={e => syncCursorFromTextarea(e.currentTarget)}
                  onSelect={e => syncCursorFromTextarea(e.currentTarget)}
                  onBlur={e => syncCursorFromTextarea(e.currentTarget)}
                  rows={22}
                  className="w-full h-full min-h-[460px] p-3 font-mono text-xs text-slate-800 dark:text-slate-100 bg-transparent leading-relaxed outline-none resize-y placeholder:text-slate-400"
                  placeholder="Type MediaWiki markup here..."
                />
              </div>
            </div>
          )}

          {/* Interactive Formatted WYSIWYG Editor (Standalone or Side-by-Side) */}
          {isVisualEditorEnabled && (activeTab === 'split-formatted' || activeTab === 'formatted') && (
            <div className="flex flex-col min-w-0">
              <div className="px-3 py-1.5 border-b border-emerald-200/70 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/30 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Edição Formatada (Visual)
                </span>
                <span className="font-mono text-emerald-700/80 dark:text-emerald-400/80">
                  WYSIWYG ↔ Wikitexto
                </span>
              </div>
              <RichFormattedEditor
                ref={richEditorHandleRef}
                wikitext={wikitext}
                onChange={next => commitWikitextChange(next)}
                disabled={Boolean(currentUser?.isBanned || currentUser?.role === 'reader')}
                onOpenTemplateManager={isTemplatesEnabled ? () => setIsTemplateModalOpen(true) : undefined}
                onOpenInfoboxBuilder={isInfoboxEnabled ? openInfoboxBuilder : undefined}
                onOpenReferenceManager={isCiteEnabled ? () => setIsRefModalOpen(true) : undefined}
                onUndo={handleUndo}
                onRedo={handleRedo}
                onToggleFindReplace={() => {
                  setIsFindReplaceOpen(true);
                  setTimeout(() => findInputRef.current?.focus(), 0);
                }}
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

      {/* Page Metadata & Options Modal (Categories, Page Settings, Advanced, Languages, Used Templates) */}
      <PageMetadataModal
        isOpen={isMetadataModalOpen}
        wikitext={wikitext}
        pageTitle={title}
        onUpdateWikitext={next => commitWikitextChange(next)}
        onClose={() => setIsMetadataModalOpen(false)}
      />
    </div>
  );
};
