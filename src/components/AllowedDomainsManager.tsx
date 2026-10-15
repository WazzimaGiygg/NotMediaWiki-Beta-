import React, { useState, useEffect } from 'react';
import {
  Globe,
  Plus,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Search,
  ExternalLink,
  Cloud,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Lock,
  Unlock,
  Check,
  X,
} from 'lucide-react';
import { AllowedDomain, UserSession } from '../types';
import { api } from '../api';
import { FIRESTORE_DATABASE_ID } from '../firebaseConfig';
import { wrapExternalUrl } from '../utils/urlHelper';

interface AllowedDomainsManagerProps {
  currentUser?: UserSession | null;
  onDomainAdded?: (domain: AllowedDomain) => void;
}

export const AllowedDomainsManager: React.FC<AllowedDomainsManagerProps> = ({
  currentUser,
  onDomainAdded,
}) => {
  const [domains, setDomains] = useState<AllowedDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  // Add Domain Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newStatus, setNewStatus] = useState<'allowed' | 'trusted' | 'blocked'>('allowed');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Status feedback toast
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const isBureaucrat =
    currentUser?.role === 'bureaucrat' ||
    currentUser?.role === 'sysop' ||
    currentUser?.username?.toLowerCase().includes('burocrata') ||
    currentUser?.username?.toLowerCase().includes('nodearchitect');

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => {
      setFeedback(prev => (prev?.message === message ? null : prev));
    }, 4000);
  };

  const loadDomains = async () => {
    setLoading(true);
    try {
      const data = await api.getAllowedDomains();
      setDomains(data);
      setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
    } catch (err: any) {
      console.error('Error fetching allowed domains from Firebase:', err);
      showToast(`Erro ao carregar domínios do Firebase: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDomains();

    // Sincronização em tempo real das alterações feitas por burocratas no Firestore
    const unsub = api.subscribeAllowedDomains(
      cloudDomains => {
        if (cloudDomains && cloudDomains.length > 0) {
          setDomains(cloudDomains);
          setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
        }
      },
      err => {
        console.warn('Realtime subscription notice for allowed_domains:', err);
      }
    );

    return () => unsub();
  }, []);

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;

    const clean = newDomain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0];

    // Check duplicate
    if (domains.some(d => d.domain.toLowerCase() === clean)) {
      showToast(`O domínio "${clean}" já está registrado no Firebase!`, 'info');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await api.saveAllowedDomain(
        {
          domain: clean,
          description: newDescription.trim() || undefined,
          status: newStatus,
        },
        currentUser
      );

      setDomains(prev => [created, ...prev.filter(d => d.id !== created.id)]);
      showToast(
        `Domínio "${created.domain}" adicionado com sucesso direto no Firebase Firestore pelo Burocrata!`,
        'success'
      );
      if (onDomainAdded) onDomainAdded(created);

      // Reset form
      setNewDomain('');
      setNewDescription('');
      setNewStatus('allowed');
      setIsAddModalOpen(false);
    } catch (err: any) {
      showToast(`Falha ao salvar domínio no Firebase: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDomain = async (domainItem: AllowedDomain) => {
    if (
      !window.confirm(
        `Tem certeza que deseja remover o domínio "${domainItem.domain}" diretamente do Firebase Firestore?`
      )
    ) {
      return;
    }

    try {
      await api.deleteAllowedDomain(domainItem.id, currentUser);
      setDomains(prev => prev.filter(d => d.id !== domainItem.id));
      showToast(
        `Domínio "${domainItem.domain}" removido com sucesso do Firebase Firestore!`,
        'success'
      );
    } catch (err: any) {
      showToast(`Erro ao remover domínio do Firebase: ${err.message}`, 'error');
    }
  };

  const handleToggleStatus = async (domainItem: AllowedDomain) => {
    const nextStatus: 'allowed' | 'trusted' | 'blocked' =
      domainItem.status === 'blocked' ? 'allowed' : domainItem.status === 'allowed' ? 'trusted' : 'blocked';

    try {
      const updated = await api.saveAllowedDomain(
        {
          ...domainItem,
          status: nextStatus,
        },
        currentUser
      );

      setDomains(prev => prev.map(d => (d.id === domainItem.id ? updated : d)));
      showToast(
        `Status de "${domainItem.domain}" alterado para ${nextStatus.toUpperCase()} no Firebase!`,
        'success'
      );
    } catch (err: any) {
      showToast(`Erro ao atualizar status: ${err.message}`, 'error');
    }
  };

  const filteredDomains = domains.filter(d => {
    const matchesSearch =
      d.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      d.addedBy.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalAllowed = domains.filter(d => d.status === 'allowed' || d.status === 'trusted').length;
  const totalTrusted = domains.filter(d => d.status === 'trusted').length;
  const totalBlocked = domains.filter(d => d.status === 'blocked').length;

  return (
    <div className="space-y-6">
      {/* Top Banner: Governança de Domínios Permitidos no Firebase */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span>Domínios Permitidos no Firebase • Governança do Burocrata</span>
              </h2>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-sans mt-1">
              Controle de lista branca (whitelist) e exceções de roteamento de links externos gerenciadas diretamente no Cloud Firestore.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Adicionar novo domínio permitido ao Firebase"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar Domínio</span>
            </button>

            <button
              onClick={loadDomains}
              disabled={loading}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Recarregar lista do Firebase Firestore"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>
          </div>
        </div>

        {/* Firebase Cloud Info Bar */}
        <div className="mt-3.5 p-2.5 rounded-md bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="font-semibold text-emerald-900 dark:text-emerald-300">
              Coleção Firestore:
            </span>
            <code className="text-[11px] font-mono text-emerald-800 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-900/50 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800">
              /allowed_domains
            </code>
            <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono hidden sm:inline">
              ({FIRESTORE_DATABASE_ID})
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-emerald-800 dark:text-emerald-300">
            <span>
              Operado por:{' '}
              <strong className="underline">
                {currentUser?.username || 'Burocrata'} [{currentUser?.role || 'bureaucrat'}]
              </strong>
            </span>
            {lastSyncTime && (
              <span className="font-mono opacity-80">Última sinc: {lastSyncTime}</span>
            )}
          </div>
        </div>

        {/* 4 Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
          <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Total no Firebase</span>
              <Globe className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-0.5">
              {domains.length}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              Registros no banco
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Permitidos (Whitelist)</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
              {totalAllowed}
            </div>
            <div className="text-[10px] text-emerald-700 dark:text-emerald-300 mt-0.5 font-medium">
              Conexões autorizadas
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Altamente Confiáveis</span>
              <Shield className="w-3.5 h-3.5 text-purple-500" />
            </div>
            <div className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400 mt-0.5">
              {totalTrusted}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              Ecosistema central
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Bloqueados</span>
              <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
            </div>
            <div className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">
              {totalBlocked}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              Filtro ativo de SPAM
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-3 rounded text-xs flex items-center justify-between border animate-in fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : feedback.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : feedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <Cloud className="w-4 h-4 text-blue-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Filtrar por nome de domínio, descrição ou burocrata..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              ×
            </button>
          )}
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
          >
            <option value="all">Todos os Status</option>
            <option value="allowed">Somente Permitidos</option>
            <option value="trusted">Somente Confiáveis</option>
            <option value="blocked">Somente Bloqueados</option>
          </select>
        </div>
      </div>

      {/* Allowed Domains Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Domínio Permitido</th>
                <th className="py-3 px-4">Status no Firebase</th>
                <th className="py-3 px-4">Finalidade / Descrição</th>
                <th className="py-3 px-4">Cadastrado por (Burocrata)</th>
                <th className="py-3 px-4">Data no Firestore</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
              {filteredDomains.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 dark:text-slate-500">
                    <Globe className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="font-medium text-xs">Nenhum domínio encontrado</p>
                    <p className="text-[11px] mt-0.5">
                      Clique em &quot;Adicionar Domínio&quot; para registrar um novo domínio direto no Firebase.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredDomains.map(item => {
                  const isTrusted = item.status === 'trusted';
                  const isBlocked = item.status === 'blocked';
                  const isAllowed = item.status === 'allowed';

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      {/* Domain */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div
                            className={`p-1.5 rounded ${
                              isTrusted
                                ? 'bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                                : isBlocked
                                ? 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                                : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                            }`}
                          >
                            <Globe className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-slate-100 font-mono text-xs flex items-center gap-1.5">
                              <span>{item.domain}</span>
                              <a
                                href={wrapExternalUrl(`https://${item.domain}`)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                                title={`Testar abertura de https://${item.domain}`}
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              id: {item.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleStatus(item)}
                          className="cursor-pointer group flex items-center gap-1"
                          title="Clique para alternar o status do domínio no Firebase"
                        >
                          {isTrusted ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-700 bg-purple-50 dark:bg-purple-950 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                              <Shield className="w-3 h-3 text-purple-600" />
                              Confiável (Core)
                            </span>
                          ) : isBlocked ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 dark:bg-rose-950 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                              <ShieldAlert className="w-3 h-3 text-rose-600" />
                              Bloqueado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              Permitido
                            </span>
                          )}
                          <span className="text-[9px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            (alterar)
                          </span>
                        </button>
                      </td>

                      {/* Description */}
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                        {item.description || 'Sem descrição cadastrada'}
                      </td>

                      {/* Added By */}
                      <td className="py-3 px-4">
                        <div className="text-slate-800 dark:text-slate-200 font-medium">
                          {item.addedBy}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {item.addedByRole}
                        </div>
                      </td>

                      {/* Timestamp */}
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleDeleteDomain(item)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded transition-colors cursor-pointer"
                            title="Remover do banco Firebase"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: ADICIONAR DOMÍNIO PERMITIDO DIRETO NO FIREBASE */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    Adicionar Domínio Permitido ao Firebase
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Ação executada com autoridade de Burocrata
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleAddDomain} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Domínio (FQDN): <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={newDomain}
                    onChange={e => setNewDomain(e.target.value)}
                    placeholder="ex: docs.python.org, stackoverflow.com..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-slate-900 dark:text-slate-100 font-mono text-xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Não é necessário incluir https:// ou www. O sistema normaliza automaticamente.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Status no Firebase:
                </label>
                <select
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-slate-900 dark:text-slate-100 text-xs outline-none cursor-pointer"
                >
                  <option value="allowed">🟢 Permitido (Whitelist padrão)</option>
                  <option value="trusted">🟣 Altamente Confiável (Ecosistema WazzimaGiygg / Wikimedia)</option>
                  <option value="blocked">🔴 Bloqueado (Filtro de SPAM e Phishing)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Finalidade / Justificativa do Burocrata:
                </label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="Explique por que este domínio está sendo adicionado à lista branca do wiki..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-slate-900 dark:text-slate-100 text-xs outline-none focus:border-blue-600"
                />
              </div>

              {/* Firestore Info Note */}
              <div className="p-3 rounded bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-[11px] text-blue-800 dark:text-blue-300 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Gravação Direta no Firestore</span>
                </div>
                <p>
                  O registro será salvo na coleção <code>/allowed_domains</code> do banco <code>{FIRESTORE_DATABASE_ID}</code> com assinatura do burocrata <strong>{currentUser?.username || 'Burocrata'}</strong>.
                </p>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Salvando no Firebase...' : 'Salvar no Firebase'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
