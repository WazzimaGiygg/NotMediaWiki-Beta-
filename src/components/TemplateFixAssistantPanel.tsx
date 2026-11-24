import React from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  LocateFixed,
  Plus,
  Wand2,
  X,
  XCircle,
} from 'lucide-react';
import {
  ActiveCursorTemplateContext,
  ExpectedTemplateParamInfo,
  TemplateCorrectionSuggestion,
  TemplateFixIssueType,
} from '../services/templateService';

export interface TemplateFixAssistantPanelProps {
  suggestions: TemplateCorrectionSuggestion[];
  activeCursorTemplate: ActiveCursorTemplateContext | null;
  onApplyFix: (suggestion: TemplateCorrectionSuggestion) => void;
  onApplyAllFixes: () => void;
  onInsertParam: (
    range: { start: number; end: number; isUnclosed?: boolean },
    param: ExpectedTemplateParamInfo
  ) => void;
  onLocateRange: (start: number, end: number) => void;
  onOpenTemplateManager?: () => void;
  onClose: () => void;
}

const ISSUE_TYPE_META: Record<
  TemplateFixIssueType,
  { label: string; isError: boolean }
> = {
  unclosed_braces: { label: 'Chaves sem fechamento / abertura incompleta', isError: true },
  unmatched_closing: { label: 'Chaves de fechamento excedentes', isError: true },
  invalid_name: { label: 'Nome de pré-definição inválido', isError: true },
  unknown_template: { label: 'Pré-definição não reconhecida', isError: true },
  missing_required_param: { label: 'Parâmetro obrigatório ausente', isError: false },
  unresolved_param: { label: 'Placeholder {{{...}}} sem valor', isError: false },
};

