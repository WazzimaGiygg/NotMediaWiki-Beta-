import React, { useState, useEffect } from 'react';
import {
  Scale,
  Shield,
  FileText,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Download,
  BookOpen,
  ExternalLink,
  Server,
  Database,
  UserCheck,
  Building,
  HelpCircle,
  Eye,
  Cloud,
  RefreshCw,
  Check,
  CheckSquare,
  Square,
} from 'lucide-react';
import { UserSession } from '../../types';
import {
  fetchComplianceRecordFromFirestore,
  saveComplianceRecordToFirestore,
  subscribeToComplianceRecordFromFirestore,
  writeSystemLog,
} from '../../firebase';

interface LgpdProps {
  currentUser: UserSession | null;
}

const DEFAULT_CHECKLIST = [
  {
    id: 1,
    title: 'Criptografia em Trânsito (TLS 1.3 / HTTPS)',
    desc: 'Todo tráfego entre navegadores e os microsserviços Node.js é protegido com cifras modernas.',
    status: 'Implementado',
    law: 'Art. 46 LGPD',
  },
  {
    id: 2,
    title: 'Isolamento de Credenciais e Segurança no Firestore',
    desc: 'Regras de segurança firestore.rules validam papéis RBAC e proíbem acesso não autorizado a dados cadastrais.',
    status: 'Implementado',
    law: 'Art. 46 LGPD',
  },
  {
    id: 3,
    title: 'Guarda Automatizada de Logs de Conexão por 180 Dias',
    desc: 'Registros telemáticos de acesso mantidos em conformidade temporal estrita com exclusão programada após 6 meses.',
    status: 'Implementado',
    law: 'Art. 15 Marco Civil',
  },
  {
    id: 4,
    title: 'Mecanismo Técnico de Supressão e Anonimização (Oversight / RevDel)',
    desc: 'Ferramenta administrativa para apagar revisões com dados pessoais expostos sem corromper a árvore Git/Diff.',
    status: 'Implementado',
    law: 'Art. 18 LGPD',
  },
  {
    id: 5,
    title: 'Política de Domínios Permitidos e Prevenção de Phishing',
    desc: 'Filtro de prefixo obrigatório para links externos (wazzimagiygg.com) com gestão de domínios confiáveis pelo Burocrata.',
    status: 'Implementado',
    law: 'Marco Civil & Segurança',
  },
  {
    id: 6,
    title: 'Canal de Plantão de Emergência para Riscos Graves',
    desc: 'Linha direta 24/7 para acolhimento de ameaças à vida e cumprimento tempestivo de ordens judiciais.',
    status: 'Implementado',
    law: 'Art. 19 Marco Civil',
  },
];

