# NotMediaWiki (Beta)

Alternativa de gerenciamento de wiki que exige o mínimo de programação. O projeto reproduz, em uma stack moderna (React + Node.js + Firebase), os conceitos centrais do MediaWiki: artigos em wikitext, histórico de revisões imutável, papéis de usuário, fluxo de mudanças recentes e ferramentas de governança da comunidade.

- **Site publicado:** https://not-media-wiki-beta.vercel.app
- **Status:** Beta — em desenvolvimento ativo. Veja a seção [Segurança](#segurança) antes de colocar em produção.

---

## Sumário

1. [Visão geral](#visão-geral)
2. [Como funciona](#como-funciona)
3. [Tecnologias](#tecnologias)
4. [Estrutura do projeto](#estrutura-do-projeto)
5. [Modelo de dados (Firestore)](#modelo-de-dados-firestore)
6. [Papéis de usuário](#papéis-de-usuário)
7. [Instalação e execução local](#instalação-e-execução-local)
8. [Configuração do Firebase](#configuração-do-firebase)
9. [Variáveis de ambiente](#variáveis-de-ambiente)
10. [Deploy na Vercel](#deploy-na-vercel)
11. [Segurança](#segurança)
12. [Roteiro (Roadmap)](#roteiro-roadmap)
13. [Contribuindo](#contribuindo)
14. [Licença](#licença)

---

## Visão geral

O NotMediaWiki é uma plataforma colaborativa de base de conhecimento. Ela oferece:

- **Artigos** escritos em wikitext, identificados por um *slug* único.
- **Histórico de revisões** imutável, com hash **SHA-256** de cada versão para verificação de integridade.
- **Fluxo de eventos** (`wiki_events`) no estilo *recentchange* do MediaWiki.
- **Contas e papéis** (leitor, editor, moderador, burocrata, sysop, bot).
- **Extensões** que podem ser ativadas ou desativadas por burocratas.
- **Lista de domínios permitidos** para controlar links externos.
- **Módulos de governança** da comunidade: arbitragem, verificação de contas (CheckUser), pedidos de desbloqueio, remoção de dados (LGPD), conselho de ética para biografias de pessoas vivas e contato de emergência.
- **Recursos de engajamento:** páginas pessoais, checklist diário, pontos mensais e avaliação de artigos.
- **Painel administrativo** com logs de sistema e status de sincronização.

## Como funciona

A aplicação tem três camadas:

```
┌───────────────────────────┐
│  Cliente (React + Vite)   │  Interface do wiki, editor, painéis
└─────────────┬─────────────┘
              │ SDK do Firebase (Auth + Firestore)      │ HTTP /api/v1
              ▼                                         ▼
┌───────────────────────────┐        ┌─────────────────────────────┐
│  Firebase                 │        │  Servidor Node.js (Express) │
│  • Authentication         │◄───────┤  • API Gateway (/api/v1)    │
│  • Firestore (dados)      │        │  • /health                  │
│  • Regras de segurança    │        │  • Serve o build do Vite    │
└───────────────────────────┘        └─────────────────────────────┘
```

1. **Cliente:** uma SPA em React 19 construída com Vite e estilizada com Tailwind CSS 4. O código wikitext/Markdown e de exemplos é realçado com Prism.js.
2. **Servidor (`server.ts`):** um servidor Express que
   - monta o gateway de microserviços em `/api/v1` (código em `server/`);
   - expõe `GET /health` para verificação de saúde;
   - devolve JSON 404 para qualquer rota `/api/*` inexistente (nunca cai no HTML da SPA);
   - em **desenvolvimento**, embute o Vite em modo middleware (hot reload);
   - em **produção**, serve os arquivos estáticos da pasta `dist/`.
3. **Firebase:** o Firestore guarda todo o conteúdo e os registros de governança. O Firebase Authentication identifica os usuários. As regras em `firestore.rules` definem quem pode ler e escrever em cada coleção.

### Ciclo de vida de uma edição

1. O usuário edita o wikitext de um artigo.
2. O sistema calcula o **SHA-256** do conteúdo e o tamanho em bytes.
3. É criado um documento **imutável** em `revisions` (nunca alterado nem apagado).
4. O artigo em `articles` é atualizado apontando para `latestRevisionId`.
5. Um evento é anexado em `wiki_events`, alimentando o painel de mudanças recentes.

## Tecnologias

| Camada | Tecnologia |
| --- | --- |
| Interface | React 19, Tailwind CSS 4, lucide-react, motion |
| Build | Vite, TypeScript |
| Servidor | Node.js, Express 4, tsx |
| Dados e autenticação | Firebase (Firestore + Authentication) |
| Realce de código | Prism.js |
| IA (opcional) | `@google/genai` (Gemini) |
| Gerenciador de pacotes | Bun (`bun.lock`) |
| Hospedagem | Vercel (`vercel.json`) |

## Estrutura do projeto

```
.
├── server/                    # Gateway de microserviços (rotas /api/v1)
├── src/                       # Código do cliente React
├── server.ts                  # Servidor Express (API + Vite/estáticos)
├── index.html                 # Ponto de entrada da SPA
├── vite.config.ts             # Configuração do Vite
├── tsconfig.json              # Configuração do TypeScript
├── vercel.json                # Configuração de deploy na Vercel
├── firestore.rules            # Regras de segurança do Firestore
├── firebase-blueprint.json    # Esquema das entidades e coleções
├── firebase-applet-config.json# Configuração do app web do Firebase
├── .env.example               # Modelo das variáveis de ambiente
├── metadata.json              # Metadados do projeto
└── package.json               # Dependências e scripts
```

## Modelo de dados (Firestore)

O esquema completo está em `firebase-blueprint.json`. Resumo das coleções:

| Coleção | Finalidade |
| --- | --- |
| `articles` | Artigos (slug, título, namespace, wikitext, categorias, proteção) |
| `revisions` | Revisões imutáveis com `sha256`, autor, comentário e tamanho |
| `wiki_events` | Fluxo de mudanças recentes |
| `users` | Perfis e papéis (RBAC) sincronizados com o Firebase Auth |
| `wiki_metadata` | Estatísticas gerais da plataforma |
| `sync_status` | Estado da sincronização entre servidor e Firestore |
| `system_logs` | Logs de sistema e microserviços |
| `extensions` | Extensões e módulos ativáveis |
| `allowed_domains` | Domínios externos permitidos, confiáveis ou bloqueados |
| `arbitration_cases` | Casos do Conselho de Arbitragem |
| `checkuser_investigations` | Investigações de contas suspeitas (fantoches) |
| `unblock_requests` | Pedidos de desbloqueio |
| `data_removals` | Pedidos de remoção de dados (LGPD, art. 18) |
| `emergency_reports` | Ocorrências de contato de emergência 24/7 |
| `compliance_records` | Registros de conformidade (LGPD e Marco Civil) |
| `user_pages` | Páginas pessoais dos usuários |
| `vpn_detections` | Auditoria de conexões e detecção de VPN |
| `blp_ethics_cases` | Conselho de Ética (biografias de pessoas vivas) |
| `direct_chats` / `messages` | Chat da comunidade |
| `user_daily_checklists` | Checklist diário |
| `user_monthly_points` | Pontos mensais acumulados |
| `article_ratings` | Avaliações de artigos |

## Papéis de usuário

| Papel | Descrição |
| --- | --- |
| `reader` | Lê o conteúdo |
| `editor` | Cria e edita artigos |
| `moderator` | Modera conteúdo e pedidos da comunidade |
| `bureaucrat` | Gerencia extensões, domínios permitidos e papéis |
| `sysop` | Administração completa |
| `bot` | Contas automatizadas |

> **Primeiro administrador:** depois do primeiro login, abra o Console do Firebase → Firestore → `users/{seu-uid}` e altere o campo `role` para `sysop`. A partir daí, promova os demais usuários pelo próprio wiki.

## Instalação e execução local

**Pré-requisitos:** [Bun](https://bun.sh) (ou Node.js 20+ com npm) e um projeto no [Firebase](https://console.firebase.google.com).

```bash
# 1. Clonar o repositório
git clone https://github.com/WazzimaGiygg/NotMediaWiki-Beta-.git
cd NotMediaWiki-Beta-

# 2. Instalar dependências
bun install            # ou: npm install

# 3. Criar o arquivo de variáveis de ambiente
cp .env.example .env   # depois edite com seus valores

# 4. Iniciar em modo desenvolvimento
bun run dev            # ou: npm run dev
```

Acesse `http://localhost:3000`.

### Scripts disponíveis

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Inicia o servidor Express com o Vite embutido (hot reload) |
| `npm run build` | Gera o build de produção em `dist/` |
| `npm start` | Inicia o servidor (use `NODE_ENV=production` para servir o `dist/`) |
| `npm run preview` | Pré-visualiza o build com o Vite |
| `npm run lint` | Verifica os tipos com `tsc --noEmit` |
| `npm run clean` | Remove `dist/` e `server.js` |

## Configuração do Firebase

1. Crie um projeto no Console do Firebase.
2. Ative o **Authentication** (por exemplo, login com Google).
3. Crie um banco **Firestore** em modo de produção.
4. Registre um app web e copie a configuração para `firebase-applet-config.json`.
5. Publique as regras de segurança:
   ```bash
   firebase deploy --only firestore:rules
   ```
   Ou cole o conteúdo de `firestore.rules` em *Firestore → Regras → Publicar*.
6. Defina o primeiro `sysop` (veja [Papéis de usuário](#papéis-de-usuário)).

## Variáveis de ambiente

Use o `.env.example` como referência. Valores típicos:

| Variável | Uso |
| --- | --- |
| `PORT` | Porta do servidor (padrão `3000`) |
| `NODE_ENV` | `production` para servir o build estático |
| `GEMINI_API_KEY` | Chave da API do Gemini, se os recursos de IA estiverem ativos |

> Nunca faça commit do arquivo `.env`. Segredos devem existir **apenas no servidor** e nunca no código do cliente.

## Deploy na Vercel

1. Importe o repositório na [Vercel](https://vercel.com).
2. Defina as variáveis de ambiente no painel do projeto.
3. O arquivo `vercel.json` já traz a configuração de roteamento.
4. Cada `git push` na branch `main` gera um novo deploy.

## Segurança

Este projeto está em **beta**. Antes de abrir o wiki ao público:

- [ ] **Regras do Firestore:** todas as regras de escrita devem exigir `request.auth` e verificar o papel do usuário. Regras com `allow ... if true` em escrita permitem que qualquer pessoa edite ou apague dados.
- [ ] **Coleções sensíveis privadas:** `direct_chats`, `checkuser_investigations`, `data_removals`, `compliance_records`, `emergency_reports`, `unblock_requests`, `vpn_detections` e e-mails em `users` **não devem** ter leitura pública.
- [ ] **Validação de campos:** aplicar limites de tamanho e tipos nas regras (o schema do blueprint não é imposto automaticamente).
- [ ] **Servidor:** adicionar `helmet`, CORS restrito, `express-rate-limit` e verificação do ID token do Firebase nas rotas de escrita.
- [ ] **Segredos:** nenhuma chave de API no bundle do cliente.
- [ ] **LGPD:** só declare conformidade depois de proteger os dados pessoais e definir política de privacidade e encarregado (DPO).

Para reportar uma vulnerabilidade, abra uma *issue* privada ou contate o mantenedor diretamente.

## Roteiro (Roadmap)

- [ ] Busca de texto completo (Algolia, Typesense ou Meilisearch)
- [ ] Parser de wikitext com templates, tabelas e referências
- [ ] Comparação (*diff*) entre revisões e reversão com um clique
- [ ] Páginas de discussão, redirecionamentos e mover página
- [ ] Upload de imagens e arquivos (Firebase Storage)
- [ ] Renderização no servidor ou pré-renderização para SEO, `sitemap.xml` e `robots.txt`
- [ ] Filtros antivandalismo e limite de edições para contas novas
- [ ] Exportação e importação de conteúdo, e backup automático
- [ ] Testes automatizados e integração contínua (GitHub Actions)
- [ ] Internacionalização da interface

## Contribuindo

Contribuições são bem-vindas.

1. Faça um *fork* do repositório.
2. Crie uma branch: `git checkout -b minha-melhoria`.
3. Rode `npm run lint` antes de enviar.
4. Faça o commit e abra um *Pull Request* descrevendo a mudança.

## Licença

Defina a licença do projeto adicionando um arquivo `LICENSE` (sugestão: MIT). Enquanto não houver licença, o código não pode ser legalmente reutilizado por terceiros.

---

Criado por [WazzimaGiygg](https://github.com/WazzimaGiygg).
