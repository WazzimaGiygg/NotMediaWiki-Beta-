import { SEED_USERS, UserSession } from '../data/seedData';

export type UserRole = 'sysop' | 'bureaucrat' | 'moderator' | 'editor' | 'reader' | 'bot';

export interface PermissionCheck {
  allowed: boolean;
  reason?: string;
}

export class CentralAuthService {
  private users: Map<string, UserSession> = new Map();
  private currentActiveUserId: string = 'mafersao1100';

  constructor() {
    SEED_USERS.forEach(u => this.users.set(u.id, u));
  }

  public getUsers(): UserSession[] {
    return Array.from(this.users.values());
  }

  public deleteUser(userId: string): boolean {
    const deleted = this.users.delete(userId);
    if (this.currentActiveUserId === userId) {
      const remaining = Array.from(this.users.values())[0];
      if (remaining) {
        this.currentActiveUserId = remaining.id;
      }
    }
    return deleted;
  }

  public getUser(userId: string): UserSession | undefined {
    return this.users.get(userId);
  }

  public getCurrentUser(): UserSession {
    return this.users.get(this.currentActiveUserId) || SEED_USERS[0];
  }

  public switchUser(userId: string): UserSession {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }
    this.currentActiveUserId = userId;
    return user;
  }

  public updateUser(userId: string, data: Partial<UserSession>): UserSession {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    if (data.role) user.role = data.role;
    if (data.username) user.username = data.username;
    if (data.isBanned !== undefined) user.isBanned = data.isBanned;
    if (data.banReason !== undefined) user.banReason = data.banReason;
    if (data.bannedAt !== undefined) user.bannedAt = data.bannedAt;
    if (data.email !== undefined) user.email = data.email;

    return user;
  }

  public banUser(userId: string, reason: string): UserSession {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }
    user.isBanned = true;
    user.banReason = reason || 'Violação das diretrizes comunitárias';
    user.bannedAt = new Date().toISOString();
    return user;
  }

  public unbanUser(userId: string): UserSession {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }
    user.isBanned = false;
    user.banReason = undefined;
    user.bannedAt = undefined;
    return user;
  }

  public createUser(data: { username: string; role: UserRole; email?: string }): UserSession {
    const id = `usr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
    const newUser: UserSession = {
      id,
      username: data.username,
      role: data.role,
      editCount: 0,
      avatar: data.username.substring(0, 2).toUpperCase(),
      email: data.email,
      isBanned: false,
    };
    this.users.set(id, newUser);
    return newUser;
  }

  public upsertUser(user: Partial<UserSession> & { id: string; username: string }): UserSession {
    const existing = this.users.get(user.id);
    if (existing) {
      if (user.role) existing.role = user.role;
      if (user.username) existing.username = user.username;
      if (user.email !== undefined) existing.email = user.email;
      if (user.editCount !== undefined) existing.editCount = user.editCount;
      if (user.avatar) existing.avatar = user.avatar;
      if (user.isBanned !== undefined) existing.isBanned = user.isBanned;
      if (user.banReason !== undefined) existing.banReason = user.banReason;
      if (user.bannedAt !== undefined) existing.bannedAt = user.bannedAt;
      if (user.isGoogleUser !== undefined) existing.isGoogleUser = user.isGoogleUser;
      if (user.photoURL !== undefined) existing.photoURL = user.photoURL;
      if (user.provider !== undefined) existing.provider = user.provider;
      if (user.lastLoginAt !== undefined) existing.lastLoginAt = user.lastLoginAt;
      if (user.syncedToCloudAt !== undefined) existing.syncedToCloudAt = user.syncedToCloudAt;
      return existing;
    } else {
      const newUser: UserSession = {
        id: user.id,
        username: user.username,
        role: user.role || 'editor',
        editCount: user.editCount || 0,
        avatar: user.avatar || user.username.substring(0, 2).toUpperCase(),
        email: user.email,
        isBanned: !!user.isBanned,
        banReason: user.banReason,
        bannedAt: user.bannedAt,
        isGoogleUser: !!user.isGoogleUser,
        photoURL: user.photoURL,
        provider: user.provider,
        lastLoginAt: user.lastLoginAt,
        syncedToCloudAt: user.syncedToCloudAt,
      };
      this.users.set(user.id, newUser);
      return newUser;
    }
  }

  public incrementEditCount(userId: string) {
    const user = this.users.get(userId);
    if (user) {
      user.editCount++;
    }
  }

  public checkPermission(
    user: UserSession,
    action: 'read' | 'edit' | 'delete' | 'rollback' | 'protect' | 'manage_mesh',
    isProtectedPage: boolean = false
  ): PermissionCheck {
    if (action === 'read') {
      return { allowed: true };
    }

    // Check if user is banned
    if (user.isBanned) {
      return {
        allowed: false,
        reason: `Esta conta está banida (${user.banReason || 'Acesso revogado'}). Você não tem permissão para realizar edições ou ações no sistema.`,
      };
    }

    if (user.role === 'reader') {
      return { allowed: false, reason: 'Leitores anônimos não podem editar conteúdo. Faça login como Editor ou Moderador.' };
    }

    // Moderador and Sysop can edit protected pages
    if (action === 'edit' && isProtectedPage && !['sysop', 'bureaucrat', 'moderator', 'bot'].includes(user.role)) {
      return { allowed: false, reason: 'Esta página está protegida. Apenas moderadores e administradores podem editá-la.' };
    }

    // Rollback permission
    if (action === 'rollback' && !['sysop', 'bureaucrat', 'moderator'].includes(user.role)) {
      return { allowed: false, reason: 'Permissão de rollback requer privilégios de Moderador ou Administrador.' };
    }

    // Delete permission
    if (action === 'delete' && !['sysop', 'bureaucrat', 'moderator'].includes(user.role)) {
      return { allowed: false, reason: 'A exclusão de páginas requer privilégios de Moderador ou Administrador.' };
    }

    // Protect permission
    if (action === 'protect' && !['sysop', 'bureaucrat', 'moderator'].includes(user.role)) {
      return { allowed: false, reason: 'Proteger páginas requer privilégios de Moderador ou Administrador.' };
    }

    return { allowed: true };
  }
}

export const centralAuthService = new CentralAuthService();
