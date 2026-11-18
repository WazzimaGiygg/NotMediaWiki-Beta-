import { WikiExtension } from '../types';

export type PromoAspectRatio = '16:9' | '9:16';

export interface PromoScene {
  id: string;
  kicker: string;
  headline: string;
  subtitle: string;
  bullets: string[];
  accent: string;
  durationSec: number;
  comparison?: {
    leftTitle: string;
    leftItems: string[];
    rightTitle: string;
    rightItems: string[];
  };
}

export interface WikiConfigSnapshot {
  totalArticles: number;
  activeExtensionsCount: number;
  activeExtensionNames: string[];
  hasMaintenanceExtension: boolean;
  hasExternalRedirector: boolean;
  hasSupportExtension: boolean;
}

export function getCanvasDimensions(aspectRatio: PromoAspectRatio): { width: number; height: number } {
  return aspectRatio === '9:16'
    ? { width: 720, height: 1280 }
    : { width: 1280, height: 720 };
}

export function buildDefaultPromoScenes(config: WikiConfigSnapshot): PromoScene[] {
  const extCount = config.activeExtensionsCount || 8;
  const articleCount = config.totalArticles || 12;

  return [
    {
      id: 'intro',
      kicker: 'Projetos WazzimaGiygg · core.wazzimagiygg.com',
      headline: 'NotMediaWiki: A Enciclopédia Livre, Auditável e Moderna',
      subtitle:
        'Criada para devolver a transparência, a velocidade e o respeito aos editores que constroem o conhecimento aberto.',
      bullets: [
        `${articleCount}+ artigos indexados com SEO estruturado em core.wazzimagiygg.com`,
        `${extCount} extensões modulares configuráveis em tempo real`,
        'Arquitetura em nuvem com histórico completo e verificável',
      ],
      accent: '#2563eb',
      durationSec: 5,
    },
    {
      id: 'dossier-chronus',
      kicker: 'Dossiê de Governança · Por que uma alternativa é necessária',
      headline: 'Chega de Bloqueios Arbitrários e Poder Sem Auditoria',
      subtitle:
        'Debates e dossiês da comunidade expuseram críticas recorrentes à conduta administrativa na Wikipédia lusófona — com destaque para o caso do administrador Chronus.',
      bullets: [
        'Relatos de bloqueios sumários, reversões unilaterais e fechamento de discussões',
        'Falta de revisão independente e barreiras para defesa de editores comuns',
        'No NotMediaWiki, nenhuma ação administrativa ocorre sem registro público auditável',
      ],
      accent: '#e11d48',
      durationSec: 6.5,
    },
    {
      id: 'comparison',
      kicker: 'Comparativo Técnico e Institucional',
      headline: 'NotMediaWiki vs. Wikipédia Tradicional',
      subtitle:
        'Cada módulo de governança e tecnologia foi configurado para evitar abusos de autoridade e garantir transparência real.',
      bullets: [],
      accent: '#0d9488',
      durationSec: 6.5,
      comparison: {
        leftTitle: 'Modelo Tradicional (Wikipédia)',
        leftItems: [
          'Decisões concentradas em poucos administradores',
          'Processos de desbloqueio lentos e opacos',
          'Sem conformidade nativa com LGPD brasileira',
          'Interface legada e extensões engessadas',
        ],
        rightTitle: 'NotMediaWiki (core.wazzimagiygg.com)',
        rightItems: [
          'Conselho de Arbitragem & Logs de auditoria em tempo real',
          'Avaliação de Desbloqueio e CheckUser rastreáveis',
          'Central LGPD Art. 18, Marco Civil Art. 19 e Conselho BLP',
          `${extCount} extensões ativáveis pelo burocrata sem downtime`,
        ],
      },
    },
    {
      id: 'config-advantages',
      kicker: 'Vantagens das Configurações Reais do Sistema',
      headline: 'Controle Total com Extensões e Segurança Nativa',
      subtitle:
        'Baseado nas configurações ativas do nosso Wiki-site, unindo governança jurídica, bots de qualidade e leitura rápida.',
      bullets: [
        'Motor Parsoid AST com Infobox de Software e Infobox de Usuário automáticas',
        'Alertas em tempo real (Firestore + Web Push) quando artigos seguidos são editados',
        'Exportação de artigos em PDF, Breadcrumbs SEO e proteção anti-VPN/vandalismo',
        config.hasExternalRedirector
          ? 'Redirecionador de links externos e modo manutenção configuráveis por extensão'
          : 'Módulos de suporte, livros, jornal e universidade configuráveis por extensão',
      ],
      accent: '#4f46e5',
      durationSec: 6,
    },
    {
      id: 'community',
      kicker: 'Comunidade Colaborativa e Justa',
      headline: 'Identidade Clara, Mérito Transparente e Diálogo Aberto',
      subtitle:
        'Todo novo editor recebe sua página pessoal com Infobox de identificação, tutorial interativo e voz ativa na comunidade.',
      bullets: [
        'Login rápido com Google, tag exclusiva (#XXXX) e página pessoal automática',
        'Sistema de Karma, Checklist Diário e Chat Comunitário em tempo real',
        'Bots transparentes para citações, qualidade e proteção de dados pessoais (LGPD)',
      ],
      accent: '#d97706',
      durationSec: 5.5,
    },
    {
      id: 'cta',
      kicker: 'Enciclopédia Oficial · Projetos WazzimaGiygg',
      headline: 'Construa o Conhecimento Livre sem Censura Arbitrária',
      subtitle:
        'Acesse agora, leia, edite e participe de uma enciclopédia onde as regras protegem a comunidade — não privilégios.',
      bullets: [
        'Acesse: https://core.wazzimagiygg.com',
        'Código transparente · Governança auditável · Conformidade LGPD',
      ],
      accent: '#2563eb',
      durationSec: 5,
    },
  ];
}

