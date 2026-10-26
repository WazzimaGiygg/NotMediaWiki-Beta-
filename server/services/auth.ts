import { SEED_USERS, UserSession } from '../data/seedData';
import { getFirebaseAdmin } from '../firebaseAdmin';

export type UserRole = 'sysop' | 'bureaucrat' | 'moderator' | 'editor' | 'reader' | 'bot';

export interface PermissionCheck {
  allowed: boolean;
  reason?: string;
}

export class CentralAuthService {
  private users: Map<string, UserSession> = new Map();

  constructor() {
    // Populate seed users for development fallback
    SEED_USERS.forEach(u => this.users.set(u.id, { ...u }));
    this.hydrateFromFirestore().catch(err => {
      console.warn('[CentralAuth] Firestore user hydration notice:', err.message);
    });
  }

  /**
   * Asynchronously hydrates users from Firestore if available
   */
  private async hydrateFromFirestore(): Promise<void> {
    const { db } = getFirebaseAdmin();
    if (!db) return;

    try {
      const snap = await db.collection('users').get();
      snap.forEach((docSnap: any) => {
        const data = docSnap.data();
        this.users.set(docSnap.id, {
          id: docSnap.id,
          username: data.displayName || data.username || docSnap.id,
          role: (data.role as UserRole) || 'editor',
          editCount: data.editCount || 0,
          avatar: data.avatar || (data.displayName || docSnap.id).substring(0, 2).toUpperCase(),
          email: data.email,
          userTag: data.userTag,
          discriminator: data.discriminator,
          userPageSlug: data.userPageSlug,
          isBanned: !!data.isBanned,
          banReason: data.banReason,
          bannedAt: data.bannedAt,
          isGoogleUser: !!data.isGoogleUser,
          photoURL: data.photoURL,
          provider: data.provider,
          lastLoginAt: data.lastLoginAt,
          syncedToCloudAt: data.syncedToCloudAt,
        });
      });
    } catch (e: any) {
      console.warn('[CentralAuth] Firestore read fallback to seed:', e.message);
    }
  }

  public getUsers(): UserSession[] {
    return Array.from(this.users.values());
  }

  public deleteUser(userId: string): boolean {
    const deleted = this.users.delete(userId);
    const { db } = getFirebaseAdmin();
    if (db) {
      db.collection('users').doc(userId).delete().catch((err: any) => {
        console.warn(`[CentralAuth] Firestore delete warning for ${userId}:`, err.message);
      });
    }
    return deleted;
  }

  public getUser(userId: string): UserSession | undefined {
    return this.users.get(userId);
  }

