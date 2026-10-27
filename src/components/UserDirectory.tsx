import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  MessageSquare,
  ExternalLink,
  Shield,
  Award,
  Calendar,
  Sparkles,
  UserCheck,
  RefreshCw,
  Hash,
  Zap,
  ThumbsUp,
} from 'lucide-react';
import { UserSession, UserRole } from '../types';
import { fetchUsersFromFirestore, subscribeToFirestoreUsers } from '../firebase';

interface UserDirectoryProps {
  currentUser: UserSession | null;
  onOpenUserPage: (user: UserSession) => void;
  onStartChatWithUser: (targetUser: UserSession) => void;
}

export const UserDirectory: React.FC<UserDirectoryProps> = ({
  currentUser,
  onOpenUserPage,
  onStartChatWithUser,
}) => {
  const [users, setUsers] = useState<UserSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('todos');
  const [sortBy, setSortBy] = useState<'edits' | 'name' | 'recent'>('edits');

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    fetchUsersFromFirestore()
      .then(list => {
        if (!isMounted) return;
        setUsers(list || []);
        setIsLoading(false);
      })
      .catch(err => {
        console.warn('Notice: Error loading directory users from Firestore:', err);
        if (isMounted) setIsLoading(false);
      });

    const unsubscribe = subscribeToFirestoreUsers(liveUsers => {
      if (isMounted) {
        setUsers(liveUsers || []);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'bureaucrat':
        return {
          label: 'Burocrata',
          bg: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800',
        };
      case 'sysop':
        return {
          label: 'Administrador',
          bg: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800',
        };
      case 'moderator':
        return {
          label: 'Moderador',
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800',
        };
      default:
        return {
          label: 'Editor',
          bg: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        };
    }
  };

  const filteredUsers = users
    .filter(u => {
      const query = searchTerm.toLowerCase();
      const matchesSearch =
        u.username.toLowerCase().includes(query) ||
        (u.userTag && u.userTag.toLowerCase().includes(query)) ||
        (u.email && u.email.toLowerCase().includes(query)) ||
        (u.bio && u.bio.toLowerCase().includes(query));

      if (!matchesSearch) return false;
      if (roleFilter !== 'todos' && u.role !== roleFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'edits') return (b.editCount || 0) - (a.editCount || 0);
      if (sortBy === 'name') return a.username.localeCompare(b.username);
      if (sortBy === 'recent') {
        const timeA = new Date(a.lastLoginAt || 0).getTime();
        const timeB = new Date(b.lastLoginAt || 0).getTime();
        return timeB - timeA;
      }
      return 0;
    });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  Diretório Público de Usuários
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-sans mt-0.5">
                  Lista de colaboradores e membros registrados da comunidade NotMediaWiki. Identificação com tags exclusivas
                  para prevenção de homônimos.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-3 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-slate-700 dark:text-slate-300">
              {users.length} usuário(s) autenticado(s)
            </span>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 text-xs">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por nome, tag (#1100), e-mail ou biografia..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 text-[11px]">Papel:</span>
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
            >
              <option value="todos">Todos os Papéis</option>
              <option value="bureaucrat">Burocratas</option>
              <option value="sysop">Administradores</option>
              <option value="moderator">Moderadores</option>
              <option value="editor">Editores</option>
            </select>

            <span className="text-slate-400 text-[11px] ml-1">Ordenar:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
            >
              <option value="edits">Mais Edições</option>
              <option value="name">Nome (A - Z)</option>
              <option value="recent">Atividade Recente</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Grid */}
      {isLoading ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-16 text-center text-slate-500 text-xs">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
          Carregando diretório de usuários do Firebase Firestore...
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-12 text-center text-slate-500 text-xs space-y-2">
          <Users className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
          <div className="font-semibold text-slate-700 dark:text-slate-300 text-sm">Nenhum usuário localizado</div>
          <p className="text-slate-400">Tente buscar por outro termo ou limpar os filtros de papéis.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map(user => {
            const roleBadge = getRoleBadge(user.role);
            const isMe = currentUser?.id === user.id;

            return (
              <div
                key={user.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-2xs hover:shadow-xs transition-all space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-2xs">
                        {user.avatar || user.username.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">
                            {user.username}
                          </span>
                          <span className="font-mono text-purple-600 dark:text-purple-400 text-xs font-semibold">
                            {user.userTag || `#${Math.abs(user.id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0) % 9999 + 1).toString().padStart(4, '0')}`}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {user.email || 'Usuário Autenticado'}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${roleBadge.bg}`}
                    >
                      {roleBadge.label}
                    </span>
                  </div>

                  {user.bio ? (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2.5 line-clamp-2 italic">
                      "{user.bio}"
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-2.5">
                      Colaborador da comunidade NotMediaWiki.
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex-wrap">
                    <div className="flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400">
                      <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                      <span>{user.karma ?? 10} Karma</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-indigo-500" />
                      <span>
                        <strong className="text-slate-700 dark:text-slate-200">{user.editCount || 0}</strong> edições
                      </span>
                    </div>

                    {(user.positiveVotesReceived ?? 0) > 0 && (
                      <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span>{user.positiveVotesReceived} curtidas</span>
                      </div>
                    )}

                    {user.isGoogleUser && (
                      <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Google Auth</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => onOpenUserPage(user)}
                    className="flex-1 py-1.5 px-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                    <span>Página Pessoal</span>
                  </button>

                  {!isMe && (
                    <button
                      onClick={() => onStartChatWithUser(user)}
                      className="py-1.5 px-3 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Chat</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