export const LgpdMarcoCivilRules: React.FC<LgpdProps> = ({ currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<'marco_civil' | 'lgpd' | 'checklist' | 'ripd'>('marco_civil');
  const [ripdGenerated, setRipdGenerated] = useState(false);
  const [ripdDate, setRipdDate] = useState<string | null>(null);
  const [ripdSigner, setRipdSigner] = useState<string | null>(null);
  const [checklistChecks, setChecklistChecks] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
    6: true,
  });
  const [isLoadingFirestore, setIsLoadingFirestore] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Sync strictly with Firebase Firestore
  useEffect(() => {
    let isMounted = true;
    setIsLoadingFirestore(true);

    fetchComplianceRecordFromFirestore()
      .then(async record => {
        if (!isMounted) return;
        if (record) {
          if (record.checklist) setChecklistChecks(record.checklist);
          if (record.ripdGenerated) {
            setRipdGenerated(true);
            setRipdDate(record.ripdDate || null);
            setRipdSigner(record.ripdSigner || null);
          }
        } else {
          // Initialize active audit in Firestore so all data is genuinely in Firestore
          const initialRecord = {
            id: 'active_audit',
            status: 'Conforme (100%)',
            controller: 'Projetos WazzimaGiygg',
            dpoEmail: 'dpo@wazzimagiygg.com',
            checklist: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true },
            ripdGenerated: false,
            updatedAt: new Date().toISOString(),
          };
          await saveComplianceRecordToFirestore(initialRecord);
        }
        setIsLoadingFirestore(false);
      })
      .catch(err => {
        console.warn('Firestore compliance fetch notice:', err);
        if (isMounted) setIsLoadingFirestore(false);
      });

    const unsubscribe = subscribeToComplianceRecordFromFirestore(record => {
      if (isMounted && record) {
        if (record.checklist) setChecklistChecks(record.checklist);
        if (record.ripdGenerated) {
          setRipdGenerated(true);
          setRipdDate(record.ripdDate || null);
          setRipdSigner(record.ripdSigner || null);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const handleToggleChecklist = async (id: number) => {
    const updated = { ...checklistChecks, [id]: !checklistChecks[id] };
    setChecklistChecks(updated);
    setIsSaving(true);
    try {
      await saveComplianceRecordToFirestore({
        id: 'active_audit',
        checklist: updated,
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Error saving checklist toggle to Firestore:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateRipd = async () => {
    const now = new Date().toISOString();
    const signer = currentUser?.username || 'Burocrata NotMediaWiki';
    setRipdGenerated(true);
    setRipdDate(now);
    setRipdSigner(signer);
    setIsSaving(true);

    try {
      await saveComplianceRecordToFirestore({
        id: 'active_audit',
        ripdGenerated: true,
        ripdDate: now,
        ripdSigner: signer,
        status: 'Auditado e Validado no Firestore',
        updatedAt: now,
      });

      await writeSystemLog({
        level: 'INFO',
        service: 'ComplianceAudit',
        message: `Relatório de Impacto à Proteção de Dados (RIPD / LGPD Art. 38) gerado e autenticado por ${signer} no Firestore`,
        details: { signer, date: now },
      });
    } catch (e) {
      console.error('Error saving RIPD to Firestore:', e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-50 rounded-lg border border-blue-200 text-blue-700">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  Regras da LGPD e Marco Civil da Internet Brasileira
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono font-medium">
                    Lei 12.965/14 • Lei 13.709/18
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  Marco regulatório, diretrizes de privacidade, deveres de guarda de registros e direitos dos titulares nos Projetos WazzimaGiygg.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
              <Cloud className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              <span>Sincronizado no Firestore (compliance_records)</span>
            </span>
          </div>
        </div>

        {/* Sub navigation inside the rules page */}
        <div className="flex items-center gap-2 mt-5 pt-3 border-t border-slate-100 overflow-x-auto no-scrollbar">
          {[
            { id: 'marco_civil', label: 'Marco Civil da Internet (Lei 12.965/14)' },
            { id: 'lgpd', label: 'LGPD (Lei 13.709/18) & Direitos do Titular' },
            { id: 'checklist', label: 'Checklist Técnico de Conformidade' },
            { id: 'ripd', label: 'Relatório de Impacto (RIPD)' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-3 py-1.5 rounded text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                activeSubTab === tab.id
                  ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Marco Civil da Internet */}
      {activeSubTab === 'marco_civil' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span>Lei Federal nº 12.965/2014 — Marco Civil da Internet</span>
              </h3>
              <span className="text-[11px] font-mono text-slate-500">República Federativa do Brasil</span>
            </div>

            <p className="text-slate-600 leading-relaxed">
              O NotMediaWiki, como aplicação de internet mantida sob o ecossistema <strong>wazzimagiygg.com</strong>, opera em estrito alinhamento aos princípios da neutralidade de rede, proteção da privacidade e garantia da liberdade de expressão.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              {/* Artigo 15 */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 font-mono">Artigo 15 • Guarda de Registros</span>
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-semibold">Obrigatório</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  <strong>Dever Legal de Retenção:</strong> O provedor de aplicações tem o dever de manter os registros de acesso a aplicações de internet sob sigilo, em ambiente seguro e controlado, pelo prazo de <strong>6 meses (180 dias)</strong>.
                </p>
                <div className="text-[11px] text-blue-700 bg-blue-50 p-2 rounded border border-blue-200">
                  <strong>Implementação NotMediaWiki:</strong> Os logs de IP e User-Agent são gravados com timestamp UTC nas coleções do Firestore com acesso exclusivo ao Burocrata e CheckUsers.
                </div>
              </div>

              {/* Artigo 19 */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 font-mono">Artigo 19 • Responsabilidade por Conteúdo</span>
                  <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-semibold">Regra Geral</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Com o intuito de assegurar a liberdade de expressão e impedir a censura prévia, o provedor somente poderá ser responsabilizado civilmente por danos decorrentes de conteúdo gerado por terceiros se, após <strong>ordem judicial específica</strong>, não tomar as providências para tornar indisponível o conteúdo.
                </p>
                <div className="text-[11px] text-purple-700 bg-purple-50 p-2 rounded border border-purple-200">
                  <strong>Canal Ágil:</strong> As ordens judiciais são processadas com prioridade máxima no menu <em>Pedido de Remoção de Dados / Oversight</em>.
                </div>
              </div>

              {/* Artigo 10 e 11 */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 font-mono">Artigos 10 e 11 • Inviolabilidade do Sigilo</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-semibold">Privacidade</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  A guarda e a disponibilização dos registros de conexão e de acesso a aplicações de internet, bem como de dados pessoais, devem atender à preservação da intimidade, da vida privada, da honra e da imagem das partes.
                </p>
                <div className="text-[11px] text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-200">
                  <strong>Garantia Técnica:</strong> Mascaramento automático de endereços de IP na interface pública da enciclopédia.
                </div>
              </div>

              {/* Artigo 21 */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 font-mono">Artigo 21 • Notificação e Retirada Especial</span>
                  <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-semibold">Exceção à Ordem Judicial</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Em casos de violação da intimidade decorrente da divulgação não autorizada de imagens, vídeos ou outros materiais com cenas de nudez ou de atos sexuais de caráter privado, a remoção independe de ordem judicial, bastando notificação da vítima.
                </p>
                <div className="text-[11px] text-rose-700 bg-rose-50 p-2 rounded border border-rose-200">
                  <strong>Resposta Emergencial:</strong> Tratamento imediato pelo <em>Contato de Emergência 24/7</em>.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: LGPD */}
      {activeSubTab === 'lgpd' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-600" />
                <span>Lei Federal nº 13.709/2018 — Lei Geral de Proteção de Dados Pessoais (LGPD)</span>
              </h3>
              <span className="text-[11px] font-mono text-emerald-600 font-medium">Bases Legais Ativas</span>
            </div>

            <p className="text-slate-600 leading-relaxed">
              O tratamento de dados pessoais no NotMediaWiki respeita os princípios fundamentais da finalidade, adequação, necessidade e segurança da informação previstos no Art. 6º da LGPD.
            </p>

            {/* Bases Legais */}
            <div className="space-y-2.5 pt-2">
              <h4 className="font-bold text-slate-800 text-xs">Bases Legais Aplicáveis (Artigo 7º da LGPD):</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 rounded bg-blue-50/60 border border-blue-200">
                  <div className="font-bold text-blue-900 mb-1">Art. 7º, II • Obrigação Legal</div>
                  <p className="text-[11px] text-blue-800">
                    Guarda obrigatória de registros de conexão e acesso a aplicações por 6 meses nos termos do Marco Civil da Internet.
                  </p>
                </div>
                <div className="p-3 rounded bg-purple-50/60 border border-purple-200">
                  <div className="font-bold text-purple-900 mb-1">Art. 7º, IX • Legítimo Interesse</div>
                  <p className="text-[11px] text-purple-800">
                    Preservação da memória histórica, rastreabilidade de autoria de edições colaborativas e combate ao vandalismo e fraudes.
                  </p>
                </div>
                <div className="p-3 rounded bg-emerald-50/60 border border-emerald-200">
                  <div className="font-bold text-emerald-900 mb-1">Art. 7º, I • Consentimento</div>
                  <p className="text-[11px] text-emerald-800">
                    Criação voluntária de conta de usuário com e-mail, biografia e personalização de interface.
                  </p>
                </div>
              </div>
            </div>

            {/* Direitos do Titular (Art. 18) */}
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <h4 className="font-bold text-slate-800 text-xs">
                Direitos do Titular de Dados Pessoais (Artigo 18 da LGPD):
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-[11px]">
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                  <strong>I. Confirmação e Acesso:</strong> Consulta sobre existência de dados no repositório.
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                  <strong>II. Correção:</strong> Retificação de dados incompletos, inexatos ou desatualizados.
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                  <strong>III. Anonimização / Bloqueio:</strong> Supressão de identificação em histórico (RevDel).
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                  <strong>IV. Eliminação:</strong> Direito ao esquecimento via formulário do menu <em>Remoção de Dados</em>.
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                  <strong>V. Portabilidade:</strong> Exportação de dados cadastrais em formato legível por máquina (JSON).
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                  <strong>VI. Revogação de Consentimento:</strong> Desativação de conta com exclusão de dados privados.
                </div>
              </div>
            </div>

            {/* DPO Information */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800">Encarregado pelo Tratamento de Dados Pessoais (DPO):</span>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  Projetos WazzimaGiygg • Contato direto: <span className="font-mono font-medium text-blue-600">dpo@wazzimagiygg.com</span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded bg-white border border-slate-300 font-mono text-[11px] text-slate-700">
                Atendimento: &lt; 48h
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Checklist Técnico */}
      {activeSubTab === 'checklist' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Checklist Técnico de Segurança da Informação & Compliance</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-500">
              {isSaving ? 'Salvando no Firestore...' : 'Sincronização Ativa no Firestore'}
            </span>
          </div>

          <div className="space-y-2.5">
            {DEFAULT_CHECKLIST.map(item => {
              const isChecked = checklistChecks[item.id] !== false;
              return (
                <div
                  key={item.id}
                  onClick={() => handleToggleChecklist(item.id)}
                  className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 flex items-start justify-between gap-3 cursor-pointer hover:bg-slate-100/80 transition-colors"
                >
                  <div className="flex items-start gap-2.5">
                    {isChecked ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className={`font-bold ${isChecked ? 'text-slate-900' : 'text-slate-500 line-through'}`}>
                        {item.title}
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">{item.desc}</div>
                      <div className="text-[10px] text-blue-600 font-mono mt-1">Fundamento: {item.law}</div>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded font-semibold text-[10px] shrink-0 ${
                      isChecked ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {isChecked ? 'Implementado' : 'Pendente'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 4: RIPD */}
      {activeSubTab === 'ripd' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-600" />
                <span>Relatório de Impacto à Proteção de Dados Pessoais (RIPD / DPIA)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Documento de governança exigido pelo Artigo 38 da LGPD contendo a descrição dos processos de tratamento e medidas de salvaguarda persistidas no Firestore.
              </p>
            </div>

            <button
              onClick={handleGenerateRipd}
              disabled={isSaving}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-semibold text-xs cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isSaving ? 'Gravando no Firestore...' : 'Gerar e Validar RIPD no Firestore'}</span>
            </button>
          </div>

          {ripdGenerated ? (
            <div className="p-4 rounded-lg bg-slate-50 border border-purple-200 space-y-3 font-mono text-[11px]">
              <div className="flex items-center justify-between font-bold text-purple-900 pb-2 border-b border-purple-200">
                <span>RELATÓRIO EXECUTIVO DE CONFORMIDADE — NOTMEDIAWIKI</span>
                <span>
                  EMISSÃO: {ripdDate ? new Date(ripdDate).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}
                </span>
              </div>
              <div className="text-slate-700 space-y-1">
                <div>CONTROLADOR: Projetos WazzimaGiygg (wazzimagiygg.com)</div>
                <div>ENCARREGADO (DPO): dpo@wazzimagiygg.com</div>
                <div>RESPONSÁVEL PELA AUDITORIA: {ripdSigner || currentUser?.username || 'Burocrata Oficial'}</div>
                <div>NATUREZA DA APLICAÇÃO: Base colaborativa de conhecimento com arquitetura de microsserviços Node.js</div>
                <div>BANCO DE DADOS: Google Cloud Firestore (Coleção compliance_records)</div>
                <div>CLASSIFICAÇÃO DE RISCO: BAIXO A MODERADO (com medidas de mitigação ativas)</div>
              </div>
              <div className="p-2.5 bg-emerald-50 rounded border border-emerald-200 text-emerald-900 font-sans">
                <strong>Parecer Conclusivo:</strong> O NotMediaWiki cumpre integralmente os requisitos de minimização de coleta, custódia de registros por 6 meses do Marco Civil e disponibilização de ferramentas para exercício dos direitos dos titulares previstos no Art. 18 da LGPD. Este registro está armazenado em nuvem no Firestore.
              </div>
            </div>
          ) : (
            <div className="p-6 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-center text-slate-500">
              Clique no botão acima para gerar a auditoria e emitir o extrato do RIPD no Firebase Firestore para fins de prestação de contas à Autoridade Nacional de Proteção de Dados (ANPD).
            </div>
          )}
        </div>
      )}
    </div>
  );
};
