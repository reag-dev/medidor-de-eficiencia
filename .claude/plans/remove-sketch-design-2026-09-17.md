# Plan: Remover o modo "Caderno de Esboço" (sketch) — manter só o design minimalista

**Date:** 2026-09-17
**Status:** draft
**Supersedes (parcial):** `.claude/plans/minimal-design-mode-2026-08-03.md` — aquele plano introduziu
o minimalista como *alternativa opcional* (toggle, default só em páginas internas autenticadas,
auth/landing explicitamente fora de escopo). Este plano inverte essa decisão: minimalista vira o
**único** design, em todo o app, sem alternância. O plano de agosto continua sendo a referência de
como a direção "Grade" (Big Shoulders Text, geometria reta, borda fina) foi escolhida — não precisa
ser refeita, só promovida de "opção" para "único estado".

## Goal

Remover completamente o design system "Caderno de Esboço" (bordas tremidas à mão, fontes
manuscritas, textura de caderno, animações de tremor/entrada, washi-tape, sombra "adesivo") do
app inteiro — incluindo login/registro/recuperação de senha e a landing pública, que hoje nunca
leem o toggle e sempre renderizam sketch — e deixar o modo minimalista ("Grade") como o único
design existente, sem opção de alternância.

## Scope

### In-Scope
- Aplicar o tratamento minimalista também em `layouts/auth.ejs` e `layouts/marketing.ejs`
  (hoje só `layouts/main.ejs`, e só quando `currentUser` existe).
- Remover por completo o mecanismo de toggle: botão `#designToggle`, `public/js/design-toggle.js`,
  cookie `design`, `readDesignCookie` (`src/app.ts`), `res.locals.design`, chave de i18n
  `layout.designToggleAriaLabel` (pt-BR/en-US).
- Fundir as regras de `public/css/minimal.css` diretamente em `tokens.css`/`components.css`/
  `styles.css` como o único estado (remover o escopo condicional `:not([data-design="sketch"])`),
  depois apagar `minimal.css`.
- Remover do CSS base: import das fontes decorativas (Handlee/Architects Daughter/Kalam),
  `@keyframes sketch-wobble`/`sketch-in` (ou esvaziar seu efeito, mantendo as classes nas 20 views
  que as referenciam como hooks inertes — ver Notas), filtro SVG rabiscado (`#sketch-rough-edge`/
  `#sketch-rough-icon`, `partials/svg-filters.ejs`, atributo `style="filter:..."` inline em
  `icon.ejs`), textura de grade do `body`, sombra "adesivo" de badge/tooltip, sublinhado
  "rabiscado" (`.stat-underline`), animação de "desenhar à mão" do gráfico de linha, tilt estático
  inline (`transform: rotate(var(--tilt))` em `reports/index.ejs` e `categories/index.ejs`).
- Decidir e remover/simplificar os elementos puramente decorativos de metáfora "papel/caderno"
  que não têm equivalente minimalista já pronto: `.washi-tape` (`auth/login.ejs` +
  `styles.css:127-136`) e o carrossel "post-it" da landing (`.marketing-usecase`,
  `styles.css:706-725`) — ver Phase 0.
- Atualizar `CLAUDE.md`, seção "Identidade visual": reescrever para descrever um design único
  (não mais "Caderno de Esboço" com alternativa minimalista).
- Remover as duas chaves de i18n do toggle e conferir se `pencil`/`square` (`icon.ejs`) ficam
  órfãos (remover se sim).

### Out-of-Scope
- `docs/design/kit-ui/` — cópia do kit de referência do design "sketch" original, já documentada
  no `CLAUDE.md` como "só para consulta", nunca importada pelo app em runtime. Fica como estava;
  removê-la é um pedido separado (arquivo histórico, não código vivo).
- Renomear o produto ("Sketch"/"Sketch your time") — é o nome da marca, não o efeito visual à mão;
  não confundir com este plano (ver `.claude/plans/rename-sketch-your-time-2026-07-28.md`, assunto
  não relacionado).
- Trocar a paleta de cores (`--paper`/`--ink`/`--accent-*`/`--postit-*` em si) — só a geometria,
  tipografia, efeitos e elementos puramente decorativos de "papel" saem; os tokens de cor oklch
  continuam (mesma decisão já tomada no plano de agosto).
