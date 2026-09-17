import 'express-async-errors'; // encaminha rejeições de handlers async para o errorHandler (evita crash do processo)
import path from 'node:path';
import express, { Request } from 'express';
import expressLayouts from 'express-ejs-layouts';
import methodOverride from 'method-override';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { buildAppUrl, isProd } from './config/env';
import { DEFAULT_TIMEZONE } from './utils/time';
import { DEFAULT_LOCALE, createTranslator, isValidLocale } from './i18n';
import { sessionMiddleware } from './config/session';
import { loadOpenApiDocument } from './config/openapi';
import { globalLimiter } from './config/rateLimit';
import { routes } from './routes';
import { flash } from './middlewares/flash';
import { requireAdmin, requireAuth } from './middlewares/requireAuth';
import { errorHandler, notFound } from './middlewares/errorHandler';

/**
 * Lê o cookie "theme" (setado via JS por public/js/theme-toggle.js) sem precisar de
 * cookie-parser — só esse valor importa aqui. Ler no servidor (em vez de só localStorage)
 * garante que o <html> já nasce com o tema certo, sem depender de um script no <head>
 * rodar a tempo em toda navegação.
 */
function readThemeCookie(req: Request): 'dark' | 'light' {
  const header = req.headers.cookie;
  if (!header) return 'light';
  const match = header.split(';').map((part) => part.trim()).find((part) => part.startsWith('theme='));
  return match?.slice('theme='.length) === 'dark' ? 'dark' : 'light';
}

/**
 * Lê o cookie "setupTutorialSeen" (setado via JS por public/js/setup-tutorial-modal.js, mesmo
 * padrão dos demais cookies deste arquivo) — controla se o modal de tutorial dos modelos prontos
 * de categoria (ver .claude/plans/category-setup-templates-2026-08-04.md, Fase 4) já foi
 * dispensado. Diferente dos outros cookies acima, aqui só a presença importa (flag booleana),
 * não um valor com múltiplos estados válidos.
 */
function hasSetupTutorialSeenCookie(req: Request): boolean {
  const header = req.headers.cookie;
  if (!header) return false;
  return header.split(';').map((part) => part.trim()).some((part) => part === 'setupTutorialSeen=1');
}

function isValidTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Lê o cookie "tz" (setado via JS por public/js/timezone.js, mesmo padrão do cookie "theme")
 * usado para exibir horários no fuso do usuário (RNF05). Nunca confia no valor sem validar:
 * é um cookie não-httpOnly (pode ser adulterado), e um fuso IANA inválido faria
 * Intl.DateTimeFormat lançar exceção mais adiante, ao formatar/converter datas.
 */
function readTimezoneCookie(req: Request): string {
  const header = req.headers.cookie;
  if (!header) return DEFAULT_TIMEZONE;
  const match = header.split(';').map((part) => part.trim()).find((part) => part.startsWith('tz='));
  if (!match) return DEFAULT_TIMEZONE;
  let candidate: string;
  try {
    candidate = decodeURIComponent(match.slice('tz='.length));
  } catch {
    return DEFAULT_TIMEZONE; // cookie malformado (ex.: "%" solto) — decodeURIComponent lançaria URIError
  }
  return candidate && isValidTimeZone(candidate) ? candidate : DEFAULT_TIMEZONE;
}

/**
 * Lê o cookie "locale" (setado via JS por public/js/locale-toggle.js, mesmo padrão de "theme" e
 * "tz") — Fase 0 do RNF04 (i18n en-US, ver .claude/plans/i18n-en-us-2026-07-24.md). Cookie
 * não-httpOnly, por isso valida contra a lista fechada de locales suportados antes de confiar.
 */
function readLocaleCookie(req: Request) {
  const header = req.headers.cookie;
  if (!header) return DEFAULT_LOCALE;
  const match = header.split(';').map((part) => part.trim()).find((part) => part.startsWith('locale='));
  const candidate = match?.slice('locale='.length);
  return candidate && isValidLocale(candidate) ? candidate : DEFAULT_LOCALE;
}

export function createApp() {
  const app = express();

  // Atrás de proxy/load balancer em produção: necessário para IP real (rate limit) e cookie "secure" corretos.
  // O valor "1" assume um único hop confiável (ex.: um load balancer); ajuste conforme a topologia real.
  if (isProd) app.set('trust proxy', 1);

  // View engine (camada View do MVC)
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(expressLayouts);
  app.set('layout', 'layouts/main');

  // Parsers e assets
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use(methodOverride('_method')); // habilita PUT/DELETE em formulários HTML

  // Rate limit geral — mitigação de abuso/DoS (assets estáticos ficam de fora, servidos acima)
  app.use(globalLimiter);

  // Sessão e mensagens de feedback
  app.use(sessionMiddleware);
  app.use(flash);
  app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.currentUser = req.session.userId
      ? { id: req.session.userId, nome: req.session.userName, isAdmin: req.session.isAdmin ?? false }
      : null;
    res.locals.currentPath = req.path; // usado pela sidebar para destacar o item ativo
    res.locals.theme = readThemeCookie(req);
    res.locals.setupTutorialSeen = hasSetupTutorialSeenCookie(req);
    req.userTimezone = readTimezoneCookie(req);
    req.userLocale = readLocaleCookie(req);
    res.locals.locale = req.userLocale;
    res.locals.t = createTranslator(req.userLocale);
    res.locals.appUrl = buildAppUrl;
    res.locals.isProd = isProd;
    next();
  });

  // Documentação da API (Swagger/OpenAPI) — restrita a administradores (regra 11).
  // CSP e COEP desabilitadas apenas aqui: a UI do Swagger depende de recursos que a política padrão bloquearia.
  app.use(
    '/docs',
    requireAuth,
    requireAdmin,
    helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }),
    swaggerUi.serve,
    swaggerUi.setup(loadOpenApiDocument()),
  );

  // Cabeçalhos de segurança (CSP restritiva por padrão) para o restante da aplicação.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'style-src': ["'self'", 'https:', "'unsafe-inline'"],
        },
      },
    }),
  );

  // Rotas (camada Controller)
  app.use(routes);

  // Erros
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