export function buildConfigSnapshot(
  articlesCount: number,
  extensions: WikiExtension[]
): WikiConfigSnapshot {
  const active = extensions.filter(e => e.enabled);
  return {
    totalArticles: articlesCount,
    activeExtensionsCount: active.length,
    activeExtensionNames: active.map(e => e.name),
    hasMaintenanceExtension: active.some(e => e.id.toLowerCase().includes('maintenance')),
    hasExternalRedirector: active.some(e => e.id.toLowerCase().includes('redirect')),
    hasSupportExtension: active.some(e => e.id.toLowerCase().includes('support')),
  };
}

function easeOutCubic(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - clamped, 3);
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Renders a single frame of the commercial video onto an HTML5 2D Canvas.
 */
export function renderPromoFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scene: PromoScene,
  localProgress: number,
  globalProgress: number,
  sceneIndex: number,
  totalScenes: number,
  aspectRatio: PromoAspectRatio
): void {
  const isVertical = aspectRatio === '9:16';
  const padX = isVertical ? 56 : 88;
  const padY = isVertical ? 84 : 64;
  const contentWidth = width - padX * 2;

  // Fade in / fade out envelope per scene
  const fadeIn = easeOutCubic(Math.min(1, localProgress / 0.16));
  const fadeOut = localProgress > 0.88 ? 1 - (localProgress - 0.88) / 0.12 : 1;
  const alpha = Math.max(0, Math.min(1, fadeIn * fadeOut));

  // Background gradient (editorial dark slate)
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#090d16');
  bg.addColorStop(0.55, '#0f172a');
  bg.addColorStop(1, '#111827');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Subtle architectural grid lines
  ctx.save();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
  ctx.lineWidth = 1;
  const gridStep = isVertical ? 64 : 80;
  const drift = (globalProgress * 120) % gridStep;
  for (let x = -gridStep + drift; x < width; x += gridStep) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += gridStep) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();

  // Accent radial glow in top-right corner
  ctx.save();
  const glow = ctx.createRadialGradient(
    width * 0.85,
    height * 0.14,
    20,
    width * 0.85,
    height * 0.14,
    isVertical ? 420 : 520
  );
  glow.addColorStop(0, `${scene.accent}38`);
  glow.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // Top Header Bar (Brand + Scene Index)
  ctx.save();
  ctx.fillStyle = '#f8fafc';
  ctx.font = `700 ${isVertical ? 22 : 20}px system-ui, -apple-system, sans-serif`;
  ctx.fillText('NotMediaWiki', padX, padY);

  ctx.fillStyle = '#94a3b8';
  ctx.font = `500 ${isVertical ? 17 : 15}px ui-monospace, SFMono-Regular, monospace`;
  const domainText = 'core.wazzimagiygg.com';
  const sceneCounter = `${String(sceneIndex + 1).padStart(2, '0')} / ${String(totalScenes).padStart(2, '0')}`;
  ctx.fillText(domainText, padX + (isVertical ? 155 : 145), padY);
  const counterWidth = ctx.measureText(sceneCounter).width;
  ctx.fillText(sceneCounter, width - padX - counterWidth, padY);

  // Hairline divider under top bar
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, padY + 18);
  ctx.lineTo(width - padX, padY + 18);
  ctx.stroke();
  ctx.restore();

  // Main Scene Content (animated slide + opacity)
  ctx.save();
  ctx.globalAlpha = alpha;
  const slideOffset = (1 - fadeIn) * 28;
  let cursorY = padY + (isVertical ? 95 : 80) + slideOffset;

  // Accent bar + Kicker
  ctx.fillStyle = scene.accent;
  ctx.fillRect(padX, cursorY - 14, 36, 4);
  ctx.font = `600 ${isVertical ? 20 : 17}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(scene.kicker, padX + 48, cursorY - 6);
  cursorY += isVertical ? 48 : 38;

  // Headline
  const headlineSize = isVertical ? 46 : 48;
  ctx.font = `700 ${headlineSize}px Georgia, "Times New Roman", serif`;
  ctx.fillStyle = '#ffffff';
  const headlineLines = wrapTextLines(ctx, scene.headline, contentWidth);
  for (const line of headlineLines) {
    ctx.fillText(line, padX, cursorY);
    cursorY += headlineSize * 1.18;
  }

  cursorY += isVertical ? 14 : 10;

  // Subtitle
  const subSize = isVertical ? 24 : 22;
  ctx.font = `400 ${subSize}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = '#cbd5e1';
  const subLines = wrapTextLines(ctx, scene.subtitle, contentWidth);
  for (const line of subLines) {
    ctx.fillText(line, padX, cursorY);
    cursorY += subSize * 1.42;
  }

  cursorY += isVertical ? 30 : 22;

  // Either Two-Column Comparison or Bullet List
  if (scene.comparison) {
    const comp = scene.comparison;
    const colGap = 24;
    const colWidth = isVertical ? contentWidth : (contentWidth - colGap) / 2;
    const boxPad = 22;

    const drawColumn = (
      x: number,
      y: number,
      title: string,
      items: string[],
      borderColor: string,
      titleColor: string,
      bulletColor: string
    ): number => {
      const itemSize = isVertical ? 19 : 17;
      ctx.font = `400 ${itemSize}px system-ui, -apple-system, sans-serif`;

      // Pre-measure height
      let textHeight = 42;
      const wrappedItems = items.map(item => wrapTextLines(ctx, item, colWidth - boxPad * 2 - 18));
      for (const lines of wrappedItems) {
        textHeight += lines.length * (itemSize * 1.38) + 10;
      }
      const boxHeight = textHeight + boxPad;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x, y, colWidth, boxHeight, 12);
      ctx.fill();
      ctx.stroke();

      let innerY = y + boxPad + 8;
      ctx.font = `700 ${isVertical ? 21 : 19}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = titleColor;
      ctx.fillText(title, x + boxPad, innerY);
      innerY += 32;

      ctx.font = `400 ${itemSize}px system-ui, -apple-system, sans-serif`;
      for (const lines of wrappedItems) {
        ctx.fillStyle = bulletColor;
        ctx.fillRect(x + boxPad, innerY - 9, 6, 6);
        ctx.fillStyle = '#e2e8f0';
        for (const l of lines) {
          ctx.fillText(l, x + boxPad + 16, innerY);
          innerY += itemSize * 1.38;
        }
        innerY += 8;
      }

      return boxHeight;
    };

    const leftHeight = drawColumn(
      padX,
      cursorY,
      comp.leftTitle,
      comp.leftItems,
      'rgba(225, 29, 72, 0.45)',
      '#fda4af',
      '#fb7185'
    );

    if (isVertical) {
      drawColumn(
        padX,
        cursorY + leftHeight + 20,
        comp.rightTitle,
        comp.rightItems,
        'rgba(16, 185, 129, 0.55)',
        '#6ee7b7',
        '#34d399'
      );
    } else {
      drawColumn(
        padX + colWidth + colGap,
        cursorY,
        comp.rightTitle,
        comp.rightItems,
        'rgba(16, 185, 129, 0.55)',
        '#6ee7b7',
        '#34d399'
      );
    }
  } else if (scene.bullets.length > 0) {
    const bulletSize = isVertical ? 23 : 21;
    ctx.font = `500 ${bulletSize}px system-ui, -apple-system, sans-serif`;

    scene.bullets.forEach((bullet, idx) => {
      const stagger = easeOutCubic(Math.min(1, Math.max(0, (localProgress - idx * 0.08) / 0.22)));
      ctx.save();
      ctx.globalAlpha = alpha * stagger;
      const offsetX = (1 - stagger) * 18;

      const lines = wrapTextLines(ctx, bullet, contentWidth - 46);
      const itemHeight = lines.length * (bulletSize * 1.35) + 22;

      ctx.fillStyle = 'rgba(30, 41, 59, 0.65)';
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(padX + offsetX, cursorY - 6, contentWidth, itemHeight, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = scene.accent;
      ctx.fillRect(padX + offsetX + 16, cursorY + 12, 8, 8);

      ctx.fillStyle = '#f1f5f9';
      let lineY = cursorY + 23;
      for (const l of lines) {
        ctx.fillText(l, padX + offsetX + 36, lineY);
        lineY += bulletSize * 1.35;
      }

      cursorY += itemHeight + 12;
      ctx.restore();
    });
  }
  ctx.restore();

  // Bottom Timeline Progress Bar & Footer
  const footerY = height - (isVertical ? 54 : 38);
  ctx.save();
  ctx.fillStyle = 'rgba(148, 163, 184, 0.2)';
  ctx.fillRect(padX, footerY - 22, contentWidth, 4);
  ctx.fillStyle = scene.accent;
  ctx.fillRect(padX, footerY - 22, contentWidth * Math.max(0, Math.min(1, globalProgress)), 4);

  ctx.font = `500 ${isVertical ? 16 : 14}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('NotMediaWiki · Enciclopédia Livre e Auditável · Projetos WazzimaGiygg', padX, footerY + 4);
  ctx.restore();
}

export function pickSupportedWebmMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'video/webm';
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return 'video/webm';
}