- `/docs` (Swagger admin) — CSP e estilo próprios, fora do design system.

## Phases

### Phase 0: Prototipar minimalista em auth + landing (gate de 1h, território novo)

**Objective:** As páginas internas autenticadas já foram validadas em minimal (plano de agosto).
Auth e landing nunca receberam esse tratamento e têm elementos sem equivalente pronto no
`minimal.css` atual (washi-tape, carrossel post-it, hero grande, linhas de feature alternadas,
depoimentos) — provar que a extensão funciona antes de fundir tudo permanentemente.

**Steps:**
1. Localmente, sem commitar: linkar `public/css/minimal.css` também em `layouts/auth.ejs` e
   `layouts/marketing.ejs`, remover o `:not([data-design="sketch"])` do arquivo temporariamente
   (ou setar `data-design` ausente, que já é o default minimal) e navegar `/login`, `/register`,
   `/forgot-password`, `/reset-password/:token` e `/` (landing) nos dois temas.
2. Produzir um Artifact comparando 2-3 tratamentos para `.washi-tape` (remover vs. substituir por
   um traço minimalista simples) e para o carrossel `.marketing-usecase` (post-it colorido vs.
   badges/chips planos usando os mesmos tokens `--postit-*` sem o efeito de papel) — mesmo padrão
   de decisão visual já usado neste projeto (ver notas de `tokens.css`/`CLAUDE.md`). Confirmar a
   direção escolhida com o usuário.
3. Checar friction points: algum componente de auth/landing exige mudança estrutural de HTML (não
   só CSS) pra ficar limpo em minimal?

**Files Touched:** nenhum commit nesta fase — só protótipo local + 1 Artifact.

**Verify:** checagem visual manual (CDP ou navegador) nas rotas listadas, claro e escuro.

**Done When:** direção aprovada para `.washi-tape` e `.marketing-usecase`; lista de friction
points (se houver) documentada para as próximas fases.

**Time:** ~1h

**Replanning triggers:**
- Gate de prototipagem: se aparecerem >3 friction points reais ou a extensão exigir >2 gambiarras
  temporárias (ex.: hero/depoimentos precisam de reestruturação de HTML, não só CSS) → parar,
  reavaliar escopo com o usuário antes de prosseguir pras Fases 1-3.

### Phase 1: Remover o mecanismo de toggle

**Objective:** Tirar a opção de escolha — minimalista deixa de ser "default sem cookie" e vira o
único estado possível, em toda página.

**Steps:**
1. `src/app.ts`: remover `readDesignCookie` (linhas 32-44) e `res.locals.design = readDesignCookie(req)` (linha 133).
2. `src/views/layouts/main.ejs`: remover o botão `#designToggle` (linhas 36-39) e o
   `<script src="/js/design-toggle.js">` (linha 63); remover a condicional `data-design="sketch"`
   do `<html>` (linha 2); trocar `<% if (currentUser) { %><link ... minimal.css /><% } %>` por um
   `<link>` incondicional (linha 9-12, junto de `styles.css`).
3. `src/views/layouts/auth.ejs` e `src/views/layouts/marketing.ejs`: adicionar
   `<link rel="stylesheet" href="/css/minimal.css">` (mesma posição, depois de `styles.css`).
4. Apagar `public/js/design-toggle.js`.
5. `src/i18n/pt-BR.json` e `src/i18n/en-US.json`: remover a chave `layout.designToggleAriaLabel`
   (linha 78 nos dois arquivos).
6. `src/views/partials/icon.ejs`: remover as entradas `pencil`/`square` do `ICON_PATHS` se
   nenhuma outra view as referenciar (checar com grep antes de remover).

**Files Touched:** `src/app.ts`, `src/views/layouts/main.ejs`, `src/views/layouts/auth.ejs`,
`src/views/layouts/marketing.ejs`, `public/js/design-toggle.js` (deletado), `src/i18n/pt-BR.json`,
`src/i18n/en-US.json`, `src/views/partials/icon.ejs`

**Verify:** `npm run build && npm test && npm run lint`

**Done When:** build/test/lint verdes; nenhuma referência a `design-toggle`, `readDesignCookie`,
`data-design`, cookie `design` ou `designToggleAriaLabel` sobrando no código.

