# NotMediaWiki

> Plataforma de base de conhecimento colaborativa e arquitetura de microsserviços em Node.js / TypeScript, Parsoid AST parser, EventStreams em tempo real e banco de dados Cloud Firestore do Firebase com segurança Zero-Trust ABAC.

---

## 🏛️ Arquitetura

O **NotMediaWiki** reimplementa as interfaces e serviços essenciais de uma wiki moderna sobre uma stack desacoplada de alto desempenho:

1. **Frontend SPA (React 19 + Vite + Tailwind CSS v4):**
   - Renderizador Parsoid AST com sanitização HTML anti-XSS (`sanitize-html`).
   - Editor de wikitexto com numeração de linhas, diff visual (Myers algorithm) e histórico de revisões SHA-256.
   - Suporte a tema escuro/claro, infoboxes, categorias, TOC hierárquico e notas de rodapé (`<ref>`).
   - Painéis de governança administrativa (ArbCom, CheckUser, WP:BLP Ethics Council, Ouvidoria LGPD e auditoria de conexões VPN).

2. **Backend API Gateway & Microsserviços (Express 4 + TypeScript):**
   - `/api/v1/content`: Gerenciamento e renderização de artigos com verificação de autorização e cache em memória.
   - `/api/v1/revisions`: Ledger imutável de revisões com cálculo determinístico de diffs e reversão de edições (rollback).
   - `/api/v1/parsoid`: Parser wikitexto para HTML5 semântico com validação Zod e sanitização estrita de tags.
   - `/api/v1/events`: Broadcast em tempo real de mudanças recentes via Server-Sent Events (SSE) com limitador de conexões simultâneas.
   - `/api/v1/auth`: CentralAuth RBAC com verificação de Firebase ID Token (JWT) e proteção estrita de papéis administrativos.
   - `/api/v1/telemetry`: Métricas de requisição, topologia de rede e circuit breakers.
   - `/api/v1/migration`: Matriz de correspondência arquitetural e testes de conformidade em tempo real.

3. **Banco de Dados & Segurança (Firebase Firestore):**
   - Regras de segurança em `firestore.rules` seguindo o modelo Zero-Trust / ABAC.
   - **Nenhuma escrita desprotegida:** Toda operação de escrita exige `request.auth != null`.
   - **Restrição estrita de administradores:** Apenas os e-mails expressamente designados (`pedrohenriquecardonaperes@gmail.com` e `mafersao1100@gmail.com`) ou usuários com papel verificado (`sysop`, `bureaucrat`, `admin`) podem alterar configurações globais, suspender contas ou mudar papéis de usuários.
   - Usuários comuns possuem papel fixo de `editor`, com permissão de criação e edição de artigos não protegidos e avaliação de conteúdo.

---

## ⚙️ Variáveis de Ambiente

Crie ou configure as variáveis no seu arquivo `.env` ou nas configurações do seu provedor de nuvem:

| Variável | Descrição | Exemplo |
|---|---|---|
| `PORT` | Porta de escuta do servidor Express (padrão: 3000) | `3000` |
| `NODE_ENV` | Ambiente de execução (`development`, `production`, `test`) | `production` |
| `APP_URL` | URL canônica onde a aplicação está hospedada (para CORS) | `https://ais-dev-...run.app` |
| `FIREBASE_PROJECT_ID` | ID do projeto no Firebase / Google Cloud | `wzzm-ce3fc` |
| `FIRESTORE_DATABASE_ID` | ID do banco Firestore provisionado | `ai-studio-88ce2285-e77c-419a-ac56-39b2ade858c5` |
| `GEMINI_API_KEY` | Chave de API opcional para recursos de inteligência (somente servidor) | `AIzaSy...` |

As credenciais do cliente web são lidas automaticamente a partir de `firebase-applet-config.json`.

---

## 🚀 Instalação e Execução Local

### Pré-requisitos
- **Node.js:** Versão 20.0.0 ou superior (`node >= 20`)
- **Gerenciador de pacotes:** `npm` ou `bun`

### Passos
```bash
# 1. Instalar dependências
npm install

# 2. Iniciar servidor de desenvolvimento (Full-stack: Express + Vite Middleware)
npm run dev

# 3. Executar verificações de tipo (TypeScript)
npm run lint

# 4. Executar suíte de testes automatizados (Vitest + Supertest)
npm test

# 5. Gerar build de produção para o bundle estático
npm run build
```

---

## ☁️ Deploy no Vercel

O projeto está configurado com `vercel.json` e a função serverless em `api/index.ts`:

1. No Vercel, o diretório `/api/*` é roteado diretamente para a função serverless Express exportada em `api/index.ts`.
2. As demais rotas da aplicação frontend SPA são reescritas para `/index.html` em `dist/`.
3. Para efetuar o deploy:
```bash
vercel deploy --prod
```

---

## 🔒 Regras de Segurança do Firestore

As regras de segurança em `firestore.rules` garantem:
- **`articles`:** Leitura pública; escrita apenas para usuários autenticados e não banidos com validação de tamanho (máximo de 200.000 caracteres no wikitexto). Artigos com `isProtected: true` só podem ser modificados por moderadores ou administradores. Exclusão restrita a administradores e moderadores.
- **`revisions` e `wiki_events`:** Registros imutáveis (sem permissão de `update` ou `delete`).
- **`users`:** Usuários autenticados podem editar seu próprio perfil básico, mas são impedidos de alterar seus próprios campos de `role`, `isBanned` ou `editCount`. Exclusão de usuários restrita a administradores.
- **Coleções sensíveis (`checkuser_investigations`, `vpn_detections`, `compliance_records`, etc.):** Leitura e escrita restritas a moderadores e administradores. Em `data_removals` e `emergency_reports`, a leitura é restrita apenas ao autor da solicitação e aos administradores.
- **`direct_chats` e `messages`:** Leitura e escrita restritas estritamente aos participantes da conversa.

---

## 🧪 Testes

A suíte de testes em `tests/` utiliza **Vitest** e **Supertest**:
```bash
npm test
```
- `tests/gateway.test.ts`: Testa rotas do gateway, rejeição de requisições não autenticadas (401), controle de acesso por papel (403), sanitização XSS de saída e execução dos testes de paridade.
- `tests/rules.test.ts`: Valida estaticamente as regras do Firestore, garantindo que não existam regras de escrita abertas (`allow ...: if true`) e que as restrições ABAC estejam implementadas.

---

## 📄 Licença

Distribuído sob a licença **Apache 2.0**. Consulte o arquivo [LICENSE](./LICENSE) para obter mais detalhes.
