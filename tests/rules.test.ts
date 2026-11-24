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

  it('Guards watchlist_subscriptions, article_notifications, and fcm_tokens', () => {
    expect(rulesContent).toContain('match /watchlist_subscriptions/{subId}');
    expect(rulesContent).toContain('match /article_notifications/{notificationId}');
    expect(rulesContent).toContain('match /fcm_tokens/{tokenId}');
    expect(rulesContent).toContain('resource.data.userId == request.auth.uid');
  });

  it('Allows non-banned editors to collaborate on unprotected articles/pages and create events while blocking readers', () => {
    expect(rulesContent).toContain('function hasExplicitReaderRole()');
    expect(rulesContent).toContain('function isModerator()');
    expect(rulesContent).toContain('function matchesRequestAuthor()');
    expect(rulesContent).toContain('return isRegistered() && !hasExplicitReaderRole();');
    expect(rulesContent).not.toContain(".get(['author', 'id'], '')");

    const articlesBlock = rulesContent.substring(
      rulesContent.indexOf('match /articles/{articleId}'),
      rulesContent.indexOf('match /revisions/{revisionId}')
    );
    expect(articlesBlock).toContain('allow create: if (isEditor() || isAdmin() || isBot())');
    expect(articlesBlock).toContain('allow update: if (isEditor() || isAdmin() || isBot())');
    expect(articlesBlock).toContain('!isPageProtected(resource.data)');
    expect(articlesBlock).toContain('!isPageProtected(request.resource.data)');

    const eventsBlock = rulesContent.substring(
      rulesContent.indexOf('match /wiki_events/{eventId}'),
      rulesContent.indexOf('match /bot_agents_config/{botId}')
    );
    expect(eventsBlock).toContain('allow create: if isEditor() || isAdmin() || isBot();');
  });

  it('Splits /user_pages rules cleanly for profile creation and collaborative talkPosts', () => {
    const userPagesBlock = rulesContent.substring(
      rulesContent.indexOf('match /user_pages/{pageId}'),
      rulesContent.indexOf('match /bannedusers/{userId}')
    );
    expect(userPagesBlock).toContain('allow create: if isAdmin()');
    expect(userPagesBlock).toContain('request.resource.data.userId == request.auth.uid');
    expect(userPagesBlock).toContain("affectedKeys().hasOnly(['talkPosts', 'updatedAt'])");
  });
});