  /**
   * Updates an existing user record.
   * STRICT SECURITY: Only administrators (isRequesterAdmin=true) are allowed to alter 'role' or 'isBanned'.
   */
  public updateUser(
    userId: string,
    data: Partial<UserSession>,
    isRequesterAdmin: boolean = false
  ): UserSession {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`Usuário ${userId} não encontrado`);
    }

    if (data.username) user.username = data.username;
    if (data.email !== undefined) user.email = data.email;

    // Only administrators can mutate role, ban status or edit count
    if (isRequesterAdmin) {
      if (data.role) user.role = data.role;
      if (data.isBanned !== undefined) user.isBanned = data.isBanned;
      if (data.banReason !== undefined) user.banReason = data.banReason;
      if (data.bannedAt !== undefined) user.bannedAt = data.bannedAt;
      if (data.editCount !== undefined) user.editCount = data.editCount;
    }

    // Persist to Firestore asynchronously
    const { db } = getFirebaseAdmin();
    if (db) {
      db.collection('users').doc(userId).set(user, { merge: true }).catch((err: any) => {
        console.warn(`[CentralAuth] Firestore sync warning for ${userId}:`, err.message);
      });
    }

    return user;
  }

  public banUser(userId: string, reason: string): UserSession {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`Usuário ${userId} não encontrado`);
    }
    user.isBanned = true;
    user.banReason = reason || 'Violação das diretrizes comunitárias';
    user.bannedAt = new Date().toISOString();

    const { db } = getFirebaseAdmin();
    if (db) {
      db.collection('users').doc(userId).set({
        isBanned: true,
        banReason: user.banReason,
        bannedAt: user.bannedAt,
      }, { merge: true }).catch((err: any) => {
        console.warn(`[CentralAuth] Firestore ban sync error for ${userId}:`, err.message);
      });
    }

    return user;
  }

  public unbanUser(userId: string): UserSession {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`Usuário ${userId} não encontrado`);
    }
    user.isBanned = false;
    user.banReason = undefined;
    user.bannedAt = undefined;

    const { db } = getFirebaseAdmin();
    if (db) {
      db.collection('users').doc(userId).set({
        isBanned: false,
        banReason: null,
        bannedAt: null,
      }, { merge: true }).catch((err: any) => {
        console.warn(`[CentralAuth] Firestore unban sync error for ${userId}:`, err.message);
      });
    }

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

    const { db } = getFirebaseAdmin();
    if (db) {
      db.collection('users').doc(id).set(newUser).catch((err: any) => {
        console.warn(`[CentralAuth] Firestore createUser sync warning for ${id}:`, err.message);
      });
    }

    return newUser;
  }

  /**
   * Upserts user profile.
   * Enforces that non-admin callers cannot self-promote to elevated roles.
   */
  public upsertUser(
    user: Partial<UserSession> & { id: string; username: string },
    isRequesterAdmin: boolean = false
  ): UserSession {
    const existing = this.users.get(user.id);
    if (existing) {
      if (user.username) existing.username = user.username;
      if (user.email !== undefined) existing.email = user.email;
      if (user.avatar) existing.avatar = user.avatar;
      if (user.isGoogleUser !== undefined) existing.isGoogleUser = user.isGoogleUser;
      if (user.photoURL !== undefined) existing.photoURL = user.photoURL;
      if (user.provider !== undefined) existing.provider = user.provider;
      if (user.lastLoginAt !== undefined) existing.lastLoginAt = user.lastLoginAt;
      if (user.syncedToCloudAt !== undefined) existing.syncedToCloudAt = user.syncedToCloudAt;

      // Only admins can alter role or ban flags
      if (isRequesterAdmin) {
        if (user.role) existing.role = user.role;
        if (user.isBanned !== undefined) existing.isBanned = user.isBanned;
        if (user.banReason !== undefined) existing.banReason = user.banReason;
        if (user.bannedAt !== undefined) existing.bannedAt = user.bannedAt;
        if (user.editCount !== undefined) existing.editCount = user.editCount;
      }

      try {
        const { db } = getFirebaseAdmin();
        if (db && typeof db.collection === 'function') {
          const cleanExisting: Record<string, any> = {};
          for (const [k, v] of Object.entries(existing)) {
            if (v !== undefined) cleanExisting[k] = v;
          }
          db.collection('users').doc(user.id).set(cleanExisting, { merge: true }).catch(() => {});
        }
      } catch {
        // Safe fallback when Firebase Admin service account is unconfigured
      }

      return existing;
    } else {
      const assignedRole: UserRole = isRequesterAdmin && user.role ? user.role : 'editor';
      const newUser: UserSession = {
        id: user.id,
        username: user.username,
        role: assignedRole,
        editCount: 0,
        avatar: user.avatar || user.username.substring(0, 2).toUpperCase(),
        email: user.email,
        isBanned: false,
        isGoogleUser: !!user.isGoogleUser,
        photoURL: user.photoURL,
        provider: user.provider,
        lastLoginAt: user.lastLoginAt || new Date().toISOString(),
        syncedToCloudAt: user.syncedToCloudAt || new Date().toISOString(),
      };
      this.users.set(user.id, newUser);

      try {
        const { db } = getFirebaseAdmin();
        if (db && typeof db.collection === 'function') {
          const cleanNew: Record<string, any> = {};
          for (const [k, v] of Object.entries(newUser)) {
            if (v !== undefined) cleanNew[k] = v;
          }
          db.collection('users').doc(user.id).set(cleanNew).catch(() => {});
        }
      } catch {
        // Safe fallback when Firebase Admin service account is unconfigured
      }

      return newUser;
    }
  }

  public incrementEditCount(userId: string) {
    const user = this.users.get(userId);
    if (user) {
      user.editCount++;
      try {
        const { db } = getFirebaseAdmin();
        if (db && typeof db.collection === 'function') {
          db.collection('users').doc(userId).set({ editCount: user.editCount }, { merge: true }).catch(() => {});
        }
      } catch {
        // Safe fallback
      }
    }
  }

  /**
   * Evaluates permissions dynamically based on the verified caller user
   */
  public checkPermission(
    user: UserSession,
    action: 'read' | 'edit' | 'delete' | 'rollback' | 'protect' | 'manage_mesh',
    isProtectedPage: boolean = false
  ): PermissionCheck {
    if (action === 'read') {
      return { allowed: true };
    }

    if (user.isBanned) {
      return {
        allowed: false,
        reason: `Esta conta está suspensa (${user.banReason || 'Acesso revogado'}). Ações proibidas.`,
      };
    }

    if (user.role === 'reader') {
      return { allowed: false, reason: 'Leitores anônimos não podem editar conteúdo. Faça login como Editor.' };
    }

    if (action === 'edit' && isProtectedPage && !['sysop', 'bureaucrat', 'moderator', 'bot'].includes(user.role)) {
      return { allowed: false, reason: 'Esta página está protegida. Apenas moderadores e administradores podem editá-la.' };
    }

    if (action === 'rollback' && !['sysop', 'bureaucrat', 'moderator'].includes(user.role)) {
      return { allowed: false, reason: 'Permissão de reversão requer privilégios de Moderador ou Administrador.' };
    }

    if (action === 'delete' && !['sysop', 'bureaucrat', 'moderator'].includes(user.role)) {
      return { allowed: false, reason: 'A exclusão de páginas requer privilégios de Moderador ou Administrador.' };
    }

    if (action === 'protect' && !['sysop', 'bureaucrat', 'moderator'].includes(user.role)) {
      return { allowed: false, reason: 'Proteger páginas requer privilégios de Moderador ou Administrador.' };
    }

    return { allowed: true };
  }
}

export const centralAuthService = new CentralAuthService();