**Time:** ~1h

**Replanning triggers:**
- Se algum teste (`tests/`, `e2e/`) depender do cookie/atributo `design` (não identificado na
  varredura inicial, mas confirmar no `npm test`) → ajustar/remover esse teste nesta fase.

### Phase 2: Fundir minimal.css na base e apagar o sketch

**Objective:** Minimal deixa de ser um "override aditivo por cima do sketch" e vira a única regra
que existe — sem `minimal.css` separado, sem seletor condicional, sem CSS morto do sketch.

**Steps:**
1. `public/css/tokens.css`: trocar o `@import` de Handlee/Architects Daughter/Kalam pelo `@import`
   de Big Shoulders Text (hoje em `minimal.css:11`); redefinir `--font-body`/`--font-display`/
   `--font-accent`/`--font-body-stroke`/`--border-w`/`--radius-blob`/`--radius-pill`/`--radius-sm`
   direto em `:root` (linhas 62-65 e 92-95) com os valores que hoje estão em `minimal.css:14-21`;
   remover `@keyframes sketch-wobble` (linhas 139-144) e o efeito de tremor de
   `.sketch-hover:hover:not(:disabled)::before`/`:focus-visible` (linha 171-173, virar `animation: none`
   ou remover a regra); em `.sketch-in` (linha 152-155) e `@keyframes sketch-in` (145-148), manter a
   classe existindo (20 views a referenciam) mas sem animação (`animation: none`), consistente com
   `minimal.css:53-55` hoje; `.sketch-edge::before` (linha 156-170): aplicar direto o tratamento de
   `minimal.css:40-44` (`inset: 0; filter: none; border-color: color-mix(...)`), removendo
   `filter: url(#sketch-rough-edge)`.
2. `public/css/components.css`: aplicar direto o `font-weight: 700` de h1-h4 hoje condicional em
   `minimal.css:26-31` (checar se já não é 700 na base — se for, essa regra vira redundante e sai);
   remover a sombra "adesivo" de `.badge::before`/`.chart-tooltip::before` (equivalente a
   `minimal.css:72-75`, `box-shadow: none`).
3. `public/css/styles.css`: remover a textura de grade do `body` (equivalente a `minimal.css:34-36`,
   `background-image: none` — ou remover a declaração de textura original em vez de zerá-la);
   `.stat-underline` (linha 291-292): remover a regra ou escondê-la permanentemente
   (`display: none`, como `minimal.css:87-89`); animação do `.line-chart polyline`/`.bar-fill`:
   aplicar `animation: none; stroke-dashoffset: 0` direto (equivalente a `minimal.css:95-101`).
4. `src/views/partials/icon.ejs`: remover o parâmetro `rough`/`iconRough` e o
   `style="filter: url(#sketch-rough-icon)"` inline (linha 39 e 41) — nenhum ícone precisa mais do
   filtro rabiscado.
5. Apagar `src/views/partials/svg-filters.ejs` e seus 3 `<%- include('../partials/svg-filters') %>`
   (`layouts/main.ejs` linha 15, `layouts/auth.ejs` linha 12, `layouts/marketing.ejs` linha 12).
6. `.washi-tape` e `.marketing-usecase` (post-it): aplicar a direção aprovada na Phase 0 —
   remover/simplificar o elemento em `src/views/auth/login.ejs` e a regra em `styles.css:127-136`
   (washi-tape) e ajustar `src/views/marketing/landing.ejs` + `styles.css:706-725` (post-it) conforme
   decidido.
7. Apagar `public/css/minimal.css` e o `<link>` incondicional adicionado na Phase 1 (volta a ser só
   `styles.css`, agora já minimalista).
8. Remover `transform: rotate(var(--tilt))` inline de `src/views/reports/index.ejs` e
   `src/views/categories/index.ejs` (e o token `--tilt` se não sobrar nenhum outro uso).

**Files Touched:** `public/css/tokens.css`, `public/css/components.css`, `public/css/styles.css`,
`public/css/minimal.css` (deletado), `src/views/partials/icon.ejs`,
`src/views/partials/svg-filters.ejs` (deletado), `src/views/layouts/main.ejs`,
`src/views/layouts/auth.ejs`, `src/views/layouts/marketing.ejs`, `src/views/auth/login.ejs`,
`src/views/marketing/landing.ejs`, `src/views/reports/index.ejs`, `src/views/categories/index.ejs`

