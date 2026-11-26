import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../server/app';
import { resetChatbotBlockerPolicyForTests } from '../server/middleware/chatbotBlocker';
import { DEFAULT_EXTENSIONS } from '../src/data/defaultExtensions';
import { MANAGED_FEATURE_EXTENSIONS } from '../src/extensions';
import {
  chatbotBlockerExtension,
  getChatbotBlockerConfig,
} from '../src/extensions/chatbotBlockerExtension';
import { detectChatbotAccess } from '../src/utils/chatbotSignatures';
import { detectChatbotClientAccess } from '../src/utils/chatbotGuard';
import { ChatbotBlockedScreen } from '../src/components/ChatbotBlockedScreen';

describe('ChatbotBlocker Extension (ext-chatbot-blocker)', () => {
  afterEach(() => {
    resetChatbotBlockerPolicyForTests();
  });

  it('registers ChatbotBlocker (ext-chatbot-blocker) enabled by default in DEFAULT_EXTENSIONS and MANAGED_FEATURE_EXTENSIONS', () => {
    const ext = DEFAULT_EXTENSIONS.find(e => e.id === 'ext-chatbot-blocker');
    expect(ext).toBeDefined();
    expect(ext?.name).toBe('ChatbotBlocker');
    expect(ext?.enabled).toBe(true);
    expect(ext?.category).toBe('security');
    expect(MANAGED_FEATURE_EXTENSIONS.some(e => e.id === 'ext-chatbot-blocker')).toBe(true);

    const config = getChatbotBlockerConfig(DEFAULT_EXTENSIONS);
    expect(config.extensionEnabled).toBe(true);
    expect(config.isActive).toBe(true);
    expect(config.responseCode).toBe(403);
    expect(config.injectNoAiMeta).toBe(true);
  });

  it('detects and blocks major chatbot User-Agents, referers, origins, ancestors, AI headers, and utm_source trackers', () => {
    const blockedAgents = [
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
      'GPTBot/1.2 (+https://openai.com/gptbot)',
      'OAI-SearchBot/1.0',
      'ClaudeBot/1.0 (+claudebot@anthropic.com)',
      'Claude-Web/1.0',
      'Claude-User/1.0',
      'PerplexityBot/1.0',
      'Perplexity-User/1.0',
      'Google-Extended',
      'Google-NotebookLM',
      'Meta-ExternalAgent/1.1',
      'DeepSeekBot/1.0',
      'GrokBot/1.0',
      'MistralAI-User/1.0',
      'Bytespider',
      'Applebot-Extended',
      'Amazonbot/0.1',
      'cohere-ai',
      'DuckAssistBot',
      'Poe-Bot',
      'CCBot/2.0',
      'FirecrawlAgent/1.0',
      'LangChain/0.3',
    ];

    for (const ua of blockedAgents) {
      const res = detectChatbotAccess({ userAgent: ua });
      expect(res.blocked).toBe(true);
      expect(res.matchedAgent).toBeTruthy();
    }

    const blockedReferers = [
      'https://chatgpt.com/',
      'https://chat.openai.com/',
      'https://claude.ai/chat/123',
      'https://www.perplexity.ai/search',
      'https://gemini.google.com/app',
      'https://copilot.microsoft.com/',
      'https://poe.com/',
      'https://chat.deepseek.com/',
      'https://grok.com/',
    ];

    for (const ref of blockedReferers) {
      const res = detectChatbotAccess({
        userAgent: 'Mozilla/5.0 Chrome/131.0.0.0 Safari/537.36',
        referer: ref,
      });
      expect(res.blocked).toBe(true);
      expect(res.source).toBe('referer');
    }

    const utmRes = detectChatbotAccess({
      userAgent: 'Mozilla/5.0 Chrome/131.0.0.0 Safari/537.36',
      url: 'https://core.wazzimagiygg.com/?utm_source=chatgpt.com#/wiki/MediaWiki',
    });
    expect(utmRes.blocked).toBe(true);
    expect(utmRes.source).toBe('utm-source');

    const headerRes = detectChatbotAccess({
      userAgent: 'Mozilla/5.0',
      headers: { 'signature-agent': '"https://chatgpt.com"' },
    });
    expect(headerRes.blocked).toBe(true);
    expect(headerRes.source).toBe('header');
  });

  it('never blocks regular browsers, Googlebot, Bingbot, or Google AI Studio iframe origins', () => {
    const allowedRequests = [
      {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        referer: 'https://aistudio.google.com/',
        ancestors: ['https://aistudio.google.com'],
      },
      {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
        referer: 'https://ais-dev-vd5haarj3lq6be4nzfmmwp-842441289091.us-east1.run.app/',
      },
      {
        userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      },
      {
        userAgent: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
      },
    ];

    for (const input of allowedRequests) {
      expect(detectChatbotAccess(input).blocked).toBe(false);
    }
  });

  it('blocks HTTP requests from chatbots with 403 and noai headers on Express server while allowing normal users', async () => {
    const botHtmlRes = await request(app)
      .get('/')
      .set('User-Agent', 'Mozilla/5.0 AppleWebKit/537.36; compatible; ChatGPT-User/1.0; +https://openai.com/bot');
    expect(botHtmlRes.status).toBe(403);
    expect(botHtmlRes.headers['x-chatbot-blocker']).toBe('blocked');
    expect(botHtmlRes.headers['x-robots-tag']).toContain('noai');
    expect(botHtmlRes.text).toContain('Acesso bloqueado para chatbots');

    const botApiRes = await request(app)
      .get('/api/v1/content/articles')
      .set('User-Agent', 'ClaudeBot/1.0 (+claudebot@anthropic.com)');
    expect(botApiRes.status).toBe(403);
    expect(botApiRes.body.code).toBe('CHATBOT_ACCESS_BLOCKED');
    expect(botApiRes.body.extension).toBe('ext-chatbot-blocker');

    const botRefererRes = await request(app)
      .get('/api/v1/content/articles')
      .set('User-Agent', 'Mozilla/5.0 Chrome/131.0.0.0 Safari/537.36')
      .set('Referer', 'https://perplexity.ai/');
    expect(botRefererRes.status).toBe(403);

    const humanApiRes = await request(app)
      .get('/api/v1/content/articles')
      .set('User-Agent', 'Mozilla/5.0 Chrome/131.0.0.0 Safari/537.36')
      .set('Referer', 'https://aistudio.google.com/');
    expect(humanApiRes.status).toBe(200);
    expect(humanApiRes.headers['x-robots-tag']).toContain('noai');
  });

  it('serves /robots.txt with explicit Disallow: / for chatbots even when requested by bots', async () => {
    const robotsRes = await request(app)
      .get('/robots.txt')
      .set('User-Agent', 'GPTBot/1.0');
    expect(robotsRes.status).toBe(200);
    expect(robotsRes.text).toContain('User-agent: ChatGPT-User\nDisallow: /');
    expect(robotsRes.text).toContain('User-agent: ClaudeBot\nDisallow: /');
    expect(robotsRes.text).toContain('User-agent: PerplexityBot\nDisallow: /');
    expect(robotsRes.text).toContain('User-agent: Google-Extended\nDisallow: /');
    expect(robotsRes.text).toContain('Host: core.wazzimagiygg.com');
  });

  it('enforces bureaucrat RBAC for modifying server ChatbotBlocker policy and viewing attempt logs', async () => {
    const unauthUpdate = await request(app)
      .post('/api/v1/security/chatbot-blocker')
      .send({ enabled: false });
    expect(unauthUpdate.status).toBe(401);

    const editorUpdate = await request(app)
      .post('/api/v1/security/chatbot-blocker')
      .set('Authorization', 'Bearer test-token-editor:editor@example.com')
      .send({ enabled: false });
    expect(editorUpdate.status).toBe(403);

    const bureaucratUpdate = await request(app)
      .post('/api/v1/security/chatbot-blocker')
      .set('Authorization', 'Bearer test-token-super-admin:pedrohenriquecardonaperes@gmail.com')
      .send({
        enabled: true,
        customBlockedAgents: ['MeuChatbotCustom'],
      });
    expect(bureaucratUpdate.status).toBe(200);
    expect(bureaucratUpdate.body.policy.customBlockedAgents).toContain('MeuChatbotCustom');

    const customBlocked = await request(app)
      .get('/api/v1/content/articles')
      .set('User-Agent', 'MeuChatbotCustom/2.0');
    expect(customBlocked.status).toBe(403);

    const publicStatus = await request(app).get('/api/v1/security/chatbot-blocker/status');
    expect(publicStatus.status).toBe(200);
    expect(publicStatus.body.enabled).toBe(true);
    expect(publicStatus.body.recentBlockedAttempts).toBeUndefined();

    const bureaucratStatus = await request(app)
      .get('/api/v1/security/chatbot-blocker/status')
      .set('Authorization', 'Bearer test-token-super-admin:pedrohenriquecardonaperes@gmail.com');
    expect(bureaucratStatus.status).toBe(200);
    expect(Array.isArray(bureaucratStatus.body.recentBlockedAttempts)).toBe(true);
    expect(bureaucratStatus.body.recentBlockedAttempts.length).toBeGreaterThan(0);
  });

  it('detects chatbot clients in browser guard and renders ChatbotBlockedScreen safely', () => {
    const config = getChatbotBlockerConfig([chatbotBlockerExtension]);
    const mockWin = {
      navigator: { userAgent: 'Mozilla/5.0 Chrome/131.0.0.0' },
      location: {
        href: 'https://core.wazzimagiygg.com/#/wiki/MediaWiki',
        ancestorOrigins: ['https://chatgpt.com'],
      },
    } as unknown as Window;
    const mockDoc = { referrer: '' } as Document;

    const check = detectChatbotClientAccess(config, mockWin, mockDoc);
    expect(check.blocked).toBe(true);
    expect(check.matchedAgent).toBe('chatgpt.com');

    const html = renderToStaticMarkup(
      <ChatbotBlockedScreen
        siteTitle="NotMediaWiki"
        blockMessage={config.blockMessage}
        matchedAgent={check.matchedAgent}
        reason={check.reason}
      />
    );
    expect(html).toContain('Acesso bloqueado para chatbots');
    expect(html).toContain('ext-chatbot-blocker');
    expect(html).toContain('chatgpt.com');
  });

  it('embeds noai and chatbot Disallow rules statically in index.html and public/robots.txt', () => {
    const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
    const robotsTxt = fs.readFileSync(path.resolve(process.cwd(), 'public/robots.txt'), 'utf-8');

    expect(indexHtml).toContain('noai, noimageai');
    expect(indexHtml).toContain('name="GPTBot"');
    expect(indexHtml).toContain('name="tdm-reservation"');
    expect(robotsTxt).toContain('User-agent: GPTBot');
    expect(robotsTxt).toContain('User-agent: ChatGPT-User');
    expect(robotsTxt).toContain('User-agent: ClaudeBot');
    expect(robotsTxt).toContain('User-agent: PerplexityBot');
  });
});
