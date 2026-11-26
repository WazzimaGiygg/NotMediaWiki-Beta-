import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: null })),
  GoogleAuthProvider: vi.fn(function () {
    return { setCustomParameters: vi.fn() };
  }),
  signInWithPopup: vi.fn(),
  signInWithCredential: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(() => vi.fn()),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDocs: vi.fn(async () => ({ forEach: () => {} })),
  getDoc: vi.fn(),
  getDocFromServer: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()),
  query: vi.fn(),
  limit: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}));

import {
  SPECIAL_CHARACTER_GROUPS,
  SpecialCharactersMenu,
} from '../src/components/SpecialCharactersMenu';
import { insertTextAtCursor } from '../src/components/WikiEditor';

describe('SpecialCharactersMenu & WikiEditor Cursor Insertion', () => {
  it('defines grouped character sets for Greek, Cyrillic, IPA, Symbols, Latin, and world scripts with valid codepoints', () => {
    const ids = SPECIAL_CHARACTER_GROUPS.map(g => g.id);
    expect(ids).toContain('symbols');
    expect(ids).toContain('latin');
    expect(ids).toContain('ipa');
    expect(ids).toContain('greek');
    expect(ids).toContain('cyrillic');
    expect(ids).toContain('arabic-extended');
    expect(ids.length).toBe(29);

    const greek = SPECIAL_CHARACTER_GROUPS.find(g => g.id === 'greek')!;
    const cyrillic = SPECIAL_CHARACTER_GROUPS.find(g => g.id === 'cyrillic')!;
    const ipa = SPECIAL_CHARACTER_GROUPS.find(g => g.id === 'ipa')!;

    expect(greek.characters.some(c => c.char === 'Α')).toBe(true);
    expect(greek.characters.some(c => c.char === 'α')).toBe(true);
    expect(greek.characters.some(c => c.char === 'Ω')).toBe(true);
    expect(greek.characters.some(c => c.char === 'ω')).toBe(true);

    expect(cyrillic.characters.some(c => c.char === 'Д')).toBe(true);
    expect(cyrillic.characters.some(c => c.char === 'ж')).toBe(true);
    expect(cyrillic.characters.some(c => c.char === 'Я')).toBe(true);

    expect(ipa.characters.some(c => c.char === 'ə')).toBe(true);
    expect(ipa.characters.some(c => c.char === 'ʃ')).toBe(true);
    expect(ipa.characters.some(c => c.char === 'θ')).toBe(true);
    expect(ipa.characters.some(c => c.char === 'ˈ')).toBe(true);

    for (const group of [greek, cyrillic, ipa]) {
      expect(group.characters.length).toBeGreaterThanOrEqual(45);
      for (const item of group.characters) {
        expect(item.name.trim().length).toBeGreaterThan(0);
        expect(item.codepoint).toMatch(/^U\+[0-9A-F]{4,}$/);
      }
    }
  });

  it('renders grouped Greek, Cyrillic, and IPA grids with accessible buttons and clean styling', () => {
    const html = renderToStaticMarkup(
      <SpecialCharactersMenu onSelectCharacter={vi.fn()} onClose={vi.fn()} />
    );

    expect(html).toContain('data-testid="special-characters-menu"');
    expect(html).toContain('data-testid="special-chars-tab-all"');
    expect(html).toContain('data-testid="special-chars-tab-greek"');
    expect(html).toContain('data-testid="special-chars-tab-cyrillic"');
    expect(html).toContain('data-testid="special-chars-tab-ipa"');

    expect(html).toContain('data-testid="special-chars-group-greek"');
    expect(html).toContain('data-testid="special-chars-group-cyrillic"');
    expect(html).toContain('data-testid="special-chars-group-ipa"');

    expect(html).toContain('role="grid"');
    expect(html).toContain('data-char="Ω"');
    expect(html).toContain('data-char="Д"');
    expect(html).toContain('data-char="ə"');
    expect(html).toContain('aria-label="Inserir Ômega maiúsculo (Omega) (Ω)"');

    // Design system rules: zero border-l-4 and zero static rounded-full pills
    expect(html).not.toContain('border-l-4');
    expect(html).not.toContain('rounded-full');
  });

  it('supports filtering to an individual group (Greek, Cyrillic, or IPA)', () => {
    const greekOnlyHtml = renderToStaticMarkup(
      <SpecialCharactersMenu onSelectCharacter={vi.fn()} initialGroup="greek" />
    );
    expect(greekOnlyHtml).toContain('data-testid="special-chars-group-greek"');
    expect(greekOnlyHtml).not.toContain('data-testid="special-chars-group-cyrillic"');
    expect(greekOnlyHtml).not.toContain('data-testid="special-chars-group-ipa"');

    const ipaOnlyHtml = renderToStaticMarkup(
      <SpecialCharactersMenu onSelectCharacter={vi.fn()} initialGroup="ipa" />
    );
    expect(ipaOnlyHtml).toContain('data-testid="special-chars-group-ipa"');
    expect(ipaOnlyHtml).not.toContain('data-testid="special-chars-group-greek"');
    expect(ipaOnlyHtml).not.toContain('data-testid="special-chars-group-cyrillic"');
  });

  it('inserts selected characters at the exact cursor position or replaces active selection', () => {
    // Insert at start
    const atStart = insertTextAtCursor('MediaWiki', 'Ω ', 0);
    expect(atStart).toEqual({ nextText: 'Ω MediaWiki', nextCursor: 2 });

    // Insert in middle (cursor between 'Al' and 'fa')
    const inMiddle = insertTextAtCursor('Física:  = mc²', 'Δ', 8);
    expect(inMiddle).toEqual({ nextText: 'Física: Δ = mc²', nextCursor: 9 });

    // Replace selected substring '[sel]' inside text
    const replaceRange = insertTextAtCursor('Pronúncia: /[sel]/', 'ʃə', 12, 17);
    expect(replaceRange).toEqual({ nextText: 'Pronúncia: /ʃə/', nextCursor: 14 });

    // Consecutive multi-character insertions preserve advancing cursor position
    const step1 = insertTextAtCursor('ABC', 'Д', 1);
    const step2 = insertTextAtCursor(step1.nextText, 'ж', step1.nextCursor);
    expect(step2).toEqual({ nextText: 'AДжBC', nextCursor: 3 });

    // Clamp out-of-bounds offsets safely
    const clampedNeg = insertTextAtCursor('Olá', 'α', -10);
    expect(clampedNeg).toEqual({ nextText: 'αOlá', nextCursor: 1 });
    const clampedEnd = insertTextAtCursor('Olá', 'ω', 999);
    expect(clampedEnd).toEqual({ nextText: 'Oláω', nextCursor: 4 });
  });

  it('wires SpecialCharactersMenu and cursor-position insertion handler cleanly in WikiEditor and RichFormattedEditor', () => {
    const wikiEditorSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/WikiEditor.tsx'),
      'utf8'
    );
    const richEditorSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/RichFormattedEditor.tsx'),
      'utf8'
    );

    expect(wikiEditorSrc).toContain("import { SpecialCharactersMenu } from './SpecialCharactersMenu'");
    expect(wikiEditorSrc).toContain('const handleInsertSpecialCharacter = (char: string)');
    expect(wikiEditorSrc).toContain('insertTextAtCursor(currentWikitext, char, start, end)');
    expect(wikiEditorSrc).toContain('data-testid="toggle-special-characters-btn"');
    expect(wikiEditorSrc).toContain('onSelectCharacter={handleInsertSpecialCharacter}');
    expect(wikiEditorSrc).toContain('target.setSelectionRange(nextCursor, nextCursor)');
    expect(wikiEditorSrc).toContain('richEditorHandleRef.current.insertText(char)');

    expect(richEditorSrc).toContain('export interface RichFormattedEditorHandle');
    expect(richEditorSrc).toContain('insertText: insertPlainTextAtSelection');
  });
});