const ExpectedParamsList: React.FC<{
  params: ExpectedTemplateParamInfo[];
  templateRange?: { start: number; end: number; isUnclosed?: boolean };
  onInsertParam?: (
    range: { start: number; end: number; isUnclosed?: boolean },
    param: ExpectedTemplateParamInfo
  ) => void;
}> = ({ params, templateRange, onInsertParam }) => {
  if (!params || params.length === 0) return null;

  return (
    <div
      className="mt-2 rounded border border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-900/60 p-2.5 space-y-1.5"
      data-testid="expected-params-list"
    >
      <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
        Parâmetros esperados (templateService.ts):
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
        {params.map(param => {
          const isPositional = /^\d+$/.test(param.name);
          const displayKey = isPositional ? `Posição ${param.name}` : `| ${param.name}`;
          return (
            <div
              key={param.name}
              className="flex items-start justify-between gap-2 rounded border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-950/70 px-2 py-1.5 text-[11px]"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <code className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {displayKey}
                  </code>
                  <span className="text-slate-600 dark:text-slate-300 truncate">
                    {param.label !== param.name ? `· ${param.label}` : ''}
                  </span>
                  <span
                    className={
                      param.required
                        ? 'font-semibold text-rose-700 dark:text-rose-300'
                        : 'text-slate-500 dark:text-slate-400'
                    }
                  >
                    ({param.required ? 'obrigatório' : 'opcional'})
                  </span>
                </div>
                {param.description && (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                    {param.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 text-[10px]">
                  {param.present ? (
                    <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                      <Check className="w-3 h-3" />
                      <span>Presente{param.currentValue ? `: "${param.currentValue}"` : ''}</span>
                    </span>
                  ) : (
                    <span className="font-medium text-amber-800 dark:text-amber-300">
                      Ausente
                      {param.defaultValue ? ` · padrão: "${param.defaultValue}"` : ''}
                    </span>
                  )}
                </div>
              </div>

              {!param.present && templateRange && onInsertParam && (
                <button
                  type="button"
                  onClick={() => onInsertParam(templateRange, param)}
                  className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-[10px] font-semibold cursor-pointer transition-colors"
                  title={`Inserir parâmetro ${param.name} nesta chamada`}
                >
                  <Plus className="w-3 h-3" />
                  <span>{param.name}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const TemplateFixAssistantPanel: React.FC<TemplateFixAssistantPanelProps> = ({
  suggestions,
  activeCursorTemplate,
  onApplyFix,
  onApplyAllFixes,
  onInsertParam,
  onLocateRange,
  onOpenTemplateManager,
  onClose,
}) => {
  const fixableCount = suggestions.filter(s => s.suggestedSnippet !== undefined).length;
  const errorCount = suggestions.filter(s => s.severity === 'error').length;
  const warningCount = suggestions.filter(s => s.severity === 'warning').length;

  return (
    <section
      data-testid="template-fix-assistant-panel"
      aria-label="Sugestões de correção de chaves de pré-definição"
      className="border-x border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 text-slate-800 dark:text-slate-200 font-sans text-xs"
    >
      {/* Panel Header */}
      <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-white/80 dark:bg-slate-950/60">
        <div className="flex items-center gap-2 min-w-0">
          {errorCount > 0 ? (
            <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          ) : warningCount > 0 ? (
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          )}
          <div className="min-w-0">
            <span className="font-bold text-slate-900 dark:text-slate-100">
              Assistente de Chaves {'{{Predefinição}}'}
            </span>
            <span className="mx-1.5 text-slate-400" aria-hidden="true">·</span>
            <span className="text-[11px] text-slate-600 dark:text-slate-400">
              {suggestions.length === 0
                ? 'Nenhuma chave mal formada detectada'
                : `${suggestions.length} ${suggestions.length === 1 ? 'ocorrência detectada' : 'ocorrências detectadas'}`}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {fixableCount > 0 && (
            <button
              type="button"
              onClick={onApplyAllFixes}
              data-testid="apply-all-template-fixes-btn"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 text-indigo-800 dark:text-indigo-200 font-semibold text-[11px] cursor-pointer transition-colors"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Corrigir todas ({fixableCount})</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar assistente de chaves"
            className="p-1 rounded text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-3.5 space-y-3 max-h-[340px] overflow-y-auto">
        {/* Contextual Cursor Template Parameters */}
        {activeCursorTemplate && activeCursorTemplate.expectedParams.length > 0 && (
          <div
            data-testid="cursor-template-params-card"
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/80 p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                No cursor: <code className="font-mono text-indigo-700 dark:text-indigo-300">{`{{${activeCursorTemplate.matchedTemplateName || activeCursorTemplate.templateName}}}`}</code>
              </div>
              <button
                type="button"
                onClick={() => onLocateRange(activeCursorTemplate.start, activeCursorTemplate.end)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                <LocateFixed className="w-3 h-3" />
                <span>Selecionar bloco</span>
              </button>
            </div>
            <ExpectedParamsList
              params={activeCursorTemplate.expectedParams}
              templateRange={{
                start: activeCursorTemplate.start,
                end: activeCursorTemplate.end,
                isUnclosed: activeCursorTemplate.isUnclosed,
              }}
              onInsertParam={onInsertParam}
            />
          </div>
        )}

        {/* Suggestions List */}
        {suggestions.length === 0 ? (
          !activeCursorTemplate && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 px-4 py-3 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Todas as chaves <code className="font-mono text-slate-800 dark:text-slate-200">{'{{...}}'}</code> do artigo estão bem formadas e com parâmetros obrigatórios preenchidos. Posicione o cursor dentro de qualquer pré-definição no editor para inspecionar e inserir seus parâmetros esperados.
            </div>
          )
        ) : (
          <ul className="space-y-2.5">
            {suggestions.map(item => {
              const meta = ISSUE_TYPE_META[item.issueType];
              const canInsertParamsInline =
                item.expectedParams.length > 0 &&
                item.issueType !== 'unmatched_closing' &&
                item.issueType !== 'unresolved_param';

              return (
                <li
                  key={item.id}
                  data-testid={`template-suggestion-item-${item.id}`}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/80 p-3 space-y-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                            meta.isError
                              ? 'text-rose-700 dark:text-rose-300'
                              : 'text-amber-800 dark:text-amber-300'
                          }`}
                        >
                          {meta.isError ? (
                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span>{item.title}</span>
                        </span>
                        <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                          Linha {item.lineNumber}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                        {item.reason}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onLocateRange(item.start, item.end)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-medium cursor-pointer transition-colors"
                      >
                        <LocateFixed className="w-3 h-3" />
                        <span>Localizar</span>
                      </button>

                      {item.suggestedSnippet !== undefined && (
                        <button
                          type="button"
                          onClick={() => onApplyFix(item)}
                          data-testid={`apply-template-fix-btn-${item.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-indigo-300 dark:border-indigo-700 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold cursor-pointer transition-colors"
                        >
                          <Wand2 className="w-3 h-3" />
                          <span>Aplicar correção</span>
                        </button>
                      )}

                      {item.issueType === 'unknown_template' &&
                        !item.matchedTemplateName &&
                        onOpenTemplateManager && (
                          <button
                            type="button"
                            onClick={onOpenTemplateManager}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-[11px] font-semibold cursor-pointer transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Criar Predefinição</span>
                          </button>
                        )}
                    </div>
                  </div>

                  {/* Snippet Comparison */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded border border-rose-200/80 dark:border-rose-900/70 bg-rose-50/50 dark:bg-rose-950/20 px-2.5 py-1.5">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300 mb-0.5">
                        Atual
                      </div>
                      <pre className="font-mono text-[11px] text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-all">
                        {item.originalSnippet}
                      </pre>
                    </div>
                    {item.suggestedSnippet !== undefined && (
                      <div className="rounded border border-emerald-200/80 dark:border-emerald-900/70 bg-emerald-50/50 dark:bg-emerald-950/20 px-2.5 py-1.5">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 mb-0.5">
                          Sugestão automática
                        </div>
                        <pre className="font-mono text-[11px] text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-all">
                          {item.suggestedSnippet === '' ? '(remover chaves excedentes)' : item.suggestedSnippet}
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* Expected Parameters List */}
                  <ExpectedParamsList
                    params={item.expectedParams}
                    templateRange={
                      canInsertParamsInline
                        ? {
                            start: item.start,
                            end: item.end,
                            isUnclosed: item.issueType === 'unclosed_braces',
                          }
                        : undefined
                    }
                    onInsertParam={canInsertParamsInline ? onInsertParam : undefined}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};

export default TemplateFixAssistantPanel;
