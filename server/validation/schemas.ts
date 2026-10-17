import { z } from 'zod';

export const articleSaveSchema = z.object({
  slug: z.string().min(1).max(255).regex(/^[a-zA-Z0-9_\-.:/%]+$/, {
    message: 'Slug contém caracteres inválidos',
  }),
  title: z.string().min(1).max(255),
  wikitext: z.string().max(200000, {
    message: 'Wikitext excede o limite máximo de 200.000 caracteres',
  }),
  summary: z.string().max(2000).optional(),
  comment: z.string().max(1000).optional(),
  isMinor: z.boolean().optional(),
  namespace: z.number().int().min(0).default(0),
});

export const articleRollbackSchema = z.object({
  targetRevId: z.string().min(1).max(128),
});

export const parsoidParseSchema = z.object({
  wikitext: z.string().max(200000),
  title: z.string().max(255).optional(),
});

export const userCreateSchema = z.object({
  username: z.string().min(2).max(100),
  role: z.enum(['sysop', 'bureaucrat', 'moderator', 'editor', 'reader', 'bot']),
  email: z.string().email().max(255).optional(),
});

export const userUpdateSchema = z.object({
  username: z.string().min(2).max(100).optional(),
  role: z.enum(['sysop', 'bureaucrat', 'moderator', 'editor', 'reader', 'bot']).optional(),
  email: z.string().email().max(255).optional(),
  isBanned: z.boolean().optional(),
  banReason: z.string().max(500).optional(),
});

export const userBanSchema = z.object({
  reason: z.string().min(3).max(500),
});

export const simulateTrafficSchema = z.object({
  multiplier: z.number().min(1).max(20).default(3),
});

export const searchQuerySchema = z.object({
  q: z.string().max(500),
  namespace: z.string().optional().transform(val => {
    if (!val) return undefined;
    const parsed = parseInt(val, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }),
});

export const eventsHistorySchema = z.object({
  limit: z.string().optional().transform(val => {
    if (!val) return 50;
    const parsed = parseInt(val, 10);
    return Number.isNaN(parsed) || parsed <= 0 ? 50 : Math.min(parsed, 100);
  }),
});
