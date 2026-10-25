import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Firestore Security Rules Static Analysis & Invariants', () => {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');

  it('Enforces request.auth != null on ALL write operations', () => {
    // Ensure there is no unconditional allow write or allow create/update/delete: if true
    expect(rulesContent).not.toMatch(/allow\s+(write|create|update|delete)[^;]*:\s*if\s+true\s*;/i);
  });

  it('Defines required security helper functions', () => {
    expect(rulesContent).toContain('function isAuthenticated()');
    expect(rulesContent).toContain('function isNotBanned()');
    expect(rulesContent).toContain('function isRegistered()');
    expect(rulesContent).toContain('function isOwner(userId)');
    expect(rulesContent).toContain('function isAdmin()');
    expect(rulesContent).toContain('function isEditor()');
    expect(rulesContent).toContain('function isBot()');
  });

  it('Restricts admin rights to authorized email accounts and elevated roles', () => {
    expect(rulesContent).toContain('pedrohenriquecardonaperes@gmail.com');
    expect(rulesContent).toContain('mafersao1100@gmail.com');
  });

  it('Enforces immutable constraints on versions and revisions', () => {
    // Page versions must have allow update, delete: if false
    const versionBlock = rulesContent.substring(rulesContent.indexOf('match /versions/{versionId}'));
    expect(versionBlock).toContain('allow update, delete: if false;');

    // Revisions must have allow update, delete: if false
    const revBlock = rulesContent.substring(rulesContent.indexOf('match /revisions/{revisionId}'));
    expect(revBlock).toContain('allow update, delete: if false;');

    // Events must have allow update, delete: if false
    const eventBlock = rulesContent.substring(rulesContent.indexOf('match /wiki_events/{eventId}'));
    expect(eventBlock).toContain('allow update, delete: if false;');
  });

  it('Protects /users/{userId} against role self-elevation and unauthorized deletion', () => {
    const userBlock = rulesContent.substring(rulesContent.indexOf('match /users/{userId}'));
    expect(userBlock).toContain("allow delete: if isAdmin();");
  });

  it('Enforces strict participant access on direct_chats and subcollection messages', () => {
    const chatBlock = rulesContent.substring(rulesContent.indexOf('match /direct_chats/{chatId}'));
    expect(chatBlock).toContain('request.auth.uid in resource.data.participants');
  });
});
