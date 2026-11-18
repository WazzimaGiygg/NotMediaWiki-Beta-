import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import {
  buildDefaultPromoScenes,
  getCanvasDimensions,
} from '../src/utils/promoVideoEngine';
import { PromoVideoStudio } from '../src/components/PromoVideoStudio';

describe('PromoVideoStudio (Canvas + WebM Commercial Generator) Suite', () => {
  it('computes exact HD dimensions for 16:9 landscape and 9:16 vertical formats', () => {
    expect(getCanvasDimensions('16:9')).toEqual({ width: 1280, height: 720 });
    expect(getCanvasDimensions('9:16')).toEqual({ width: 720, height: 1280 });
  });

  it('builds a 6-scene commercial storyboard grounded in real Wiki config, Wikipedia comparison, and Chronus governance dossier', () => {
    const scenes = buildDefaultPromoScenes({
      totalArticles: 42,
      activeExtensionsCount: 11,
      activeExtensionNames: ['SupportTickets', 'ExternalRedirector'],
      hasMaintenanceExtension: true,
      hasExternalRedirector: true,
      hasSupportExtension: true,
    });

    expect(scenes).toHaveLength(6);
    expect(scenes[0].bullets.join(' ')).toContain('42+ artigos');
    expect(scenes[0].bullets.join(' ')).toContain('11 extensões');

    const dossierScene = scenes.find(s => s.id === 'dossier-chronus');
    expect(dossierScene).toBeDefined();
    expect(dossierScene?.subtitle).toContain('Chronus');

    const comparisonScene = scenes.find(s => s.id === 'comparison');
    expect(comparisonScene?.comparison?.leftTitle).toContain('Wikipédia');
    expect(comparisonScene?.comparison?.rightTitle).toContain('NotMediaWiki');

    const ctaScene = scenes.find(s => s.id === 'cta');
    expect(ctaScene?.bullets.join(' ')).toContain('core.wazzimagiygg.com');
  });

  it('renders PromoVideoStudio controls for 16:9, 9:16, audio toggle, preview, WebM export, and scene editor', () => {
    const html = renderToStaticMarkup(<PromoVideoStudio onBack={() => {}} />);

    expect(html).toContain('Estúdio de Vídeo Comercial e Divulgação');
    expect(html).toContain('16:9 YouTube');
    expect(html).toContain('9:16 Reels / Shorts');
    expect(html).toContain('Trilha Sonora Ativa');
    expect(html).toContain('Pré-visualizar');
    expect(html).toContain('Gerar Vídeo (.WebM)');
    expect(html).toContain('Roteiro do Comercial (6 Cenas)');
  });
});
