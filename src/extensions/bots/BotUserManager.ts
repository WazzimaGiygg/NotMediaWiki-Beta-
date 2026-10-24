import { BotUser, BotAgentId } from '../../types';
import { db } from '../../firebase';
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';

export const INITIAL_BOT_USERS: BotUser[] = [
  {
    id: 'bot_citation_0001',
    username: 'CitationBot',
    userTag: '#0001',
    displayName: 'CitationBot#0001',
    avatar: 'CB',
    description: 'Robô oficial para validação e auditoria de citações enciclopédicas (Gemini 3.8 Flash).',
    botFlag: true,
    isBot: true,
    role: 'bot',
    status: 'active',
    permissions: ['read', 'edit', 'flag_citations', 'suggest_sources'],
    assignedBotAgentId: 'citation_bot',
    createdAt: '2026-01-15T10:00:00.000Z',
    totalEdits: 142,
    lastActiveAt: new Date().toISOString(),
  },
  {
    id: 'bot_antivandal_0002',
    username: 'AntiVandalBot',
    userTag: '#0002',
    displayName: 'AntiVandalBot#0002',
    avatar: 'AV',
    description: 'Robô de segurança e patrulhamento contra esvaziamento massivo e vandalismo.',
    botFlag: true,
    isBot: true,
    role: 'bot',
    status: 'active',
    permissions: ['read', 'edit', 'rollback', 'protect_page', 'notify_admin'],
    assignedBotAgentId: 'antivandal_bot',
    createdAt: '2026-01-15T10:00:00.000Z',
    totalEdits: 289,
    lastActiveAt: new Date().toISOString(),
  },
  {
    id: 'bot_category_0003',
    username: 'CategoryBot',
    userTag: '#0003',
    displayName: 'CategoryBot#0003',
    avatar: 'CT',
    description: 'Robô de indexação taxonômica e categorização automática de artigos.',
    botFlag: true,
    isBot: true,
    role: 'bot',
    status: 'active',
    permissions: ['read', 'edit', 'apply_categories'],
    assignedBotAgentId: 'category_bot',
    createdAt: '2026-02-01T10:00:00.000Z',
    totalEdits: 89,
    lastActiveAt: new Date().toISOString(),
  },
  {
    id: 'bot_quality_0004',
    username: 'QualityBot',
    userTag: '#0004',
    displayName: 'QualityBot#0004',
    avatar: 'QB',
    description: 'Robô de auditoria de qualidade estrutural e maturidade enciclopédica.',
    botFlag: true,
    isBot: true,
    role: 'bot',
    status: 'active',
    permissions: ['read', 'edit', 'tag_quality', 'rate_article'],
    assignedBotAgentId: 'quality_bot',
    createdAt: '2026-02-10T10:00:00.000Z',
    totalEdits: 205,
    lastActiveAt: new Date().toISOString(),
  },
  {
    id: 'bot_linkchecker_0005',
    username: 'LinkCheckerBot',
    userTag: '#0005',
    displayName: 'LinkCheckerBot#0005',
    avatar: 'LK',
    description: 'Robô de integridade de links externos e marcação de referências inativas.',
    botFlag: true,
    isBot: true,
    role: 'bot',
    status: 'active',
    permissions: ['read', 'edit', 'tag_broken_links'],
    assignedBotAgentId: 'link_checker_bot',
    createdAt: '2026-02-15T10:00:00.000Z',
    totalEdits: 64,
    lastActiveAt: new Date().toISOString(),
  },
  {
    id: 'bot_lgpd_0006',
    username: 'LgpdBot',
    userTag: '#0006',
    displayName: 'LgpdBot#0006',
    avatar: 'LG',
    description: 'Robô de proteção de dados pessoais (Lei 13.709/2018) e moderação de PII.',
    botFlag: true,
    isBot: true,
    role: 'bot',
    status: 'active',
    permissions: ['read', 'edit', 'redact_pii', 'alert_dpo'],
    assignedBotAgentId: 'lgpd_bot',
    createdAt: '2026-03-01T10:00:00.000Z',
    totalEdits: 198,
    lastActiveAt: new Date().toISOString(),
  },
  {
    id: 'bot_useraudit_0007',
    username: 'UserAuditBot',
    userTag: '#0007',
    displayName: 'UserAuditBot#0007',
    avatar: 'UA',
    description: 'Robô auto-carregado para auditoria contínua de comportamento e abuso de usuários.',
    botFlag: true,
    isBot: true,
    role: 'bot',
    status: 'active',
    permissions: ['read', 'audit_users', 'flag_abuse', 'alert_sysop'],
    assignedBotAgentId: 'user_audit_bot',
    createdAt: '2026-03-10T10:00:00.000Z',
    totalEdits: 275,
    lastActiveAt: new Date().toISOString(),
  },
];

const STORAGE_KEY = 'notmediawiki_bot_users_tree';

export class BotUserManager {
  private users: BotUser[] = [];

  constructor() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      this.users = stored ? JSON.parse(stored) : INITIAL_BOT_USERS;
    } catch {
      this.users = INITIAL_BOT_USERS;
    }
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.users));
    } catch (e) {
      console.warn('Storage save error:', e);
    }
  }

  public async getBotUsers(): Promise<BotUser[]> {
    try {
      const snap = await getDocs(collection(db, 'bot_users'));
      if (!snap.empty) {
        const cloudUsers: BotUser[] = [];
        snap.forEach(d => cloudUsers.push(d.data() as BotUser));
        if (cloudUsers.length > 0) {
          this.users = cloudUsers;
          this.persist();
          return cloudUsers;
        }
      }
    } catch {
      // Fallback
    }
    return this.users;
  }

  public async upsertBotUser(user: Partial<BotUser> & { id: string }): Promise<BotUser> {
    const idx = this.users.findIndex(u => u.id === user.id);
    let updated: BotUser;

    if (idx >= 0) {
      updated = { ...this.users[idx], ...user };
      this.users[idx] = updated;
    } else {
      updated = {
        id: user.id,
        username: user.username || 'NovoBot',
        userTag: user.userTag || `#${Math.floor(1000 + Math.random() * 9000)}`,
        displayName: `${user.username || 'NovoBot'}${user.userTag || '#0001'}`,
        avatar: (user.username || 'NB').substring(0, 2).toUpperCase(),
        description: user.description || 'Conta de automação do NotMediaWiki',
        botFlag: true,
        role: 'bot',
        status: user.status || 'active',
        permissions: user.permissions || ['read', 'edit'],
        assignedBotAgentId: user.assignedBotAgentId || 'antivandal_bot',
        createdAt: new Date().toISOString(),
        totalEdits: user.totalEdits || 0,
        lastActiveAt: new Date().toISOString(),
      };
      this.users.push(updated);
    }

    this.persist();

    try {
      await setDoc(doc(db, 'bot_users', updated.id), updated, { merge: true });
    } catch (e) {
      console.warn('Cloud sync error for bot user:', e);
    }

    return updated;
  }

  public async deleteBotUser(id: string): Promise<boolean> {
    this.users = this.users.filter(u => u.id !== id);
    this.persist();

    try {
      await deleteDoc(doc(db, 'bot_users', id));
    } catch (e) {
      console.warn('Cloud delete error for bot user:', e);
    }
    return true;
  }
}

export const botUserManager = new BotUserManager();
