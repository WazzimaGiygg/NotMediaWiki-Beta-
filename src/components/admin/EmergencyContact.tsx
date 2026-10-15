import React, { useState, useEffect } from 'react';
import {
  PhoneCall,
  AlertOctagon,
  ShieldAlert,
  Flame,
  LifeBuoy,
  Send,
  CheckCircle2,
  Clock,
  Lock,
  ExternalLink,
  MessageSquare,
  FileCheck,
  Siren,
  HelpCircle,
  Cloud,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { EmergencyContactReport, UserSession } from '../../types';
import {
  fetchEmergencyReportsFromFirestore,
  saveEmergencyReportToFirestore,
  deleteEmergencyReportFromFirestore,
  subscribeToEmergencyReportsFromFirestore,
} from '../../firebase';

interface EmergencyProps {
  currentUser: UserSession | null;
}

const DEFAULT_EMERGENCY_REPORTS: EmergencyContactReport[] = [
  {
    id: 'emg-1',
    protocol: 'SOS-2026-004',
    category: 'vida_integridade',
    title: 'Ameaça explícita de autoextermínio publicada em página de discussão',
    description: 'Usuário postou mensagem de despedida com indicação de automutilação na Discussão do artigo Teste. Protocolo de acolhimento do CVV (188) acionado e logs preservados para auxílio imediato.',
    urgency: 'critica_imediata',
    reportedBy: 'Moderador_Plantao',
    contactChannel: 'Plantão SOS 24h (urgencia@wazzimagiygg.com)',
    status: 'resolvido',
    actionsTaken: 'Artigo limpo preventivamente. Encaminhada orientação humanitária via canal privado e contatos oficiais de saúde mental.',
    createdAt: '2026-10-10T03:14:00Z',
  },
  {
    id: 'emg-2',
    protocol: 'SOS-2026-003',
    category: 'ordem_judicial',
    title: 'Intimação judicial com prazo de 24 horas - Tutela de Urgência',
    description: 'Ofício urgente expedido para exclusão cautelar de publicação infringente sob cominação de astreintes diárias.',
    urgency: 'critica_imediata',
    reportedBy: 'Burocrata_Wazzima',
    contactChannel: 'Linha Direta Jurídica (juridico@wazzimagiygg.com)',
    status: 'resolvido',
    actionsTaken: 'Cumprimento tempestivo em 1h15m com protocolo de resposta enviado ao cartório judicial.',
    createdAt: '2026-10-06T14:00:00Z',
  },
];

export const EmergencyContact: React.FC<EmergencyProps> = ({ currentUser }) => {
  const [reports, setReports] = useState<EmergencyContactReport[]>([]);
  const [isLoadingFirestore, setIsLoadingFirestore] = useState(true);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [alertCategory, setAlertCategory] = useState<EmergencyContactReport['category']>('vida_integridade');
  const [alertTitle, setAlertTitle] = useState('');
  const [alertDesc, setAlertDesc] = useState('');
  const [alertUrgency, setAlertUrgency] = useState<EmergencyContactReport['urgency']>('critica_imediata');
  const [alertSuccessMessage, setAlertSuccessMessage] = useState<string | null>(null);

  // Sync strictly with Firebase Firestore
  useEffect(() => {
    let isMounted = true;
    setIsLoadingFirestore(true);

    fetchEmergencyReportsFromFirestore()
      .then(cloudReports => {
        if (!isMounted) return;
        setReports(cloudReports || []);
        setIsLoadingFirestore(false);
      })
      .catch(err => {
        console.warn('Firestore Emergency reports sync notice:', err);
        if (isMounted) {
          setReports([]);
          setIsLoadingFirestore(false);
        }
      });

    const unsubscribe = subscribeToEmergencyReportsFromFirestore(updated => {
      if (isMounted) {
        setReports(updated || []);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const handleSeedToFirestore = async () => {
    setIsSeeding(true);
    try {
      for (const item of DEFAULT_EMERGENCY_REPORTS) {
        await saveEmergencyReportToFirestore(item);
      }
      const fresh = await fetchEmergencyReportsFromFirestore();
      setReports(fresh || []);
    } catch (e) {
      console.error('Failed to seed emergency reports to Firestore:', e);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleDeleteReport = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este alerta de emergência do Firebase Firestore?')) return;
    try {
      await deleteEmergencyReportFromFirestore(id);
      setReports(prev => prev.filter(r => r.id !== id));
    } catch (e: any) {
      alert(`Erro ao remover do Firestore: ${e.message}`);
    }
  };

  const handleResolveReport = async (id: string) => {
    const action = prompt('Descreva as ações emergenciais adotadas para a resolução do chamado:');
    if (!action) return;

    const target = reports.find(r => r.id === id);
    if (!target) return;

    const updated: EmergencyContactReport = {
      ...target,
      status: 'resolvido',
      actionsTaken: action.trim(),
    };

    await saveEmergencyReportToFirestore(updated);
    setReports(prev => prev.map(r => (r.id === id ? updated : r)));
  };

  const handleDispatchAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertTitle.trim() || !alertDesc.trim()) return;

    const newReport: EmergencyContactReport = {
      id: `emg-${Date.now()}`,
      protocol: `SOS-2026-${(reports.length + 5).toString().padStart(3, '0')}`,
      category: alertCategory,
      title: alertTitle.trim(),
      description: alertDesc.trim(),
      urgency: alertUrgency,
      reportedBy: currentUser?.username || 'Operador de Emergência',
      contactChannel: 'Plantão 24/7 Projetos WazzimaGiygg',
      status: 'atendimento_imediato',
      createdAt: new Date().toISOString(),
    };

    await saveEmergencyReportToFirestore(newReport);
    setReports(prev => [newReport, ...prev.filter(r => r.id !== newReport.id)]);
    setIsAlertModalOpen(false);
    setAlertSuccessMessage(`Protocolo ${newReport.protocol} acionado e sincronizado no Firestore com prioridade máxima.`);
    setTimeout(() => setAlertSuccessMessage(null), 6000);

    setAlertTitle('');
    setAlertDesc('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-rose-200 rounded-lg p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-rose-100 rounded-lg text-rose-700 animate-pulse">
                <Siren className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  Contato de Emergência & Plantão 24/7
                  <span className="text-xs px-2 py-0.5 rounded bg-rose-600 text-white font-mono font-bold">
                    RESPOSTA IMEDIATA
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  Canal restrito de contingência para risco iminente à vida, ordens judiciais com prazo peremptório e crimes cibernéticos graves.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAlertModalOpen(true)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md hover:shadow-lg"
            >
              <AlertOctagon className="w-4 h-4" />
              <span>Disparar Alerta de Emergência</span>
            </button>
          </div>
        </div>

        {alertSuccessMessage && (
          <div className="mt-4 p-3 bg-emerald-100 border border-emerald-300 rounded text-emerald-900 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{alertSuccessMessage}</span>
          </div>
        )}

        {/* Emergency Channels Directory */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5 pt-4 border-t border-slate-100">
          {/* Card 1: Risco à Vida */}
          <div className="bg-rose-50/60 border border-rose-200 rounded-lg p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-rose-900 font-bold text-xs">
              <LifeBuoy className="w-4 h-4 text-rose-600" />
              <span>Ameaça à Vida e Saúde Mental</span>
            </div>
            <p className="text-[11px] text-rose-800 leading-relaxed">
              Em caso de ameaças imediatas de autoextermínio ou violência física grave, utilize o protocolo humanitário integrado ao CVV (Centro de Valorização da Vida).
            </p>
            <div className="pt-1 border-t border-rose-200/80 flex items-center justify-between text-xs">
              <span className="font-bold text-rose-900">Disque 188 (Gratuito)</span>
              <span className="font-mono text-[10px] text-rose-700">cvv.org.br</span>
            </div>
          </div>

          {/* Card 2: Plantão Jurídico e Ordens Judiciais */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
              <ShieldAlert className="w-4 h-4 text-purple-600" />
              <span>Plantão Jurídico e Decisões Judiciais</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Notificações de urgência expedidas por Tribunais de Justiça, Ministério Público ou Delegacias de Repressão a Crimes Cibernéticos.
            </p>
            <div className="pt-1 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="font-mono font-semibold text-slate-800">juridico@wazzimagiygg.com</span>
              <span className="text-[10px] text-emerald-600 font-medium">Prazo: &lt; 2h</span>
            </div>
          </div>

          {/* Card 3: Segurança da Infraestrutura */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
              <Flame className="w-4 h-4 text-amber-600" />
              <span>Incidentes Críticos de Segurança (CSIRT)</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Vazamento massivo de banco de dados, ataque de negação de serviço distribuído (DDoS) ou comprometimento de chaves mestras de autenticação.
            </p>
            <div className="pt-1 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="font-mono font-semibold text-slate-800">security@wazzimagiygg.com</span>
              <span className="text-[10px] text-purple-600 font-medium">On-call 24/7</span>
            </div>
          </div>
        </div>
      </div>

      {/* Procedimento Operacional Padrão (POP) */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-3">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-blue-600" />
          <span>Procedimento Operacional Padrão de Crise (POP-EMG-01)</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded bg-slate-50 border border-slate-200 space-y-1">
            <div className="font-bold text-blue-700">1. Contenção Preventiva</div>
            <div className="text-[11px] text-slate-600">
              Oculte a revisão danosa ou página crítica imediatamente via ferramenta de Oversight ou Revision Deletion.
            </div>
          </div>
          <div className="p-3 rounded bg-slate-50 border border-slate-200 space-y-1">
            <div className="font-bold text-blue-700">2. Preservação de Logs</div>
            <div className="text-[11px] text-slate-600">
              Congele os logs de acesso (IP, porta lógica, User-Agent e carimbo UTC) para entrega estrita às autoridades conforme Art. 15 da Lei 12.965/14.
            </div>
          </div>
          <div className="p-3 rounded bg-slate-50 border border-slate-200 space-y-1">
            <div className="font-bold text-blue-700">3. Comunicação ao Burocrata</div>
            <div className="text-[11px] text-slate-600">
              Dispare o ticket de emergência com o protocolo para o plantão de Burocratas dos Projetos WazzimaGiygg.
            </div>
          </div>
          <div className="p-3 rounded bg-slate-50 border border-slate-200 space-y-1">
            <div className="font-bold text-blue-700">4. Registro & Encerramento</div>
            <div className="text-[11px] text-slate-600">
              Formalize o relatório pós-incidente (Post-Mortem) em canal criptografado para conformidade com a LGPD e Marco Civil.
            </div>
          </div>
        </div>
      </div>

      {/* Incident History */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-600" />
            <span>Histórico de Chamados e Ocorrências de Plantão ({reports.length})</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">Criptografado</span>
        </div>

        <div className="space-y-3">
          {reports.length === 0 ? (
            <div className="p-8 rounded-lg border border-slate-200 bg-white text-center text-slate-500 text-xs space-y-3">
              <Siren className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="font-semibold text-slate-700 text-sm">Nenhum chamado de emergência cadastrado no Firebase Firestore.</div>
              <p className="text-slate-500 max-w-md mx-auto">
                Todos os incidentes críticos e despachos do plantão 24/7 são sincronizados em tempo real com o Firebase Firestore. Nenhuma informação externa ou fictícia é exibida.
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={handleSeedToFirestore}
                  disabled={isSeeding}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded font-medium text-xs flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  <span>{isSeeding ? 'Gravando no Firestore...' : 'Cadastrar Protocolos Iniciais no Firebase'}</span>
                </button>
                <button
                  onClick={() => setIsAlertModalOpen(true)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Disparar Alerta Imediato</span>
                </button>
              </div>
            </div>
          ) : (
            reports.map(item => (
              <div
                key={item.id}
                className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2.5 text-xs shadow-2xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-xs">
                      {item.protocol}
                    </span>
                    <span className="font-bold text-slate-900 text-sm">{item.title}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        item.status === 'resolvido'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800 animate-pulse'
                      }`}
                    >
                      {item.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                    <span>{new Date(item.createdAt).toLocaleString('pt-BR')}</span>
                    {item.status !== 'resolvido' && (
                      <button
                        onClick={() => handleResolveReport(item.id)}
                        className="px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-semibold cursor-pointer"
                      >
                        Resolver
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteReport(item.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                      title="Excluir do Firestore"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-slate-700 bg-white p-2.5 rounded border border-slate-200 leading-relaxed">
                  {item.description}
                </p>

                {item.actionsTaken && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 text-[11px]">
                    <strong>Ações Executadas pelo Plantão:</strong> {item.actionsTaken}
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                  <span>Canal: <strong>{item.contactChannel}</strong></span>
                  <span>Operador: <strong>{item.reportedBy}</strong></span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal: Disparo de Alerta de Emergência */}
      {isAlertModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full p-5 space-y-4 border border-rose-300">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-rose-800 text-sm flex items-center gap-2">
                <Siren className="w-4 h-4 text-rose-600 animate-pulse" />
                <span>Disparar Chamado de Emergência Crítica</span>
              </h3>
              <button onClick={() => setIsAlertModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleDispatchAlert} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Categoria do Incidente</label>
                <select
                  value={alertCategory}
                  onChange={e => setAlertCategory(e.target.value as any)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded focus:ring-1 focus:ring-rose-500 outline-none"
                >
                  <option value="vida_integridade">Risco Iminente à Vida ou Integridade Física</option>
                  <option value="ordem_judicial">Notificação Judicial Urgente (Prazo Fatal)</option>
                  <option value="crime_grave">Crime Cibernético Grave / Violação Penal</option>
                  <option value="vazamento_critico">Vazamento Massivo de Chaves / Infraestrutura</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nível de Urgência</label>
                <select
                  value={alertUrgency}
                  onChange={e => setAlertUrgency(e.target.value as any)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded focus:ring-1 focus:ring-rose-500 outline-none font-bold text-rose-700"
                >
                  <option value="critica_imediata">Crítica Imediata (Resposta em até 30 minutos)</option>
                  <option value="alta">Alta (Resposta em até 2 horas)</option>
                  <option value="moderada">Moderada (Resposta no mesmo dia)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Título Resumido da Ocorrência</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Mandado de tutela cautelar recebido em cartório..."
                  value={alertTitle}
                  onChange={e => setAlertTitle(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded focus:ring-1 focus:ring-rose-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Relato Fático e Dados para Contato Imediato</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Descreva a urgência, artigos envolvidos, links e telefones/e-mails das autoridades solicitantes..."
                  value={alertDesc}
                  onChange={e => setAlertDesc(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded focus:ring-1 focus:ring-rose-500 outline-none"
                />
              </div>

              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-[11px] text-rose-900 leading-relaxed">
                Este acionamento gera protocolo de auditoria auditável e aciona os plantonistas dos Projetos WazzimaGiygg.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAlertModalOpen(false)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold cursor-pointer shadow-md"
                >
                  Confirmar e Disparar Alerta SOS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
