import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Search,
  Users,
  Circle,
  Hash,
  RefreshCw,
  UserPlus,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import { UserSession, DirectChat, ChatMessage } from '../types';
import {
  fetchUserChatsFromFirestore,
  subscribeToUserChats,
  fetchChatMessagesFromFirestore,
  subscribeToChatMessages,
  sendChatMessageToFirestore,
  createOrGetDirectChat,
  fetchUsersFromFirestore,
} from '../firebase';

interface ChatDrawerProps {
  currentUser: UserSession | null;
  isOpen: boolean;
  onClose: () => void;
  targetUserForNewChat?: UserSession | null;
  onClearTargetUser?: () => void;
}

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  currentUser,
  isOpen,
  onClose,
  targetUserForNewChat,
  onClearTargetUser,
}) => {
  const [chats, setChats] = useState<DirectChat[]>([]);
  const [activeChat, setActiveChat] = useState<DirectChat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);

  // User Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [allRegisteredUsers, setAllRegisteredUsers] = useState<UserSession[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Load user chats from Firestore
  useEffect(() => {
    if (!currentUser || !isOpen) return;

    let isMounted = true;
    fetchUserChatsFromFirestore(currentUser.id)
      .then(userChats => {
        if (!isMounted) return;
        setChats(userChats);
        if (userChats.length > 0 && !activeChat && !targetUserForNewChat) {
          setActiveChat(userChats[0]);
        }
      })
      .catch(console.warn);

    const unsubChats = subscribeToUserChats(currentUser.id, updated => {
      if (isMounted) {
        setChats(updated);
      }
    });

    // Also load registered users for the search bar
    fetchUsersFromFirestore()
      .then(usersList => {
        if (!isMounted) return;
        setAllRegisteredUsers(usersList.filter(u => u.id !== currentUser.id));
      })
      .catch(console.warn);

    return () => {
      isMounted = false;
      unsubChats();
    };
  }, [currentUser?.id, isOpen]);

  // 2. If targetUserForNewChat is passed, create or select that chat
  useEffect(() => {
    if (!currentUser || !targetUserForNewChat || !isOpen) return;

    createOrGetDirectChat(currentUser, targetUserForNewChat)
      .then(chat => {
        setActiveChat(chat);
        onClearTargetUser?.();
      })
      .catch(console.error);
  }, [currentUser, targetUserForNewChat, isOpen]);

  // 3. Subscribe to active chat messages in real time
  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    fetchChatMessagesFromFirestore(activeChat.id).then(msgs => {
      if (!isMounted) return;
      setMessages(msgs);
      scrollToBottom();
    });

    const unsubMessages = subscribeToChatMessages(activeChat.id, updatedMsgs => {
      if (isMounted) {
        setMessages(updatedMsgs);
        scrollToBottom();
      }
    });

    return () => {
      isMounted = false;
      unsubMessages();
    };
  }, [activeChat?.id]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChat || !currentUser || !newMessageText.trim()) return;

    const text = newMessageText.trim();
    setNewMessageText('');
    setIsSending(true);

    try {
      await sendChatMessageToFirestore(activeChat.id, {
        chatId: activeChat.id,
        senderId: currentUser.id,
        senderUsername: currentUser.username,
        senderTag: currentUser.userTag || '',
        senderAvatar: currentUser.avatar,
        senderRole: currentUser.role,
        text,
        read: false,
      });
      scrollToBottom();
    } catch (err: any) {
      alert(`Falha ao enviar mensagem: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleStartChatWith = async (targetUser: UserSession) => {
    if (!currentUser) return;
    try {
      const chat = await createOrGetDirectChat(currentUser, targetUser);
      setActiveChat(chat);
      setSearchQuery('');
    } catch (err: any) {
      alert(`Erro ao criar chat: ${err.message}`);
    }
  };

  if (!isOpen) return null;

  // Filter users in search
  const searchResults = searchQuery.trim()
    ? allRegisteredUsers.filter(u => {
        const q = searchQuery.toLowerCase();
        return (
          u.username.toLowerCase().includes(q) ||
          (u.userTag && u.userTag.toLowerCase().includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q))
        );
      })
    : [];

  const getRecipientInfo = (chat: DirectChat) => {
    if (!currentUser) return { name: 'Usuário', avatar: 'U', tag: '' };
    const otherId = chat.participants.find(id => id !== currentUser.id) || chat.participants[0];
    const name = chat.participantNames?.[otherId] || 'Usuário';
    const avatar = chat.participantAvatars?.[otherId] || 'U';
    const tag = chat.participantTags?.[otherId] || '';
    return { name, avatar, tag };
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full sm:w-[540px] h-[580px] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
      {/* Chat Window Header */}
      <div className="bg-slate-900 text-white p-3.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-xs text-white shadow-xs">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold leading-tight flex items-center gap-1.5">
              <span>Chat Comunitário em Tempo Real</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="text-[10px] text-slate-400 leading-tight">
              Sincronizado no Firebase Firestore • Mensagens instantâneas
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Conversations & User Search */}
        <div className="w-48 sm:w-56 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50/60 dark:bg-slate-900/60 shrink-0">
          {/* User Search Input */}
          <div className="p-2 border-b border-slate-200 dark:border-slate-800">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar usuário..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11px] text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* User Search Results or Active Chats */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {searchQuery.trim() ? (
              <div className="p-1.5 space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400 px-1 py-0.5">
                  Resultados da Busca ({searchResults.length})
                </div>
                {searchResults.length === 0 ? (
                  <div className="text-[11px] text-slate-400 p-2 text-center">Nenhum usuário encontrado</div>
                ) : (
                  searchResults.map(u => (
                    <button
                      key={u.id}
                      onClick={() => handleStartChatWith(u)}
                      className="w-full text-left p-1.5 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-full bg-indigo-500 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                        {u.avatar || u.username.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1 text-xs">
                        <div className="font-semibold text-slate-800 dark:text-slate-100 truncate flex items-center gap-1">
                          <span>{u.username}</span>
                          <span className="font-mono text-purple-600 text-[10px]">{u.userTag || ''}</span>
                        </div>
                        <div className="text-[9px] text-slate-400 truncate capitalize">{u.role}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : (
              chats.map(chat => {
                const recipient = getRecipientInfo(chat);
                const isSelected = activeChat?.id === chat.id;

                return (
                  <button
                    key={chat.id}
                    onClick={() => setActiveChat(chat)}
                    className={`w-full text-left p-2.5 transition-colors flex items-center gap-2.5 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 border-l-2 border-indigo-600'
                        : 'hover:bg-slate-100/60 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {recipient.avatar}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {recipient.name}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {chat.lastMessage || 'Conversa iniciada'}
                      </p>
                    </div>
                  </button>
                );
              })
            )}

            {chats.length === 0 && !searchQuery.trim() && (
              <div className="p-4 text-center text-slate-400 text-xs space-y-2">
                <Users className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-700" />
                <p>Nenhuma conversa ativa.</p>
                <p className="text-[10px] text-slate-400">Busque um usuário registrado pelo campo acima para iniciar.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Active Chat Messages Thread */}
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900">
          {activeChat ? (
            <>
              {/* Active Chat Header */}
              <div className="p-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {getRecipientInfo(activeChat).avatar}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-100 text-xs">
                      {getRecipientInfo(activeChat).name}
                    </div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>Conexão ativa no Firestore</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Message List */}
              <div className="flex-1 p-3 overflow-y-auto space-y-2.5 text-xs">
                {messages.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    Inicie a conversa digitando uma mensagem abaixo.
                  </div>
                ) : (
                  messages.map(msg => {
                    const isMe = msg.senderId === currentUser?.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-0.5 px-1">
                          <span>{msg.senderUsername}</span>
                          {msg.senderTag && <span className="font-mono text-purple-600">{msg.senderTag}</span>}
                          <span>•</span>
                          <span>{new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div
                          className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words ${
                            isMe
                              ? 'bg-indigo-600 text-white rounded-br-none shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-none border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Bar */}
              <form onSubmit={handleSendMessage} className="p-2 border-t border-slate-200 dark:border-slate-800 flex gap-2 shrink-0">
                <input
                  type="text"
                  placeholder="Digite sua mensagem (Enter para enviar)..."
                  value={newMessageText}
                  onChange={e => setNewMessageText(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={isSending || !newMessageText.trim()}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar</span>
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400 text-xs space-y-2">
              <MessageSquare className="w-10 h-10 text-slate-300 dark:text-slate-700" />
              <div className="font-semibold text-slate-600 dark:text-slate-300">Nenhuma conversa selecionada</div>
              <p className="text-[11px] max-w-xs">
                Selecione uma conversa ao lado ou busque um usuário registrado na barra de pesquisa para iniciar um chat
                instantâneo.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
