import React, { useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Code2,
  Eye,
  EyeOff,
  LocateFixed,
  XCircle,
} from 'lucide-react';
import { TemplateDiagnostic, TemplateDiagnosticType } from '../types';

export interface TemplateDebugInspectorProps {
  diagnostics: TemplateDiagnostic[];
  highlightEnabled: boolean;
  onToggleHighlight: () => void;
  onJumpToDiagnostic?: (diagnosticId: string) => void;
  onEdit?: (slug: string) => void;
  editTargetSlug?: string;
  defaultExpanded?: boolean;
}

const ISSUE_LABELS: Record<TemplateDiagnosticType, { label: string; isError: boolean }> = {
  unclosed_braces: { label: 'Chave não fechada', isError: true },
  unmatched_closing: { label: 'Fechamento solto', isError: true },
  invalid_name: { label: 'Chave / nome inválido', isError: true },
  recursion_cycle: { label: 'Ciclo de recursão', isError: true },
  missing_template: { label: 'Pré-definição inexistente', isError: true },
  unresolved_param: { label: 'Parâmetro {{{...}}} sem valor', isError: false },
  missing_required_param: { label: 'Parâmetro obrigatório ausente', isError: false },
};

export function jumpToTemplateDiagnosticElement(
  container: HTMLElement | null,
  diagnosticId: string
): void {
  if (!container || typeof document === 'undefined') return;
  const escapedId =
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(diagnosticId)
      : diagnosticId.replace(/"/g, '\\"');
  const target =
    (container.querySelector(`[data-template-diagnostic-id="${escapedId}"]`) as HTMLElement | null) ||
    document.getElementById(diagnosticId);

  if (!target) return;
  if (typeof target.scrollIntoView === 'function') {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  target.classList.add('ring-2', 'ring-rose-500', 'ring-offset-1', 'transition-all');
  setTimeout(() => {
    target.classList.remove('ring-2', 'ring-rose-500', 'ring-offset-1');
  }, 2400);
}

export const TemplateDebugInspector: React.FC<TemplateDebugInspectorProps> = ({
  diagnostics,
  highlightEnabled,
  onToggleHighlight,
  onJumpToDiagnostic,
  onEdit,
  editTargetSlug,
  defaultExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!diagnostics || diagnostics.length === 0) return null;

  const syntaxErrorCount = diagnostics.filter(d => d.severity === 'error').length;
  const missingParamCount = diagnostics.filter(
    d => d.type === 'unresolved_param' || d.type === 'missing_required_param'
  ).length;
  const hasSevere = syntaxErrorCount > 0;

  const containerTone = hasSevere
    ? 'border-rose-300/90 dark:border-rose-800/80 bg-rose-50/70 dark:bg-rose-950/25 text-rose-950 dark:text-rose-100'
    : 'border-amber-300/90 dark:border-amber-800/80 bg-amber-50/70 dark:bg-amber-950/25 text-amber-950 dark:text-amber-100';

  const summaryParts: string[] = [];
  if (syntaxErrorCount > 0) {
    summaryParts.push(
      `${syntaxErrorCount} ${syntaxErrorCount === 1 ? 'chave inválida' : 'chaves inválidas'}`
    );
  }
  if (missingParamCount > 0) {
    summaryParts.push(
      `${missingParamCount} ${missingParamCount === 1 ? 'parâmetro ausente' : 'parâmetros ausentes'}`
    );
  }

  return (
    <section
      data-testid="template-debug-inspector"
      aria-label="Depuração de pré-definições no modo de leitura"
      className={`no-print mb-5 rounded-lg border font-sans text-xs transition-colors ${containerTone}`}
    >
      <div className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
          {hasSevere ? (
            <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5 sm:mt-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
          )}
          <div className="min-w-0">
            <span className="font-bold tracking-tight">
              Depuração de Pré-definições
            </span>
            <span className="mx-1.5 opacity-45" aria-hidden="true">·</span>
            <span className="font-medium opacity-90">
              {summaryParts.join(' · ')}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleHighlight}
            aria-pressed={highlightEnabled}
            data-testid="toggle-template-debug-highlights"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-300/80 dark:border-slate-700 bg-white/90 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-[11px] font-medium transition-colors cursor-pointer"
            title="Alternar sublinhado e coloração das chaves com erro no texto"
          >
            {highlightEnabled ? (
              <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>{highlightEnabled ? 'Destaques ativos' : 'Destaques ocultos'}</span>
          </button>

          <button
            type="button"
            onClick={() => setExpanded(prev => !prev)}
            aria-expanded={expanded}
            data-testid="toggle-template-debug-details"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300/80 dark:border-slate-700 bg-white/90 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-[11px] font-semibold transition-colors cursor-pointer"
          >
            <span>{expanded ? 'Ocultar lista' : `Inspecionar (${diagnostics.length})`}</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {onEdit && editTargetSlug && (
            <button
              type="button"
              onClick={() => onEdit(editTargetSlug)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300/80 dark:border-slate-700 bg-white/90 dark:bg-slate-900/80 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 text-[11px] font-semibold transition-colors cursor-pointer"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Editar Wikitexto</span>
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <ul className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white/75 dark:bg-slate-950/40 divide-y divide-slate-200/70 dark:divide-slate-800/70">
          {diagnostics.map(diag => {
            const meta = ISSUE_LABELS[diag.type];
            return (
              <li
                key={diag.id}
                className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`font-semibold text-[11px] underline decoration-dotted ${
                        meta.isError
                          ? 'text-rose-700 dark:text-rose-300 decoration-rose-500'
                          : 'text-amber-800 dark:text-amber-300 decoration-amber-500'
                      }`}
                    >
                      {meta.isError ? '✕' : '⚠'} {meta.label}
                    </span>
                    <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                      {diag.templateName}
                    </span>
                    {diag.missingParams && diag.missingParams.length > 0 && (
                      <span className="font-mono text-[11px] text-amber-800 dark:text-amber-300">
                        faltando: {diag.missingParams.join(', ')}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                    {diag.message}
                  </p>
                  {diag.snippet && (
                    <code className="inline-block max-w-full truncate font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200">
                      {diag.snippet}
                    </code>
                  )}
                </div>

                {onJumpToDiagnostic && (
                  <button
                    type="button"
                    onClick={() => onJumpToDiagnostic(diag.id)}
                    className="self-start sm:self-center shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-medium cursor-pointer"
                  >
                    <LocateFixed className="w-3 h-3" />
                    <span>Localizar</span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default TemplateDebugInspector;
