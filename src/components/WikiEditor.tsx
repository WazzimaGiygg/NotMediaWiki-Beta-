import React, { useState, useEffect, useRef } from 'react';
import { Save, Eye, Code, ArrowLeft, AlertCircle, CheckCircle, HelpCircle, Columns, Sparkles } from 'lucide-react';
import { Article, UserSession } from '../types';
import { api } from '../api';
import { syncMediaWikiToFirestore, recordDailyChecklistAction } from '../firebase';
import { enhanceCodeBlocks } from '../utils/syntaxHighlighter';

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

  // Live Parsoid Preview state
  const [activeTab, setActiveTab] = useState<'split' | 'edit' | 'preview'>('split');
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewTimeMs, setPreviewTimeMs] = useState<number>(0);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    api.getArticle(slug)
      .then(art => {
        if (isMounted) {
          setTitle(art.title);
          setWikitext(art.wikitext);
          setLoading(false);
        }
      })
      .catch(() => {
        // New article template
        if (isMounted) {
          setTitle(slug.replace(/_/g, ' '));
          setWikitext(`'''${slug.replace(/_/g, ' ')}''' é um artigo no NotMediaWiki, parte do desenvolvimento de projetos WazzimaGiygg (wazzimagiygg.com).\n\n== Visão Geral ==\nEscreva o conteúdo aqui...\n\n== Referências ==\n<ref>[https://wazzimagiygg.com Portal WazzimaGiygg]</ref>\n`);
          setLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [slug]);

  // Live Parsoid parse preview effect
  useEffect(() => {
    if (!wikitext) return;
    const timer = setTimeout(() => {
      api.parseWikitext(wikitext, title)
        .then(res => {
          setPreviewHtml(res.html);
          setPreviewTimeMs(res.parseTimeMs);
          setPreviewError(null);
        })
        .catch(err => setPreviewError(err.message));
    }, 250);
    return () => clearTimeout(timer);
  }, [wikitext, title]);

  const previewRef = useRef<HTMLDivElement>(null);

  // Enhance code blocks in preview pane with syntax highlighting
  useEffect(() => {
    if (!previewRef.current || !previewHtml) return;
    enhanceCodeBlocks(previewRef.current);
  }, [previewHtml, activeTab]);

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
    }, 0);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setSaving(true);

    try {
      const cleanSlug = title.trim().replace(/\s+/g, '_');
      const res = await api.saveArticle({
        slug: cleanSlug,
        title: title.trim(),
        wikitext,
        comment: summary.trim() || 'Updated wikitext via Node.js Parsoid editor',
        isMinor,
        authorUser: currentUser,
      });

      // 3.05.8.b.b: Conceder 0.20 ponto diário por contribuição
      if (currentUser) {
        recordDailyChecklistAction(currentUser.id, currentUser.username, 'contribution', {
          articleSlug: cleanSlug,
        }).catch(console.warn);
      }

      setSuccessMessage(`Artigo "${res.article.title}" salvo com sucesso no Firebase Firestore! (+0.20 pt no Checklist Diário - 3.05.8.b.b)`);
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

        {/* View Layout Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded">
          <button
            onClick={() => setActiveTab('split')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
              activeTab === 'split' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Columns className="w-3 h-3" />
            Dual Split
          </button>
          <button
            onClick={() => setActiveTab('edit')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
              activeTab === 'edit' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code className="w-3 h-3" />
            Wikitext
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
              activeTab === 'preview' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Eye className="w-3 h-3" />
            Parsoid Preview
          </button>
        </div>
      </div>

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

      <form onSubmit={handleSave}>
        {/* Wikitext Syntax Quick-Bar */}
        <div className="bg-slate-50 border border-slate-200 rounded-t p-2 flex flex-wrap items-center gap-1 text-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-2">Markup:</span>
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
          <button
            type="button"
            onClick={() => insertMarkup('{{Infobox software\n| name = \n| developer = \n}}\n')}
            className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-700 font-mono text-[11px]"
          >
            {'{Infobox}'}
          </button>
          <button
            type="button"
            onClick={() => insertMarkup('{| class="wikitable"\n! Header 1 !! Header 2\n|-\n| Cell 1 || Cell 2\n|}\n')}
            className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-700 font-mono text-[11px]"
          >
            {'{| Table |}'}
          </button>
          <button
            type="button"
            onClick={() => insertMarkup('<ref>', '</ref>', 'Citation source')}
            className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-700 font-mono text-[11px]"
          >
            &lt;ref&gt;
          </button>
          <button
            type="button"
            onClick={() => insertMarkup('* ', '', 'Bullet item')}
            className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-700 font-medium"
          >
            * List
          </button>
          <button
            type="button"
            onClick={() => insertMarkup('<syntaxhighlight lang="typescript">\n', '\n</syntaxhighlight>\n', '// Escreva seu código aqui\nconst answer: number = 42;')}
            className="px-2 py-1 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded text-blue-700 font-mono text-[11px] font-semibold"
            title="Inserir bloco de código formatado com realce de sintaxe"
          >
            &lt;code&gt; Syntax
          </button>

          <div className="ml-auto flex items-center gap-2 text-[11px] text-slate-500 font-mono">
            <span>Parsoid preview:</span>
            <span className="text-emerald-700 font-semibold">{previewTimeMs}ms</span>
          </div>
        </div>

        {/* Editor Main Content Area */}
        <div className={`grid border-x border-b border-slate-200 bg-white ${
          activeTab === 'split' ? 'grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200' : 'grid-cols-1'
        }`}>
          {/* Source Input */}
          {(activeTab === 'split' || activeTab === 'edit') && (
            <div className="p-2">
              <textarea
                id="wikitext-input"
                value={wikitext}
                onChange={e => setWikitext(e.target.value)}
                rows={22}
                className="w-full h-full min-h-[460px] p-3 font-mono text-xs text-slate-800 leading-relaxed outline-none resize-y placeholder:text-slate-400"
                placeholder="Type MediaWiki markup here..."
              />
            </div>
          )}

          {/* Live Parsoid HTML Render */}
          {(activeTab === 'split' || activeTab === 'preview') && (
            <div className="p-4 bg-slate-50/40 overflow-y-auto max-h-[520px]">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 pb-1 border-b border-slate-200 flex items-center justify-between">
                <span>Parsoid AST Rendered Output</span>
                <span className="font-mono text-slate-400 font-normal">HTML5 DOM</span>
              </div>
              {previewError ? (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded">{previewError}</div>
              ) : (
                <div
                  ref={previewRef}
                  className="wiki-content prose max-w-none text-slate-800 font-serif text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: previewHtml || '<p class="text-slate-400 italic">No content to render</p>' }}
                />
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
              Author: <span className="font-semibold text-slate-800">{currentUser?.username}</span> · Role: <span className="font-mono text-slate-700">{currentUser?.role}</span>
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
                disabled={saving || currentUser?.isBanned}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {currentUser?.isBanned
                  ? 'Bloqueado (Usuário Banido)'
                  : saving
                  ? 'Committing Revision...'
                  : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