**Verify:** `npm run build && npm test && npm run lint` + checagem visual (CDP) em `/`, `/login`,
`/register`, `/forgot-password`, `/activities`, `/categories`, `/reports`, claro e escuro.

**Done When:** nenhum arquivo CSS/EJS referencia `sketch-rough-*`, `#sketch-rough-edge/icon`,
`minimal.css`, `data-design`; build/test/lint verdes; nenhuma borda tremida/filtro/animação de
tremor visível em nenhuma rota.

**Time:** ~3h

**Replanning triggers:**
- Se `.sketch-edge`/`.sketch-hover`/`.sketch-in` precisarem sair do HTML de alguma das 20 views
  (não só perder efeito via CSS) para o resultado ficar limpo → tratar essa view como sub-tarefa
  extra antes de fechar a fase.

### Phase 3: Regressão final + i18n/testes

**Objective:** Confirmar que a remoção é completa e nada quebrou.

**Steps:**
1. Rodar `npm run build && npm test && npm run lint` (suíte completa).
2. Buscar no repo por sobras: `sketch-rough`, `data-design`, `design=`, `readDesignCookie`,
   `designToggleAriaLabel`, `washi-tape`, `Handlee|Architects Daughter|Kalam` fora de
   `docs/design/kit-ui/` — confirmar zero resultados em `src/`/`public/`.
3. Passe visual final: home, atividades, categorias, relatórios, login, registro, recuperação de
   senha, landing pública — claro e escuro, sessão sem nenhum cookie.

**Files Touched:** nenhum (fase de verificação) — correções pontuais se algo aparecer.

**Verify:** `npm run build && npm test && npm run lint` + a busca acima + checagem visual.

**Done When:** suíte 100% verde, zero sobra de sketch fora do kit de referência, todas as rotas
renderizam o mesmo design minimalista.

**Time:** ~1h

### Phase 4: Documentação

**Objective:** `CLAUDE.md` deixa de descrever dois modos e passa a descrever um design só.

**Steps:**
1. Reescrever a seção "Identidade visual" do `CLAUDE.md`: remover a descrição do "Caderno de
   Esboço" como padrão + minimalista como alternativa; documentar o estado final (tipografia Big
   Shoulders Text, geometria reta, tokens de cor mantidos, sem toggle) como o único design,
   cobrindo todo o app (não só páginas internas).
2. Remover a menção ao plano de agosto como "mecanismo atual" e linkar este plano no lugar.

**Files Touched:** `CLAUDE.md`

**Verify:** leitura humana (não há verificação automatizada de docs neste repo).

**Done When:** `CLAUDE.md` não menciona mais alternância de design nem cookie `design`.

**Time:** ~30min

## Dependencies & Assumptions

- Depende da Phase 0 aprovar uma direção para `.washi-tape` e `.marketing-usecase` antes da Phase 2
  poder fechar — são os únicos dois elementos sem equivalente minimalista já pronto.
- Sem mudança de schema/banco — é só CSS/EJS/JS estático + uma função removida de `src/app.ts`.
- 20 dos 23 arquivos de view usam `.sketch-edge`/`.sketch-hover`/`.sketch-in` só como nome de
  classe — a remoção do *efeito* é 100% via CSS (Phase 2); renomear as classes em si é opcional e
  fica fora de escopo (risco de diff grande sem ganho funcional).

## Notes

- Nomes de classe como `.sketch-edge`/`.sketch-hover`/`.sketch-in` continuam existindo no CSS e nas
  20 views após este plano — viram só "nomes legados" de um componente que agora tem borda fina
  reta e sem animação. Renomear para algo neutro (`.card-edge`, `.hover-grow` etc.) é um refactor
  cosmético de nomenclatura, não visual — pode ser um pedido separado se o usuário quiser, mas não
  é necessário para "remover a direção de design de rascunho".
- `docs/design/kit-ui/` (kit de referência do sketch original) fica intacto — é cópia estática só
  pra consulta, nunca importada pelo app.
