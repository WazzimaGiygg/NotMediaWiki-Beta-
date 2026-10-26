import { Request, Response, NextFunction } from 'express';
import { verifyIdToken, DecodedAuthToken } from '../firebaseAdmin';
import { centralAuthService, UserRole } from '../services/auth';
import { UserSession } from '../data/seedData';

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: UserSession;
      decodedToken?: DecodedAuthToken;
    }
  }
}

export const SUPER_ADMIN_EMAILS = [
  'pedrohenriquecardonaperes@gmail.com',
  'pedrohenriquecaronaperes@gmail.com',
  'mafersao1100@gmail.com',
];

export function isSuperAdmin(email?: string | null): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

/**
 * Parses Authorization: Bearer <token> and attaches req.user
 */
export async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return next();
  }

  try {
    const decoded = await verifyIdToken(token);
    req.decodedToken = decoded;

    // Check if user already exists in auth service / Firestore
    let user = centralAuthService.getUser(decoded.uid);
    if (!user) {
      const email = decoded.email?.toLowerCase();
      const role: UserRole = isSuperAdmin(email) ? 'bureaucrat' : 'editor';
      user = centralAuthService.upsertUser({
        id: decoded.uid,
        username: decoded.name || email?.split('@')[0] || `User_${decoded.uid.substring(0, 5)}`,
        email: decoded.email,
        role,
        isBanned: false,
        isGoogleUser: true,
      });
    } else if (isSuperAdmin(decoded.email)) {
      // Ensure super-admins always hold bureaucrat privileges
      user.role = 'bureaucrat';
    }

    req.user = user;
    next();
  } catch (err: any) {
    // If token verification fails, continue unauthenticated.
    // Protected endpoints will be caught by requireAuth.
    next();
  }
}

/**
 * Enforces that user is authenticated and not banned
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Autenticação obrigatória para acessar este recurso' });
    return;
  }

  if (req.user.isBanned) {
    res.status(403).json({
      error: `Esta conta foi suspensa: ${req.user.banReason || 'Violação dos termos comunitários'}`,
    });
    return;
  }

  next();
}

/**
 * Enforces that the authenticated user possesses one of the allowed roles
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Autenticação obrigatória' });
      return;
    }

    if (req.user.isBanned) {
      res.status(403).json({ error: 'Conta suspensa' });
      return;
    }

    // Super-admins bypass role checks
    if (isSuperAdmin(req.user.email)) {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Acesso negado: requer um dos seguintes papéis: ${allowedRoles.join(', ')}`,
      });
      return;
    }

    next();
  };
}
