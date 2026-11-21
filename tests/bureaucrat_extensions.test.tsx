import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const {
  mockGetDocs,
  mockSetDoc,
  mockDeleteDoc,
  mockOnSnapshot,
  mockCollection,
  mockDoc,
  mockGetAuth,
  mockAuthState,
} = vi.hoisted(() => {
  const authState = {
    currentUser: null as { uid: string; email?: string | null; displayName?: string | null } | null,
  };
  return {
    mockGetDocs: vi.fn(),
    mockSetDoc: vi.fn(),
    mockDeleteDoc: vi.fn(),
    mockOnSnapshot: vi.fn(() => vi.fn()),
    mockCollection: vi.fn((_db: unknown, col: string) => ({ col })),
    mockDoc: vi.fn((_db: unknown, col: string, id: string) => ({ path: `${col}/${id}` })),
    mockGetAuth: vi.fn(() => authState),
    mockAuthState: authState,
  };
});

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock('firebase/auth', () => ({
  getAuth: mockGetAuth,
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
  collection: mockCollection,
  doc: mockDoc,
  setDoc: mockSetDoc,
  deleteDoc: mockDeleteDoc,
  getDocs: mockGetDocs,
  getDoc: vi.fn(),
  getDocFromServer: vi.fn(),
  onSnapshot: mockOnSnapshot,
  query: vi.fn(),
  limit: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}));

import {
  hasBureaucratPrivileges,
  mergeExtensionsWithDefaults,
  initOrSyncExtensionsOnWikiAccess,
  saveExtensionToFirestore,
  deleteExtensionFromFirestore,
} from '../src/firebase';
import { DEFAULT_EXTENSIONS } from '../src/data/defaultExtensions';
import { getSiteTitleConfig } from '../src/extensions/siteTitleExtension';
import { WikiExtension, UserSession } from '../src/types';
import { BureaucratPage } from '../src/components/BureaucratPage';
import { ExtensionsLoadFailureScreen } from '../src/components/ExtensionsLoadFailureScreen';

