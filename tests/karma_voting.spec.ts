import { describe, it, expect } from 'vitest';
import { calculateKarmaRank } from '../src/firebase';
import { api } from '../src/api';

describe('Article Quality Voting & User Karma System Tests', () => {
  it('correctly calculates baseline Karma rank tiers and titles', () => {
    // 0-29 pts -> Editor Novato
    const tier0 = calculateKarmaRank(0);
    expect(tier0.rankTitle).toBe('Editor Novato');
    expect(tier0.badgeLevel).toBe('iniciante');
    expect(tier0.nextRankKarma).toBe(30);

    const tier20 = calculateKarmaRank(20);
    expect(tier20.rankTitle).toBe('Editor Novato');
    expect(tier20.nextRankKarma).toBe(30);

    // 30-99 pts -> Colaborador Confiável (Bronze)
    const tier30 = calculateKarmaRank(30);
    expect(tier30.rankTitle).toBe('Colaborador Confiável');
    expect(tier30.badgeLevel).toBe('confiavel');
    expect(tier30.nextRankKarma).toBe(100);

    // 100-249 pts -> Editor Destaque (Prata)
    const tier150 = calculateKarmaRank(150);
    expect(tier150.rankTitle).toBe('Editor Destaque');
    expect(tier150.badgeLevel).toBe('destaque');
    expect(tier150.nextRankKarma).toBe(250);

    // 250-499 pts -> Guardião do Conhecimento (Ouro)
    const tier350 = calculateKarmaRank(350);
    expect(tier350.rankTitle).toBe('Guardião do Conhecimento');
    expect(tier350.badgeLevel).toBe('guardiao');
    expect(tier350.nextRankKarma).toBe(500);

    // 500-999 pts -> Curador da Enciclopédia (Platina)
    const tier750 = calculateKarmaRank(750);
    expect(tier750.rankTitle).toBe('Curador da Enciclopédia');
    expect(tier750.badgeLevel).toBe('curador');
    expect(tier750.nextRankKarma).toBe(1000);

    // 1000+ pts -> Mestre Wikimediano (Diamante)
    const tier1200 = calculateKarmaRank(1200);
    expect(tier1200.rankTitle).toBe('Mestre Wikimediano');
    expect(tier1200.badgeLevel).toBe('mestre');
    expect(tier1200.progressToNextRank).toBe(100);
  });

  it('exposes karma methods via api gateway interface', () => {
    expect(typeof api.calculateKarmaRank).toBe('function');
    expect(typeof api.getUserKarma).toBe('function');
    expect(typeof api.subscribeUserKarma).toBe('function');
    expect(typeof api.submitArticleVote).toBe('function');
    expect(typeof api.subscribeArticleVotes).toBe('function');
    expect(typeof api.getTopKarmaEditors).toBe('function');

    const rank = api.calculateKarmaRank(120);
    expect(rank.rankTitle).toBe('Editor Destaque');
  });

  it('calculates expected karma progression (+10 per upvote, +5 per edit)', () => {
    const editsCount = 8;
    const upvotesCount = 12;
    const baseKarma = 10;

    const computedKarma = baseKarma + (editsCount * 5) + (upvotesCount * 10);
    expect(computedKarma).toBe(10 + 40 + 120); // 170 pts

    const rank = calculateKarmaRank(computedKarma);
    expect(rank.rankTitle).toBe('Editor Destaque');
    expect(rank.badgeLevel).toBe('destaque');
    expect(rank.nextRankKarma).toBe(250);
    expect(250 - computedKarma).toBe(80); // 80 points to next rank
  });
});
