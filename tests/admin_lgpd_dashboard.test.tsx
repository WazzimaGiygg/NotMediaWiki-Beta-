import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import {
  LgpdRequestsProvider,
  INITIAL_LGPD_SEED_REQUESTS,
} from '../src/context/LgpdRequestsContext';
import { AdminLgpdDashboard } from '../src/components/admin/AdminLgpdDashboard';
import { UserSession } from '../src/types';

const mockBureaucrat: UserSession = {
  id: 'admin-1',
  username: 'Burocrata_Wazzima',
  userTag: '#1100',
  role: 'bureaucrat',
  editCount: 42,
  avatar: 'BW',
  email: 'dpo@wazzimagiygg.com',
};

describe('AdminLgpdDashboard & Global LgpdRequestsContext Suite', () => {
  it('renders requests directly from the global LgpdRequestsProvider state without static HTML files', () => {
    const html = renderToStaticMarkup(
      <LgpdRequestsProvider
        currentUser={mockBureaucrat}
        initialRequests={INITIAL_LGPD_SEED_REQUESTS}
        disableFirestoreSync
      >
        <AdminLgpdDashboard currentUser={mockBureaucrat} />
      </LgpdRequestsProvider>
    );

    expect(html).toContain('Central de Solicitações de Exclusão (LGPD / Oversight)');
    expect(html).toContain('LGPD-2026-089');
    expect(html).toContain('LGPD-2026-074');
    expect(html).toContain('JUD-2026-012');
    expect(html).toContain('Maria Souza Silva');
    expect(html).toContain('[[MediaWiki]]');
    expect(html).toContain('1 urgente');
    expect(html).toContain('2 concluídos');
    expect(html).toContain('Supressão Definitiva (Oversight)');
    expect(html).toContain('Ocultar Revisão (RevDel)');
    expect(html).toContain('Indeferir Pedido');
  });

  it('renders empty state with seed & create actions when global state has no requests', () => {
    const html = renderToStaticMarkup(
      <LgpdRequestsProvider
        currentUser={mockBureaucrat}
        initialRequests={[]}
        disableFirestoreSync
      >
        <AdminLgpdDashboard currentUser={mockBureaucrat} />
      </LgpdRequestsProvider>
    );

    expect(html).toContain('Nenhuma solicitação de exclusão LGPD registrada.');
    expect(html).toContain('Carregar Pedidos de Exemplo');
    expect(html).toContain('Registrar Nova Solicitação');
  });

  it('throws a descriptive error if AdminLgpdDashboard is rendered outside LgpdRequestsProvider', () => {
    expect(() =>
      renderToStaticMarkup(<AdminLgpdDashboard currentUser={mockBureaucrat} />)
    ).toThrow('useLgpdRequests deve ser usado dentro de um LgpdRequestsProvider.');
  });
});