describe('Bureaucrat Extension Management & Firebase Sync', () => {
  const bureaucratSession: UserSession = {
    id: 'uid_bureaucrat_1',
    username: 'PedroBurocrata',
    role: 'bureaucrat',
    editCount: 42,
    avatar: 'PB',
    email: 'pedrohenriquecardonaperes@gmail.com',
  };

  const editorSession: UserSession = {
    id: 'uid_editor_1',
    username: 'EditorComum',
    role: 'editor',
    editCount: 5,
    avatar: 'EC',
    email: 'editor@example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.currentUser = null;
  });

  it('identifies bureaucrat and super-admin privileges accurately', () => {
    expect(hasBureaucratPrivileges(bureaucratSession)).toBe(true);
    expect(hasBureaucratPrivileges(null, 'pedrohenriquecardonaperes@gmail.com')).toBe(true);
    expect(hasBureaucratPrivileges({ ...editorSession, role: 'sysop' })).toBe(true);
    expect(hasBureaucratPrivileges(editorSession, 'editor@example.com')).toBe(false);
    expect(hasBureaucratPrivileges(null, null)).toBe(false);
  });

  it('merges bureaucrat-configured Firebase overrides over default extensions while preserving custom extensions', () => {
    const cloudOverrides: WikiExtension[] = [
      {
        ...DEFAULT_EXTENSIONS[0],
        enabled: false,
        config: DEFAULT_EXTENSIONS[0].config.map((c, idx) =>
          idx === 0 ? { ...c, value: false } : c
        ),
      },
      {
        id: 'ext-custom-bureaucrat',
        name: 'CustomWikiBanner',
        namePt: 'Banner Customizado',
        version: '1.0.0',
        category: 'ui',
        author: 'PedroBurocrata',
        description: 'Extensão adicionada pelo burocrata no Firebase.',
        enabled: true,
        type: 'extension',
        license: 'MIT',
        hooks: [],
        config: [],
      },
    ];

    const merged = mergeExtensionsWithDefaults(cloudOverrides, DEFAULT_EXTENSIONS);
    const first = merged.find(e => e.id === DEFAULT_EXTENSIONS[0].id);
    const custom = merged.find(e => e.id === 'ext-custom-bureaucrat');

    expect(first?.enabled).toBe(false);
    expect(custom?.name).toBe('CustomWikiBanner');
    expect(merged.length).toBe(DEFAULT_EXTENSIONS.length + 1);
  });

  it('loads bureaucrat-saved extension configurations from Firebase Firestore on Wiki startup', async () => {
    const storedMaintenance: WikiExtension = {
      id: 'ext-maintenance-mode',
      name: 'WikiMaintenanceMode',
      namePt: 'Modo de Manutenção WikiWorlWeb',
      version: '2.0.0',
      category: 'infra',
      author: 'SRE',
      description: 'Manutenção',
      enabled: true,
      type: 'extension',
      license: 'GPL-2.0-or-later',
      hooks: [],
      config: [
        {
          key: '$wgMaintenanceModeActive',
          type: 'boolean',
          value: true,
          defaultValue: false,
          description: 'Ativo pelo burocrata',
        },
      ],
    };

    mockGetDocs.mockResolvedValueOnce({
      forEach: (cb: (docSnap: { data: () => WikiExtension }) => void) => {
        cb({ data: () => storedMaintenance });
      },
    });

    const loaded = await initOrSyncExtensionsOnWikiAccess(null);
    expect(mockGetDocs).toHaveBeenCalledTimes(1);
    expect(mockSetDoc).not.toHaveBeenCalled();

    const loadedMaintenance = loaded.find(e => e.id === 'ext-maintenance-mode');
    const flag = loadedMaintenance?.config.find(c => c.key === '$wgMaintenanceModeActive');
    expect(flag?.value).toBe(true);
  });

  it('does not attempt unauthorized Firestore seeding when collection is empty and visitor is not a bureaucrat', async () => {
    mockAuthState.currentUser = null;
    mockGetDocs.mockResolvedValueOnce({
      forEach: () => {},
    });

    const loaded = await initOrSyncExtensionsOnWikiAccess(editorSession);
    expect(loaded).toEqual(DEFAULT_EXTENSIONS);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('blocks non-bureaucrats from saving or deleting extensions in Firebase', async () => {
    mockAuthState.currentUser = {
      uid: 'uid_editor_1',
      email: 'editor@example.com',
      displayName: 'EditorComum',
    };

    await expect(
      saveExtensionToFirestore(DEFAULT_EXTENSIONS[0], editorSession)
    ).rejects.toThrow(/apenas burocratas/i);

    await expect(
      deleteExtensionFromFirestore('ext-custom', editorSession)
    ).rejects.toThrow(/burocratas/i);

    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });

  it('allows authenticated bureaucrats to persist and delete extension settings in Firebase', async () => {
    mockAuthState.currentUser = {
      uid: 'uid_bureaucrat_1',
      email: 'pedrohenriquecardonaperes@gmail.com',
      displayName: 'PedroBurocrata',
    };
    mockSetDoc.mockResolvedValueOnce(undefined);
    mockDeleteDoc.mockResolvedValueOnce(undefined);

    const extToSave = { ...DEFAULT_EXTENSIONS[0], enabled: false };
    const saved = await saveExtensionToFirestore(extToSave, bureaucratSession);

    expect(saved.enabled).toBe(false);
    expect(mockSetDoc).toHaveBeenCalledTimes(2);
    expect(mockSetDoc.mock.calls[0][0].path).toBe(`extensions/${extToSave.id}`);
    const writtenPayload = mockSetDoc.mock.calls[0][1];
    expect(writtenPayload.enabled).toBe(false);
    expect(writtenPayload.updatedBy).toBe('PedroBurocrata');
    expect(writtenPayload.updatedByRole).toBe('bureaucrat');
    expect(mockSetDoc.mock.calls[1][0].path).toMatch(/^system_logs\//);

    await deleteExtensionFromFirestore('ext-custom', bureaucratSession);
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
  });

  it('renders Página dos Burocratas with integrated Extension Management', () => {
    const html = renderToStaticMarkup(
      <BureaucratPage
        currentUser={bureaucratSession}
        onBackToWiki={() => {}}
      />
    );

    expect(html).toContain('Página dos Burocratas');
    expect(html).toContain('Especial:Burocratas');
    expect(html).toContain('Gerenciamento de Extensões');
    expect(html).toContain('Gerenciador de Extensões &amp; Módulos');
  });

  it('enforces hardened schema validation and bureaucrat RBAC on /extensions in firestore.rules and firebase-blueprint.json', () => {
    const rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
    const blueprint = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'firebase-blueprint.json'), 'utf8')
    );

    expect(rules).toContain('function isValidWikiExtension(data, extensionId)');
    expect(rules).toContain('match /extensions/{extensionId}');
    expect(rules).toContain('allow create, update: if isAdmin() && isValidWikiExtension(request.resource.data, extensionId);');
    expect(blueprint.entities.WikiExtension.properties.category.enum).toContain('engagement');
  });

  it('provides SiteTitle extension ($wgSitename) to rename the Wiki-site title from NotMediaWiki', () => {
    const siteTitleExt = DEFAULT_EXTENSIONS.find(e => e.id === 'ext-site-title');
    expect(siteTitleExt).toBeDefined();
    expect(getSiteTitleConfig(DEFAULT_EXTENSIONS).siteTitle).toBe('NotMediaWiki');

    const renamedCloudExt: WikiExtension = {
      ...siteTitleExt!,
      config: siteTitleExt!.config.map(param =>
        param.key === '$wgSitename'
          ? { ...param, value: 'WikiZero Brasil' }
          : param.key === '$wgSiteSubtitle'
            ? { ...param, value: 'Enciclopédia Livre Independente' }
            : param
      ),
    };

    const merged = mergeExtensionsWithDefaults([renamedCloudExt], DEFAULT_EXTENSIONS);
    const resolved = getSiteTitleConfig(merged);
    expect(resolved.siteTitle).toBe('WikiZero Brasil');
    expect(resolved.siteSubtitle).toBe('Enciclopédia Livre Independente');
    expect(resolved.fullBrandName).toBe('WikiZero Brasil | Enciclopédia Livre Independente');

    const disabledMerged = mergeExtensionsWithDefaults(
      [{ ...renamedCloudExt, enabled: false }],
      DEFAULT_EXTENSIONS
    );
    expect(getSiteTitleConfig(disabledMerged).siteTitle).toBe('NotMediaWiki');
  });

  it('rejects strict startup extension loading when Firebase fails instead of silently ignoring errors', async () => {
    mockGetDocs.mockRejectedValueOnce(new Error('permission-denied or network unavailable'));

    await expect(initOrSyncExtensionsOnWikiAccess(null)).rejects.toThrow(
      /permission-denied or network unavailable/i
    );
  });

  it('renders startup extension failure blocker allowing only retry or bureaucrat Google login', () => {
    const blockedHtml = renderToStaticMarkup(
      <ExtensionsLoadFailureScreen
        mode="failed"
        errorMessage="Firestore unavailable during startup"
        googleUserEmail={null}
        isNonBureaucratSignedIn={false}
        onRetryLoad={async () => {}}
      />
    );

    expect(blockedHtml).toContain('O Wiki-site não pode funcionar sem as extensões carregadas');
    expect(blockedHtml).toContain('Firestore unavailable during startup');
    expect(blockedHtml).toContain('Tentar carregar extensões novamente');
    expect(blockedHtml).toContain('Entrar com Google (Burocrata)');

    const nonBureaucratHtml = renderToStaticMarkup(
      <ExtensionsLoadFailureScreen
        mode="failed"
        errorMessage="Firestore unavailable during startup"
        googleUserEmail="editor@example.com"
        isNonBureaucratSignedIn={true}
        onRetryLoad={async () => {}}
      />
    );

    expect(nonBureaucratHtml).toContain('Acesso não autorizado para esta conta');
    expect(nonBureaucratHtml).toContain('editor@example.com');
    expect(nonBureaucratHtml).toContain('Trocar de Conta Google');
  });
});
