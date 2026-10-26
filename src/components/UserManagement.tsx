import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
  Search,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  X,
  Lock,
  Unlock,
  Cloud,
  Trash2,
  Globe,
  Fingerprint,
  Scale,
} from 'lucide-react';
import { UserSession, UserRole } from '../types';
import { api } from '../api';
import { syncMediaWikiToFirestore, syncAllUsersWithFirestore, subscribeToFirestoreUsers } from '../firebase';

interface UserManagementProps {
  currentUser: UserSession | null;
  onUserChanged?: (user: UserSession) => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({ currentUser, onUserChanged }) => {
  const [users, setUsers] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [isSyncingFirebase, setIsSyncingFirebase] = useState(false);

  // Ban Modal state
  const [banModalUser, setBanModalUser] = useState<UserSession | null>(null);
  const [banReason, setBanReason] = useState('Vandalismo ou quebra de diretrizes comunitárias');
  const [isBanning, setIsBanning] = useState(false);

  // New User Modal state
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('editor');
  const [newEmail, setNewEmail] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Status feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchUsers = () => {
    setLoading(true);
    // Strictly load all registered users from Firestore database
    api.getUsers()
      .then(res => {
        setUsers(res);
        setLoading(false);
      })
      .catch(e => {
        console.error('Error fetching users from Firestore:', e);
        setLoading(false);
      });
  };

  const handleDeleteUser = async (user: UserSession) => {
    if (!window.confirm(`Tem certeza que deseja remover o usuário "${user.username}" (${user.email || user.id}) do banco de dados do Firebase Firestore? Esta conta será excluída permanentemente.`)) {
      return;
    }

    try {
      await api.deleteUser(user.id);
      setUsers(prev => prev.filter(u => u.id !== user.id));
      setFeedback({
        type: 'success',
        message: `Usuário "${user.username}" removido do banco de dados do Firebase com sucesso!`,
      });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Falha ao remover usuário do Firebase: ${err.message}`,
      });
    }
  };

  const handlePurgeNonFirebaseUsers = async () => {
    setIsSyncingFirebase(true);
    try {
      const cloudUsers = await api.getUsers();
      // Identify any user with mock ID or not in cloud
      const nonFirebase = users.filter(u => u.id.startsWith('usr-') || !cloudUsers.some(cu => cu.id === u.id));
      
      for (const u of nonFirebase) {
        await api.deleteUser(u.id);
      }

      const fresh = await api.getUsers();
      setUsers(fresh);
      setFeedback({
        type: 'success',
        message: `Varredura concluída! Apenas usuários registrados no banco de dados do Firebase estão ativos no sistema (${fresh.length} usuário(s) autenticado(s)).`,
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Erro na varredura de usuários: ${err.message}`,
      });
    } finally {
      setIsSyncingFirebase(false);
    }
  };

  useEffect(() => {
    fetchUsers();

    const unsubscribe = subscribeToFirestoreUsers(
      liveUsers => {
        // Exclude any mock users
        const verifiedFirebaseUsers = (liveUsers || []).filter(u => !u.id.startsWith('usr-'));
        setUsers(verifiedFirebaseUsers);
        setLoading(false);
      },
      err => {
        console.warn('Real-time users subscription notice:', err);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  const handleSyncWithFirebase = async () => {
    setIsSyncingFirebase(true);
    try {
      const res = await syncAllUsersWithFirestore();
      const verified = res.users.filter(u => !u.id.startsWith('usr-'));
      setUsers(verified);
      setFeedback({
        type: 'success',
        message: `Sincronização concluída! ${verified.length} conta(s) registrada(s) no Cloud Firestore.`,
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      console.error(err);
      setFeedback({
        type: 'error',
        message: err.message || 'Falha ao sincronizar usuários com o Firebase Firestore',
      });
    } finally {
      setIsSyncingFirebase(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      const updated = await api.updateUser(userId, { role: newRole });
      setUsers(users.map(u => (u.id === userId ? updated : u)));

      if (currentUser?.id === userId && onUserChanged) {
        onUserChanged(updated);
      }

      // Sync updated user to Firestore
      await syncMediaWikiToFirestore({
        articles: [],
        revisions: [],
        events: [],
        users: [updated],
      }).catch(console.warn);

      setFeedback({
        type: 'success',
        message: `Papel de ${updated.username} alterado para ${newRole.toUpperCase()} e sincronizado com o Firebase!`,
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Falha ao atualizar papel do usuário' });
    }
  };

  const handleConfirmBan = async () => {
    if (!banModalUser) return;
    setIsBanning(true);

    try {
      const updated = await api.banUser(banModalUser.id, banReason);
      setUsers(users.map(u => (u.id === banModalUser.id ? updated : u)));

      if (currentUser?.id === banModalUser.id && onUserChanged) {
        onUserChanged(updated);
      }

      // Sync ban status to Firestore
      await syncMediaWikiToFirestore({
        articles: [],
        revisions: [],
        events: [],
        users: [updated],
      }).catch(console.warn);

      setFeedback({
        type: 'success',
        message: `Usuário ${updated.username} foi banido com sucesso e status persistido na nuvem.`,
      });
      setBanModalUser(null);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Falha ao banir usuário' });
    } finally {
      setIsBanning(false);
    }
  };

  const handleUnban = async (user: UserSession) => {
    try {
      const updated = await api.unbanUser(user.id);
      setUsers(users.map(u => (u.id === user.id ? updated : u)));

      if (currentUser?.id === user.id && onUserChanged) {
        onUserChanged(updated);
      }

      // Sync unban to Firestore
      await syncMediaWikiToFirestore({
        articles: [],
        revisions: [],
        events: [],
        users: [updated],
      }).catch(console.warn);

      setFeedback({
        type: 'success',
        message: `Banimento de ${updated.username} foi revogado com sucesso!`,
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Falha ao revogar banimento' });
    }
  };

  const handleSwitchUser = async (user: UserSession) => {
    try {
      const switched = await api.switchUser(user.id);
      if (onUserChanged) {
        onUserChanged(switched);
      }
      setFeedback({
        type: 'success',
        message: `Sessão ativa alterada para "${switched.username}" (${switched.role}${switched.isBanned ? ' - BANIDO' : ''})!`,
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Falha ao alternar usuário' });
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;
    setIsCreatingUser(true);

    try {
      const created = await api.createUser({
        username: newUsername.trim(),
        role: newRole,
        email: newEmail.trim() || undefined,
      });

      setUsers([...users, created]);

      // Sync new user to Firestore
      await syncMediaWikiToFirestore({
        articles: [],
        revisions: [],
        events: [],
        users: [created],
      }).catch(console.warn);

      setFeedback({
        type: 'success',
        message: `Novo usuário ${created.username} criado com sucesso e sincronizado no Firebase!`,
      });
      setIsNewUserModalOpen(false);
      setNewUsername('');
      setNewEmail('');
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Falha ao criar usuário' });
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Filtered users
  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRole =
      roleFilter === 'all' ||
      (roleFilter === 'moderator' && (u.role === 'moderator' || u.role === 'sysop' || u.role === 'bureaucrat')) ||
      u.role === roleFilter;

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'banned' && !!u.isBanned) ||
      (statusFilter === 'active' && !u.isBanned);

    const matchesProvider =
      providerFilter === 'all' ||
      (providerFilter === 'google' && (!!u.isGoogleUser || u.provider === 'google.com' || !!u.email));

    return matchesSearch && matchesRole && matchesStatus && matchesProvider;
  });

  const totalGoogleUsers = users.filter(u => !!u.isGoogleUser || u.provider === 'google.com' || !!u.email).length;
  const totalModerators = users.filter(u => u.role === 'moderator' || u.role === 'sysop' || u.role === 'bureaucrat').length;
  const totalEditors = users.filter(u => u.role === 'editor').length;
  const totalBanned = users.filter(u => !!u.isBanned).length;

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-4 bg-white border border-slate-200 rounded">
          <div className="text-xs text-slate-500 font-sans">Total de Usuários</div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
            {users.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Cadastrados no sistema</div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded">
          <div className="text-xs text-slate-500 font-sans">Contas Google</div>
          <div className="text-2xl font-bold font-mono text-blue-600 mt-1">
            {totalGoogleUsers}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Autenticadas via Firebase</div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded">
          <div className="text-xs text-slate-500 font-sans">Moderadores & Sysops</div>
          <div className="text-2xl font-bold font-mono text-indigo-700 mt-1">
            {totalModerators}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Permissão de moderação total</div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded">
          <div className="text-xs text-slate-500 font-sans">Editores Ativos</div>
          <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">
            {totalEditors}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Permissão para criar e editar</div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded">
          <div className="text-xs text-slate-500 font-sans">Usuários Banidos</div>
          <div className="text-2xl font-bold font-mono text-rose-700 mt-1">
            {totalBanned}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Edições e ações revogadas</div>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-3 rounded text-xs flex items-center justify-between border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter and Action Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative w-full md:max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome ou e-mail..."
              className="w-full bg-slate-50 border border-slate-200 pl-9 pr-3 py-1.5 rounded text-xs text-slate-800 outline-none focus:bg-white focus:border-blue-600"
            />
          </div>

          {/* Filter Selectors & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-700 outline-none"
            >
              <option value="all">Todos os Papéis</option>
              <option value="moderator">Moderadores</option>
              <option value="editor">Editores</option>
              <option value="reader">Leitores</option>
              <option value="bot">Bots</option>
            </select>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-700 outline-none"
            >
              <option value="all">Todos os Status</option>
              <option value="active">Apenas Ativos</option>
              <option value="banned">Apenas Banidos</option>
            </select>

            <select
              value={providerFilter}
              onChange={e => setProviderFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-700 outline-none"
            >
              <option value="all">Todas as Contas (Firebase)</option>
              <option value="google">Autenticação Google Firebase</option>
            </select>

            {/* Sincronizar Firebase Button */}
            <button
              onClick={handleSyncWithFirebase}
              disabled={isSyncingFirebase}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
              title="Sincronizar usuários existentes no banco Firestore e dos logins Google"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingFirebase ? 'animate-spin' : ''}`} />
              <span>{isSyncingFirebase ? 'Sincronizando...' : 'Sincronizar Firebase'}</span>
            </button>

            {/* Limpar Usuários Não-Cadastrados */}
            <button
              onClick={handlePurgeNonFirebaseUsers}
              disabled={isSyncingFirebase}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Garante que apenas usuários presentes no banco de dados do Firebase Firestore permaneçam ativos"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Limpar Não-Cadastrados</span>
            </button>

            {/* Gerenciar Domínios Permitidos no Firebase (Burocrata) */}
            <button
              onClick={() => {
                window.location.hash = '#/domains';
              }}
              className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Gerenciar lista de domínios permitidos direto no Firebase (Acesso Burocrata)"
            >
              <Globe className="w-3.5 h-3.5 text-purple-600" />
              <span>Domínios Permitidos</span>
            </button>

            {/* CheckUser - Verificação de Contas e Fantoches */}
            <button
              onClick={() => {
                window.location.hash = '#/checkuser';
              }}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Verificação telemática de contas simultâneas e combate a fantoches"
            >
              <Fingerprint className="w-3.5 h-3.5 text-indigo-600" />
              <span>CheckUser (Fantoches)</span>
            </button>

            {/* Conselho de Arbitragem */}
            <button
              onClick={() => {
                window.location.hash = '#/arbitration';
              }}
              className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Instância suprema para resolução de disputas editoriais e conduta"
            >
              <Scale className="w-3.5 h-3.5 text-purple-600" />
              <span>Conselho de Arbitragem</span>
            </button>

            <button
              onClick={() => setIsNewUserModalOpen(true)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar Usuário</span>
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="border border-slate-200 rounded bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-semibold">
                <th className="py-3 px-4">Usuário</th>
                <th className="py-3 px-4">Papel no Sistema</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Edições Realizadas</th>
                <th className="py-3 px-4 text-right">Ações de Moderação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 font-mono">
                    Carregando registros de usuários...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Nenhum usuário corresponde aos filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const isCurrent = user.id === currentUser?.id;
                  const isModerator = user.role === 'moderator' || user.role === 'sysop' || user.role === 'bureaucrat';

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* User Info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          {user.photoURL ? (
                            <img
                              src={user.photoURL}
                              alt={user.username}
                              className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <span className={`w-7 h-7 rounded flex items-center justify-center font-bold text-xs shrink-0 ${
                              user.isBanned
                                ? 'bg-rose-100 text-rose-700 border border-rose-300'
                                : isModerator
                                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}>
                              {user.avatar || 'U'}
                            </span>
                          )}
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">
                              <span>{user.username}</span>
                              {isCurrent && (
                                <span className="text-[10px] text-blue-600 font-normal">(Você)</span>
                              )}
                              {(user.isGoogleUser || user.provider === 'google.com' || (user.email && !user.id.startsWith('usr-'))) && (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200"
                                  title="Autenticado via Google Firebase Auth"
                                >
                                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"/>
                                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"/>
                                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"/>
                                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"/>
                                  </svg>
                                  Google
                                </span>
                              )}
                            </div>
                            {user.email && (
                              <div className="text-[11px] text-slate-400 font-mono">{user.email}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Role Dropdown */}
                      <td className="py-3 px-4">
                        <select
                          value={user.role}
                          onChange={e => handleRoleChange(user.id, e.target.value as UserRole)}
                          disabled={user.isBanned}
                          className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-800 outline-none focus:border-blue-600 font-medium disabled:opacity-50"
                        >
                          <option value="bureaucrat">🏛️ Burocrata</option>
                          <option value="sysop">👑 Sysop (Admin)</option>
                          <option value="moderator">🛡️ Moderador</option>
                          <option value="editor">✍️ Editor</option>
                          <option value="reader">👤 Leitor (Apenas Leitura)</option>
                          <option value="bot">🤖 Bot</option>
                        </select>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {user.isBanned ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              <ShieldAlert className="w-3 h-3 text-rose-600" />
                              Banido
                            </span>
                            {user.banReason && (
                              <div className="text-[10px] text-slate-500 italic max-w-xs truncate">
                                Motivo: {user.banReason}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Ativo
                          </span>
                        )}
                      </td>

                      {/* Edit Count */}
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {(user.editCount ?? 0).toLocaleString()} edições
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Switch to act as this user for testing permissions */}
                          {!isCurrent && (
                            <button
                              onClick={() => handleSwitchUser(user)}
                              className="px-2 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                              title="Testar a interface e permissões com este usuário"
                            >
                              Testar Sessão
                            </button>
                          )}

                          {/* Quick promote to Moderator if editor */}
                          {!user.isBanned && user.role === 'editor' && (
                            <button
                              onClick={() => handleRoleChange(user.id, 'moderator')}
                              className="px-2.5 py-1 text-[11px] font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200 transition-colors"
                              title="Promover a Moderador"
                            >
                              Tornar Moderador
                            </button>
                          )}

                          {/* Quick demote to Editor if moderator */}
                          {!user.isBanned && user.role === 'moderator' && (
                            <button
                              onClick={() => handleRoleChange(user.id, 'editor')}
                              className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-200 transition-colors"
                              title="Definir como Editor"
                            >
                              Definir como Editor
                            </button>
                          )}

                          {/* Ban or Unban button */}
                          {user.isBanned ? (
                            <button
                              onClick={() => handleUnban(user)}
                              className="px-2.5 py-1 text-[11px] font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors flex items-center gap-1 shadow-2xs"
                              title="Restaurar acesso do usuário"
                            >
                              <Unlock className="w-3 h-3" />
                              Desbanir
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setBanModalUser(user);
                                setBanReason('Vandalismo ou quebra de diretrizes comunitárias');
                              }}
                              disabled={isCurrent}
                              className="px-2.5 py-1 text-[11px] font-medium bg-rose-50 hover:bg-rose-100 text-rose-700 rounded border border-rose-200 transition-colors flex items-center gap-1 disabled:opacity-40"
                              title={isCurrent ? 'Você não pode banir sua própria conta' : 'Banir usuário do sistema'}
                            >
                              <Lock className="w-3 h-3 text-rose-600" />
                              Banir
                            </button>
                          )}

                          {/* Delete from Firebase button */}
                          <button
                            onClick={() => handleDeleteUser(user)}
                            disabled={isCurrent}
                            className="px-2.5 py-1 text-[11px] font-medium bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded transition-colors flex items-center gap-1 disabled:opacity-30 cursor-pointer"
                            title={isCurrent ? 'Você não pode excluir sua própria conta conectada' : 'Remover este usuário permanentemente do banco de dados do Firebase'}
                          >
                            <Trash2 className="w-3 h-3 text-rose-500" />
                            Excluir
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

      {/* Modal: Ban User */}
      {banModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <h3 className="font-semibold text-slate-900 text-sm">
                  Banir Usuário: {banModalUser.username}
                </h3>
              </div>
              <button
                onClick={() => setBanModalUser(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Ao banir este usuário, ele perderá imediatamente a capacidade de editar páginas,
                gravar revisões e interagir com o sistema.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Motivo do Banimento:
                </label>
                <select
                  value={banReason}
                  onChange={e => setBanReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs text-slate-800 outline-none mb-2"
                >
                  <option value="Vandalismo ou quebra de diretrizes comunitárias">
                    Vandalismo ou quebra de diretrizes comunitárias
                  </option>
                  <option value="SPAM recorrente ou automação não autorizada">
                    SPAM recorrente ou automação não autorizada
                  </option>
                  <option value="Comportamento inadequado ou assédio">
                    Comportamento inadequado ou assédio
                  </option>
                  <option value="Violação de direitos autorais repetida">
                    Violação de direitos autorais repetida
                  </option>
                </select>

                <input
                  type="text"
                  value={banReason}
                  onChange={e => setBanReason(e.target.value)}
                  placeholder="Ou digite um motivo específico..."
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs text-slate-800 outline-none focus:bg-white focus:border-rose-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBanModalUser(null)}
                  className="px-3.5 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded text-xs font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBan}
                  disabled={isBanning}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-medium transition-colors shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Lock className="w-3.5 h-3.5" />
                  {isBanning ? 'Banindo...' : 'Confirmar Banimento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: New User */}
      {isNewUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-slate-900 text-sm">Adicionar Novo Usuário</h3>
              </div>
              <button
                onClick={() => setIsNewUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome de Usuário:
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  placeholder="Ex: NovoModerador, EditorEspecialista..."
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs text-slate-800 outline-none focus:bg-white focus:border-blue-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  E-mail (Opcional):
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="usuario@dominio.com"
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs text-slate-800 outline-none focus:bg-white focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Papel Inicial:
                </label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as UserRole)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs text-slate-800 outline-none"
                >
                  <option value="moderator">🛡️ Moderador (Moderação e reversão)</option>
                  <option value="editor">✍️ Editor (Criação e edição de artigos)</option>
                  <option value="reader">👤 Leitor (Apenas leitura)</option>
                  <option value="bot">🤖 Bot (Automação)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewUserModalOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded text-xs font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isCreatingUser ? 'Criando...' : 'Criar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
