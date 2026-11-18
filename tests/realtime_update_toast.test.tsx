import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import {
  RealtimeUpdateToast,
  detectCollaboratorArticleUpdate,
} from '../src/components/RealtimeUpdateToast';
import { Article } from '../src/types';

const baseArticle: Article = {
  id: 'art-1',
  slug: 'MediaWiki',
  title: 'MediaWiki',
  namespace: 0,
  wikitext: 'Versão inicial do artigo.',
  summary: 'Criação inicial',
  latestRevisionId: 'rev-1',
  createdAt: '2026-11-18T10:00:00.000Z',
  updatedAt: '2026-11-18T10:00:00.000Z',
  categories: ['Tecnologia'],
  views: 100,
};

describe('RealtimeUpdateToast & Firestore Collaborator Update Detection Suite', () => {
  it('triggers a toast payload when another collaborator updates the article in Firestore', () => {
    const liveArticle = {
      ...baseArticle,
      wikitext: 'Versão atualizada por outro colaborador.',
      latestRevisionId: 'rev-2',
      updatedAt: '2026-11-18T10:05:00.000Z',
      authorUid: 'user-other-99',
      lastEditedBy: 'Marina Silva',
      comment: 'Adicionada seção de governança',
    };

    const result = detectCollaboratorArticleUpdate(
      liveArticle,
      {
        revisionId: 'rev-1',
        wikitext: baseArticle.wikitext,
        updatedAt: baseArticle.updatedAt,
      },
      { id: 'user-me-1', username: 'Pedro', email: 'pedro@wazzimagiygg.com' }
    );

    expect(result).not.toBeNull();
    expect(result?.visible).toBe(true);
    expect(result?.editorName).toBe('Marina Silva');
    expect(result?.summary).toBe('Adicionada seção de governança');
    expect(result?.revId).toBe('rev-2');
  });

  it('suppresses self-edits matched by UID or username', () => {
    const selfByUid = detectCollaboratorArticleUpdate(
      {
        ...baseArticle,
        latestRevisionId: 'rev-2',
        authorUid: 'user-me-1',
        lastEditedBy: 'Outro Nome',
      },
      { revisionId: 'rev-1', wikitext: baseArticle.wikitext },
      { id: 'user-me-1', username: 'Pedro', email: 'pedro@wazzimagiygg.com' }
    );
    expect(selfByUid).toBeNull();

    const selfByUsername = detectCollaboratorArticleUpdate(
      {
        ...baseArticle,
        latestRevisionId: 'rev-3',
        lastEditedBy: 'Pedro',
      },
      { revisionId: 'rev-1', wikitext: baseArticle.wikitext },
      { id: 'user-me-1', username: 'Pedro', email: 'pedro@wazzimagiygg.com' }
    );
    expect(selfByUsername).toBeNull();
  });

  it('does not re-trigger for a revision the user already dismissed until a newer revision arrives', () => {
    const dismissed = detectCollaboratorArticleUpdate(
      {
        ...baseArticle,
        latestRevisionId: 'rev-2',
        authorUid: 'user-other-99',
        lastEditedBy: 'Marina Silva',
      },
      { revisionId: 'rev-1', wikitext: baseArticle.wikitext },
      { id: 'user-me-1', username: 'Pedro', email: 'pedro@wazzimagiygg.com' },
      null,
      'rev-2'
    );
    expect(dismissed).toBeNull();

    const newer = detectCollaboratorArticleUpdate(
      {
        ...baseArticle,
        latestRevisionId: 'rev-3',
        authorUid: 'user-other-99',
        lastEditedBy: 'Marina Silva',
      },
      { revisionId: 'rev-1', wikitext: baseArticle.wikitext },
      { id: 'user-me-1', username: 'Pedro', email: 'pedro@wazzimagiygg.com' },
      null,
      'rev-2'
    );
    expect(newer?.revId).toBe('rev-3');
  });

  it('renders accessible RealtimeUpdateToast with collaborator info and action buttons', () => {
    const html = renderToStaticMarkup(
      <RealtimeUpdateToast
        toast={{
          visible: true,
          editorName: 'Marina Silva',
          summary: 'Atualização de referências',
          timestamp: '2026-11-18T12:40:00.000Z',
          revId: 'rev-42',
        }}
        isRefreshing={false}
        onReload={() => {}}
        onDismiss={() => {}}
        onViewHistory={() => {}}
      />
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Artigo atualizado em tempo real');
    expect(html).toContain('Marina Silva');
    expect(html).toContain('Atualização de referências');
    expect(html).toContain('Atualizar conteúdo');
    expect(html).toContain('Ver histórico');
    expect(html).toContain('Continuar lendo');
  });
});
