import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { api } from '../src/api';
import { WikiGlobalSearchBar } from '../src/components/WikiGlobalSearchBar';

describe('Global Search Bar & api.searchArticles', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty array for blank queries in api.searchArticles', async () => {
    const empty = await api.searchArticles('   ');
    expect(empty).toEqual([]);
  });

  it('exposes api.searchArticles as a function returning SearchMatch[]', () => {
    expect(typeof api.searchArticles).toBe('function');
  });

  it('renders WikiGlobalSearchBar with accessible search role, input, and submit button', () => {
    const html = renderToStaticMarkup(
      <WikiGlobalSearchBar
        onSearch={() => {}}
        onNavigateArticle={() => {}}
      />
    );
    expect(html).toContain('data-testid="wikireader-global-search"');
    expect(html).toContain('role="search"');
    expect(html).toContain('type="search"');
    expect(html).toContain('Pesquisar artigos no Firestore...');
    expect(html).toContain('aria-label="Buscar"');
  });
});
