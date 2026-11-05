import React, { useState } from 'react';
import {
  BookOpen,
  GraduationCap,
  Newspaper,
  Search,
  ExternalLink,
  ChevronRight,
  Shield,
  Clock,
  Sparkles,
  Bookmark,
  Share2,
  AlertCircle,
  Settings,
  ArrowLeft,
  FileText,
  Calendar,
  User,
  Tag,
} from 'lucide-react';
import { getPortalsConfig } from '../extensions/portalsExtension';
import { UserSession } from '../types';

interface PortalViewProps {
  portalType: 'livros' | 'universitario' | 'jornal';
  currentUser: UserSession | null;
  onNavigateHome: () => void;
  onNavigateArticle: (slug: string) => void;
  onOpenExtensionsManager?: () => void;
}

export const PortalView: React.FC<PortalViewProps> = ({
  portalType,
  currentUser,
  onNavigateHome,
  onNavigateArticle,
  onOpenExtensionsManager,
}) => {
  const [searchFilter, setSearchFilter] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const portalsConfig = getPortalsConfig();

  const currentConfig = portalsConfig[portalType];
  const isBureaucrat = currentUser?.role === 'bureaucrat' || currentUser?.role === 'sysop';

  // If the portal's extension is disabled, show graceful disabled message
  if (!currentConfig || !currentConfig.enabled) {
    const portalNames = {
      livros: 'Wiki dos Livros',
      universitario: 'Wiki Universitário',
      jornal: 'Jornal WazzimaGiygg',
    };
    const extensionIds = {
      livros: 'ext-portal-livros',
      universitario: 'ext-portal-universitario',
      jornal: 'ext-portal-jornal',
    };

    return (
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 sm:p-12 text-center shadow-md">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 mx-auto mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <span className="text-[11px] font-mono uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800">
            3.05.3.g • Extensão Desativada
          </span>
          <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mt-3 mb-2">
            {portalNames[portalType]} está Desativado
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
            A extensão <code>{extensionIds[portalType]}</code> foi desativada nas configurações do sistema pelo Burocrata. Para acessar este conteúdo, é necessário ativar a extensão novamente.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onNavigateHome}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao Início</span>
            </button>
            {isBureaucrat && onOpenExtensionsManager && (
              <button
                onClick={onOpenExtensionsManager}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Gerenciar Extensões</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // PORTAL 1: WIKI DOS LIVROS
  if (portalType === 'livros') {
    const books = [
      {
        id: '1',
        title: 'Dom Casmurro',
        author: 'Machado de Assis',
        year: '1899',
        category: 'classicos',
        categoryLabel: 'Clássicos da Literatura',
        pages: 256,
        slug: 'Dom_Casmurro',
        description: 'Obra-prima do realismo brasileiro que narra as memórias de Bento Santiago (Bentinho) e sua obsessiva dúvida em relação à fidelidade de Capitu.',
      },
      {
        id: '2',
        title: 'Memórias Póstumas de Brás Cubas',
        author: 'Machado de Assis',
        year: '1881',
        category: 'classicos',
        categoryLabel: 'Clássicos da Literatura',
        pages: 224,
        slug: 'Memorias_Postumas_de_Bras_Cubas',
        description: 'Inovador romance narrado por um defunto-autor, inaugurando a fase realista com ironia mordaz e crítica social contundente.',
      },
      {
        id: '3',
        title: 'Manual de Engenharia de Software e Algoritmos',
        author: 'WazzimaGiygg Research & Tech Guild',
        year: '2026',
        category: 'tecnologia',
        categoryLabel: 'Tecnologia & Computação',
        pages: 412,
        slug: 'MediaWiki',
        description: 'Compêndio avançado cobrindo arquiteturas distribuídas, bancos de dados ACID/NoSQL e compiladores de gramáticas semânticas.',
      },
      {
        id: '4',
        title: 'O Cortiço',
        author: 'Aluísio Azevedo',
        year: '1890',
        category: 'classicos',
        categoryLabel: 'Clássicos da Literatura',
        pages: 304,
        slug: 'O_Cortico',
        description: 'Principal expoente do naturalismo brasileiro, retratando as tensões sociais e o determinismo na vida dos habitantes de uma habitação coletiva.',
      },
      {
        id: '5',
        title: 'Introdução aos Sistemas Operacionais Livres',
        author: 'Open Source Education Initiative',
        year: '2025',
        category: 'tecnologia',
        categoryLabel: 'Tecnologia & Computação',
        pages: 350,
        slug: 'Linux',
        description: 'Fundamentos de concorrência, gerenciamento de memória virtual, escalonamento preemptivo e sistemas de arquivos Unix.',
      },
      {
        id: '6',
        title: 'Os Lusíadas',
        author: 'Luís de Camões',
        year: '1572',
        category: 'poesia',
        categoryLabel: 'Poesia & Epopeia',
        pages: 380,
        slug: 'Os_Lusiadas',
        description: 'Poema épico em dez cantos que canta os feitos marítimos portugueses, em especial a viagem pioneira de Vasco da Gama à Índia.',
      },
    ];

    const filteredBooks = books.filter(b => {
      const matchCat = activeCategory === 'all' || b.category === activeCategory;
      const matchSearch =
        !searchFilter.trim() ||
        b.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
        b.author.toLowerCase().includes(searchFilter.toLowerCase());
      return matchCat && matchSearch;
    });

    return (
      <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-6">
        {/* Banner */}
        <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-lg border border-emerald-800/40">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
              Portal Oficial
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-white/10 text-slate-200">
              3.05.3.g • ext-portal-livros
            </span>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="w-8 h-8 text-emerald-400" />
            <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">
              Wiki dos Livros
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-emerald-100/90 max-w-2xl leading-relaxed">
            Biblioteca digital aberta e repositório colaborativo de literatura livre, e-books, manuais técnicos e compêndios educacionais no ecossistema WikiWorlWeb.
          </p>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeCategory === 'all'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Todos ({books.length})
            </button>
            <button
              onClick={() => setActiveCategory('classicos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeCategory === 'classicos'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Clássicos da Literatura
            </button>
            <button
              onClick={() => setActiveCategory('tecnologia')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeCategory === 'tecnologia'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Tecnologia & Computação
            </button>
            <button
              onClick={() => setActiveCategory('poesia')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeCategory === 'poesia'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Poesia & Epopeia
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              placeholder="Buscar livro ou autor..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600"
            />
          </div>
        </div>

        {/* Books Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBooks.map(book => (
            <div
              key={book.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs hover:border-emerald-500/50 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    {book.categoryLabel}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {book.year}
                  </span>
                </div>
                <h3 className="font-serif font-bold text-slate-900 dark:text-slate-100 text-base mb-1">
                  {book.title}
                </h3>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium">
                  {book.author}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3 mb-4">
                  {book.description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400 font-mono">
                  {book.pages} páginas
                </span>
                <button
                  onClick={() => onNavigateArticle(book.slug)}
                  className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Ler Verbete</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // PORTAL 2: WIKI UNIVERSITÁRIO
  if (portalType === 'universitario') {
    const courses = [
      {
        id: '1',
        title: 'Estruturas de Dados e Teoria dos Grafos',
        code: 'CC-204',
        faculty: 'Ciência da Computação',
        professor: 'Dr. Leonardo Vasconcelos',
        semester: '4º Semestre',
        slug: 'Algoritmo',
        topics: ['Árvores AVL e B-Trees', 'Algoritmo de Dijkstra', 'Complexidade O(n)', 'Paradigmas Gulosos'],
      },
      {
        id: '2',
        title: 'Arquitetura de Compiladores e Linguagens Formais',
        code: 'CC-401',
        faculty: 'Engenharia de Software',
        professor: 'Dra. Beatriz Menezes',
        semester: '7º Semestre',
        slug: 'MediaWiki',
        topics: ['Gramáticas Livres de Contexto', 'Árvores de Sintaxe Abstrata (AST)', 'Análise Léxica & LL(k)'],
      },
      {
        id: '3',
        title: 'Direito Digital, LGPD e Governança na Internet',
        code: 'DIR-310',
        faculty: 'Faculdade de Direito',
        professor: 'Dr. Roberto Cardona',
        semester: '6º Semestre',
        slug: 'Direito_Digital',
        topics: ['Marco Civil da Internet', 'Tratamento de Dados Pessoais', 'Responsabilidade Civil de Provedores'],
      },
      {
        id: '4',
        title: 'Estatística Computacional e Aprendizado de Máquina',
        code: 'MAT-302',
        faculty: 'Matemática e Estatística',
        professor: 'Dra. Camila Nogueira',
        semester: '5º Semestre',
        slug: 'Inteligencia_Artificial',
        topics: ['Regressão Multivariada', 'Teorema de Bayes', 'Redes Neurais Convolucionais', 'Inferência Estatística'],
      },
    ];

    return (
      <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-6">
        {/* Banner */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-lg border border-blue-800/40">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase bg-blue-500/20 text-blue-200 border border-blue-400/30">
              Campus Acadêmico Digital
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-white/10 text-slate-200">
              3.05.3.g • ext-portal-universitario
            </span>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <GraduationCap className="w-8 h-8 text-blue-400" />
            <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">
              Wiki Universitário
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-blue-100/90 max-w-2xl leading-relaxed">
            Espaço de produção científica, planos de ensino, ementas de disciplinas, teses e apostilas universitárias abertas para a comunidade acadêmica.
          </p>
        </div>

        {/* Courses & Ementas Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {courses.map(course => (
            <div
              key={course.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs hover:border-blue-500/50 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    {course.code} • {course.faculty}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {course.semester}
                  </span>
                </div>
                <h3 className="font-serif font-bold text-slate-900 dark:text-slate-100 text-base mb-1">
                  {course.title}
                </h3>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Docente: {course.professor}</span>
                </div>

                <div className="space-y-1.5 mb-4">
                  <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Ementa & Tópicos Centrais:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {course.topics.map((t, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded font-mono"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400">
                  Material Didático Aberto
                </span>
                <button
                  onClick={() => onNavigateArticle(course.slug)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Acessar Apostila</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // PORTAL 3: JORNAL WAZZIMAGIYGG
  const news = [
    {
      id: '1',
      headline: 'Atualização NotMediaWiki 3.05: Nova Arquitetura de Extensões Modulares',
      lead: 'Burocratas agora contam com painel expandido para modificar parâmetros, desativar módulos e gerenciar portais de conhecimento em tempo real no Firestore.',
      date: '05 de Novembro de 2026',
      author: 'Redação Oficial WazzimaGiygg',
      tag: 'Tecnologia & Governança',
      readTime: '4 min',
      slug: 'MediaWiki',
    },
    {
      id: '2',
      headline: 'Comitê de Arbitragem Divulga Relatório de Transparência e LGPD',
      lead: 'Auditoria quadrimestral confirma zero incidentes de vazamento e aprova a política de retenção mínima de dados de conexão com conformidade estrita.',
      date: '03 de Novembro de 2026',
      author: 'Despacho da Burocracia',
      tag: 'Governança',
      readTime: '3 min',
      slug: 'Comite_de_Arbitragem',
    },
    {
      id: '3',
      headline: 'Projeto Wiki dos Livros Ultrapassa Marca de Mil Verbetes Literários',
      lead: 'Iniciativa comunitária disponibiliza análises aprofundadas e transcrições de obras em domínio público com anotações críticas de pesquisadores.',
      date: '01 de Novembro de 2026',
      author: 'Gazeta Cultural',
      tag: 'Comunidade',
      readTime: '5 min',
      slug: 'Dom_Casmurro',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white rounded-2xl p-6 sm:p-8 shadow-lg border border-purple-800/40">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase bg-purple-500/20 text-purple-200 border border-purple-400/30">
            Imprensa Comunitária
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-white/10 text-slate-200">
            3.05.3.g • ext-portal-jornal
          </span>
        </div>
        <div className="flex items-center gap-3 mb-2">
          <Newspaper className="w-8 h-8 text-purple-400" />
          <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">
            Jornal WazzimaGiygg
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-purple-100/90 max-w-2xl leading-relaxed">
          Veículo oficial de jornalismo comunitário, cobertura das deliberações burocráticas, comunicados de infraestrutura e crônicas do ecossistema WikiWorlWeb.
        </p>
      </div>

      {/* Featured Headline */}
      <div className="bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-900/60 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-2 font-mono">
          <Sparkles className="w-4 h-4" />
          <span>Manchete Principal da Edição</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-3 leading-snug">
          {news[0].headline}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4 max-w-4xl">
          {news[0].lead}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {news[0].date}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-400" />
              {news[0].author}
            </span>
          </div>
          <button
            onClick={() => onNavigateArticle(news[0].slug)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Ler Matéria Completa</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Secondary News Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {news.slice(1).map(item => (
          <div
            key={item.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs hover:border-purple-400/50 hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  {item.tag}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {item.readTime}
                </span>
              </div>
              <h3 className="font-serif font-bold text-slate-900 dark:text-slate-100 text-base mb-2">
                {item.headline}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                {item.lead}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span>{item.date}</span>
              <button
                onClick={() => onNavigateArticle(item.slug)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-slate-700 dark:text-slate-300 hover:text-purple-700 dark:hover:text-purple-300 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Ler Reportagem</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
