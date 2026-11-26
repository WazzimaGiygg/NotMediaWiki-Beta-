import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Code,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  AlignJustify,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link2,
  Quote,
  Plus,
  ChevronDown,
  Table,
  Sparkles,
  BookOpen,
  Blocks,
} from 'lucide-react';
import {
  FORMATTED_INSERT_OPTIONS,
  FormattedInsertOption,
  editableHtmlToWikitext,
  wikitextToEditableHtml,
} from '../utils/wikitextRichConverter';

export interface RichFormattedEditorHandle {
  insertText: (text: string) => void;
}

interface RichFormattedEditorProps {
  wikitext: string;
  onChange: (nextWikitext: string) => void;
  disabled?: boolean;
  compact?: boolean;
  minHeightClass?: string;
  onOpenTemplateManager?: () => void;
  onOpenInfoboxBuilder?: () => void;
  onOpenReferenceManager?: () => void;
}

export const RichFormattedEditor = forwardRef<RichFormattedEditorHandle, RichFormattedEditorProps>(({
  wikitext,
  onChange,
  disabled = false,
  compact = false,
  minHeightClass = 'min-h-[460px] max-h-[520px]',
  onOpenTemplateManager,
  onOpenInfoboxBuilder,
  onOpenReferenceManager,
}, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmittedWikitextRef = useRef<string | null>(null);
  const savedRangeRef = useRef<Range | null>(null);

  const [isInsertMenuOpen, setIsInsertMenuOpen] = useState(false);
  const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false);
  const [linkTarget, setLinkTarget] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkKind, setLinkKind] = useState<'wiki' | 'external'>('wiki');

  // Synchronize external wikitext changes (from Code pane, templates, draft restore, or load)
  // without resetting the user's cursor when edits originate inside this Formatted Editor.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (lastEmittedWikitextRef.current === wikitext) {
      return;
    }
    const html = wikitextToEditableHtml(wikitext);
    if (el.innerHTML !== html) {
      el.innerHTML = html;
    }
    lastEmittedWikitextRef.current = wikitext;
  }, [wikitext]);

  const saveCurrentSelection = () => {
    const el = editorRef.current;
    if (!el || typeof window === 'undefined') return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (el.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();
      }
    }
  };

  const restoreSelectionOrFocusEnd = () => {
    const el = editorRef.current;
    if (!el || typeof window === 'undefined') return;
    el.focus();
    const sel = window.getSelection();
    if (!sel) return;
    if (savedRangeRef.current && el.contains(savedRangeRef.current.commonAncestorContainer)) {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    } else {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  };

  const syncFromDom = () => {
    const el = editorRef.current;
    if (!el) return;
    const nextWikitext = editableHtmlToWikitext(el);
    lastEmittedWikitextRef.current = nextWikitext;
    onChange(nextWikitext);
  };

  const runExecCommand = (command: string, value?: string) => {
    if (disabled) return;
    restoreSelectionOrFocusEnd();
    try {
      document.execCommand(command, false, value);
    } catch {
      // Ignore unsupported execCommand in synthetic environments
    }
    saveCurrentSelection();
    syncFromDom();
  };

  const applyParagraphAlignment = (align: 'justify' | 'left' | 'center' | 'right') => {
    if (disabled) return;
    restoreSelectionOrFocusEnd();
    const el = editorRef.current;
    if (!el) return;

    const sel = window.getSelection();
    let targetBlock: HTMLElement | null = null;
    if (sel && sel.rangeCount > 0) {
      let node: Node | null = sel.getRangeAt(0).startContainer;
      while (node && node !== el) {
        if (
          node.nodeType === 1 &&
          ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'LI'].includes((node as HTMLElement).tagName)
        ) {
          targetBlock = node as HTMLElement;
          break;
        }
        node = node.parentNode;
      }
    }

    if (targetBlock && targetBlock !== el) {
      if (align === 'justify') {
        targetBlock.style.removeProperty('text-align');
        targetBlock.removeAttribute('align');
      } else {
        targetBlock.style.textAlign = align;
        targetBlock.removeAttribute('align');
      }
    } else {
      const cmdMap = {
        justify: 'justifyFull',
        left: 'justifyLeft',
        center: 'justifyCenter',
        right: 'justifyRight',
      };
      try {
        document.execCommand(cmdMap[align], false);
      } catch {
        // Fallback no-op
      }
    }
    saveCurrentSelection();
    syncFromDom();
  };

  const insertHtmlFragmentAtSelection = (htmlFragment: string) => {
    if (disabled) return;
    const el = editorRef.current;
    if (!el) return;
    restoreSelectionOrFocusEnd();

    const sel = window.getSelection();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = htmlFragment;
    const nodes = Array.from(wrapper.childNodes);
    if (nodes.length === 0) return;

    if (sel && sel.rangeCount > 0 && el.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const frag = document.createDocumentFragment();
      let lastInserted: Node | null = null;
      for (const n of nodes) {
        lastInserted = frag.appendChild(n);
      }
      range.insertNode(frag);
      if (lastInserted) {
        const afterRange = document.createRange();
        afterRange.setStartAfter(lastInserted);
        afterRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(afterRange);
      }
    } else {
      for (const n of nodes) {
        el.appendChild(n);
      }
    }

    saveCurrentSelection();
    syncFromDom();
  };

  const insertPlainTextAtSelection = (text: string) => {
    if (disabled || !text) return;
    const el = editorRef.current;
    if (!el) return;
    restoreSelectionOrFocusEnd();

    const sel = typeof window !== 'undefined' ? window.getSelection() : null;
    if (sel && sel.rangeCount > 0 && el.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      const afterRange = document.createRange();
      afterRange.setStartAfter(textNode);
      afterRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(afterRange);
    } else {
      el.appendChild(document.createTextNode(text));
    }

    saveCurrentSelection();
    syncFromDom();
  };

  useImperativeHandle(ref, () => ({
    insertText: insertPlainTextAtSelection,
  }));

  const handleInsertFormattedOption = (option: FormattedInsertOption) => {
    setIsInsertMenuOpen(false);
    const fragmentHtml = wikitextToEditableHtml(option.wikitextSnippet.trim());
    insertHtmlFragmentAtSelection(fragmentHtml);
  };

  const handleInsertInlineCode = () => {
    if (disabled) return;
    restoreSelectionOrFocusEnd();
    const sel = window.getSelection();
    const selectedText = sel?.toString().trim() || 'código';
    insertHtmlFragmentAtSelection(
      `<code class="bg-slate-100 dark:bg-slate-800 text-pink-600 dark:text-pink-400 px-1 py-0.5 rounded text-xs font-mono">${selectedText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>`
    );
  };

  const handleInsertBlockquote = () => {
    if (disabled) return;
    restoreSelectionOrFocusEnd();
    const sel = window.getSelection();
    const selectedText = sel?.toString().trim() || 'Texto citado em destaque.';
    insertHtmlFragmentAtSelection(
      `<blockquote>${selectedText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</blockquote>`
    );
  };

  const handleConfirmLinkInsert = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTarget = linkTarget.trim();
    if (!cleanTarget) return;
    const cleanLabel = linkLabel.trim() || cleanTarget;

    if (linkKind === 'wiki') {
      const slug = cleanTarget.replace(/\s+/g, '_');
      insertHtmlFragmentAtSelection(
        `<a href="#/wiki/${encodeURIComponent(slug)}" data-wiki-target="${cleanTarget.replace(/"/g, '&quot;')}" class="wiki-link text-blue-700 dark:text-blue-400 underline font-medium">${cleanLabel.replace(/</g, '&lt;')}</a>`
      );
    } else {
      const url = /^https?:\/\//i.test(cleanTarget) ? cleanTarget : `https://${cleanTarget}`;
      insertHtmlFragmentAtSelection(
        `<a href="${url.replace(/"/g, '&quot;')}" data-ext-url="${url.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer" class="external-link text-blue-600 dark:text-blue-400 underline">${cleanLabel.replace(/</g, '&lt;')}</a>`
      );
    }

    setLinkTarget('');
    setLinkLabel('');
    setIsLinkPopoverOpen(false);
  };

  return (
    <div
      data-testid="rich-formatted-editor"
      className="flex flex-col bg-white dark:bg-slate-900"
    >
      {/* Formatting & "Inserir Opção Formatada" Toolbar */}
      <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 flex flex-wrap items-center gap-1 text-xs relative">
        {/* Heading / Paragraph controls */}
        <div className="flex items-center gap-0.5 pr-1.5 mr-1 border-r border-slate-200 dark:border-slate-700">
          <button
            type="button"
            disabled={disabled}
            onMouseDown={e => e.preventDefault()}
            onClick={() => runExecCommand('formatBlock', 'P')}
            className="px-2 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium cursor-pointer disabled:opacity-50"
            title="Parágrafo normal (alinhamento justificado por padrão)"
          >
            Texto
          </button>
          <button
            type="button"
            disabled={disabled}
            onMouseDown={e => e.preventDefault()}
            onClick={() => runExecCommand('formatBlock', 'H2')}
            className="p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer disabled:opacity-50"
            title="Título de Seção (H2)"
          >
            <Heading2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onMouseDown={e => e.preventDefault()}
            onClick={() => runExecCommand('formatBlock', 'H3')}
            className="p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer disabled:opacity-50"
            title="Subtítulo (H3)"
          >
            <Heading3 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Inline text formatting */}
        <div className="flex items-center gap-0.5 pr-1.5 mr-1 border-r border-slate-200 dark:border-slate-700">
          <button
            type="button"
            disabled={disabled}
            onMouseDown={e => e.preventDefault()}
            onClick={() => runExecCommand('bold')}
            className="p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer disabled:opacity-50"
            title="Negrito ('''texto''')"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onMouseDown={e => e.preventDefault()}
            onClick={() => runExecCommand('italic')}
            className="p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer disabled:opacity-50"
            title="Itálico (''texto'')"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onMouseDown={e => e.preventDefault()}
            onClick={handleInsertInlineCode}
            className="p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer disabled:opacity-50"
            title="Código inline (`código`)"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onMouseDown={e => e.preventDefault()}
            onClick={() => {
              saveCurrentSelection();
              const selText = typeof window !== 'undefined' ? window.getSelection()?.toString().trim() || '' : '';
              if (selText && !linkLabel) setLinkLabel(selText);
              setIsLinkPopoverOpen(prev => !prev);
            }}
            className="p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-blue-700 dark:text-blue-400 cursor-pointer disabled:opacity-50"
            title="Inserir link interno ou externo formatado"
          >
            <Link2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Lists & Quote */}
        <div className="flex items-center gap-0.5 pr-1.5 mr-1 border-r border-slate-200 dark:border-slate-700">
          <button
            type="button"
            disabled={disabled}
            onMouseDown={e => e.preventDefault()}
            onClick={() => runExecCommand('insertUnorderedList')}
            className="p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer disabled:opacity-50"
            title="Lista com marcadores (* item)"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onMouseDown={e => e.preventDefault()}
            onClick={() => runExecCommand('insertOrderedList')}
            className="p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer disabled:opacity-50"
            title="Lista numerada (# item)"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onMouseDown={e => e.preventDefault()}
            onClick={handleInsertBlockquote}
            className="p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer disabled:opacity-50"
            title="Citação (<blockquote>)"
          >
            <Quote className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Paragraph Alignment */}
        <div className="flex items-center gap-0.5 pr-1.5 mr-1 border-r border-slate-200 dark:border-slate-700">
          <button
            type="button"
            disabled={disabled}
            onMouseDown={e => e.preventDefault()}
            onClick={() => applyParagraphAlignment('justify')}
            className="p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer disabled:opacity-50"
            title="Alinhamento justificado (padrão do artigo)"
          >
            <AlignJustify className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onMouseDown={e => e.preventDefault()}
            onClick={() => applyParagraphAlignment('left')}
            className="p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer disabled:opacity-50"
            title="Alinhar à esquerda"
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onMouseDown={e => e.preventDefault()}
            onClick={() => applyParagraphAlignment('center')}
            className="p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer disabled:opacity-50"
            title="Centralizar parágrafo"
          >
            <AlignCenter className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onMouseDown={e => e.preventDefault()}
            onClick={() => applyParagraphAlignment('right')}
            className="p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer disabled:opacity-50"
            title="Alinhar à direita"
          >
            <AlignRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Dedicated "Inserir Opção Formatada" Menu */}
        <div className="relative">
          <button
            type="button"
            disabled={disabled}
            data-testid="insert-formatted-menu-btn"
            onMouseDown={e => e.preventDefault()}
            onClick={() => {
              saveCurrentSelection();
              setIsInsertMenuOpen(prev => !prev);
            }}
            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] flex items-center gap-1 cursor-pointer shadow-2xs disabled:opacity-50 whitespace-nowrap"
            title="Inserir bloco ou estrutura formatada diretamente no artigo"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Inserir Formatado</span>
            <ChevronDown className="w-3 h-3" />
          </button>

          {isInsertMenuOpen && (
            <div
              data-testid="insert-formatted-menu"
              className="absolute left-0 top-full mt-1.5 z-40 w-80 max-h-96 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-2 space-y-2"
            >
              <div className="px-2 py-1 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  Inserir Opção Formatada
                </span>
                <button
                  type="button"
                  onClick={() => setIsInsertMenuOpen(false)}
                  className="text-[11px] text-slate-400 hover:text-slate-600 px-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {(['estrutura', 'alinhamento', 'listas', 'blocos'] as const).map(cat => {
                const items = FORMATTED_INSERT_OPTIONS.filter(opt => opt.category === cat);
                const catLabels = {
                  estrutura: 'Seções & Estrutura',
                  alinhamento: 'Alinhamento de Parágrafo',
                  listas: 'Listas Formatadas',
                  blocos: 'Tabelas, Caixas & Referências',
                };
                return (
                  <div key={cat} className="space-y-1">
                    <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {catLabels[cat]}
                    </div>
                    {items.map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => handleInsertFormattedOption(opt)}
                        className="w-full text-left px-2.5 py-1.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer block"
                      >
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                          {opt.label}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                          {opt.description}
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })}

              {(onOpenTemplateManager || onOpenInfoboxBuilder || onOpenReferenceManager) && (
                <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Assistentes Avançados
                  </div>
                  {onOpenTemplateManager && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsInsertMenuOpen(false);
                        onOpenTemplateManager();
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-2 cursor-pointer"
                    >
                      <Blocks className="w-3.5 h-3.5" />
                      Catálogo de Predefinições ({'{{...}}'})
                    </button>
                  )}
                  {onOpenInfoboxBuilder && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsInsertMenuOpen(false);
                        onOpenInfoboxBuilder();
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40 text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2 cursor-pointer"
                    >
                      <Table className="w-3.5 h-3.5" />
                      Construtor de Infobox Software
                    </button>
                  )}
                  {onOpenReferenceManager && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsInsertMenuOpen(false);
                        onOpenReferenceManager();
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-2 cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      Gestor de Referências (&lt;ref&gt;)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {!compact && (
          <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-500 hidden sm:inline">
            Edição visual sincronizada com Wikitexto
          </span>
        )}
      </div>

      {/* Inline Link Insertion Bar */}
      {isLinkPopoverOpen && (
        <form
          onSubmit={handleConfirmLinkInsert}
          className="px-3 py-2 bg-blue-50/80 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-800 flex flex-wrap items-center gap-2 text-xs"
        >
          <select
            value={linkKind}
            onChange={e => setLinkKind(e.target.value as 'wiki' | 'external')}
            className="bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 rounded px-2 py-1 text-xs"
          >
            <option value="wiki">Link Interno [[Artigo]]</option>
            <option value="external">Link Externo [https://...]</option>
          </select>
          <input
            type="text"
            value={linkTarget}
            onChange={e => setLinkTarget(e.target.value)}
            placeholder={linkKind === 'wiki' ? 'Nome do artigo destino' : 'https://exemplo.com'}
            className="flex-1 min-w-[150px] bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 rounded px-2.5 py-1 text-xs outline-none"
            autoFocus
          />
          <input
            type="text"
            value={linkLabel}
            onChange={e => setLinkLabel(e.target.value)}
            placeholder="Texto exibido (opcional)"
            className="w-40 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 rounded px-2.5 py-1 text-xs outline-none"
          />
          <button
            type="submit"
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold cursor-pointer"
          >
            Inserir Link
          </button>
          <button
            type="button"
            onClick={() => setIsLinkPopoverOpen(false)}
            className="px-2 py-1 text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            Cancelar
          </button>
        </form>
      )}

      {/* Editable Formatted Surface */}
      <div
        ref={editorRef}
        role="textbox"
        aria-multiline="true"
        aria-label="Editor de edição formatada do artigo"
        data-testid="rich-formatted-surface"
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={syncFromDom}
        onKeyUp={saveCurrentSelection}
        onMouseUp={saveCurrentSelection}
        onBlur={syncFromDom}
        className={`wiki-content text-justify prose max-w-none p-4 overflow-y-auto outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500/30 text-slate-800 dark:text-slate-200 font-serif text-sm leading-relaxed ${minHeightClass}`}
      />
    </div>
  );
});

RichFormattedEditor.displayName = 'RichFormattedEditor';

export default RichFormattedEditor;
