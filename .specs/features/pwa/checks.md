# Instalar no celular (PWA) checks

Profile: light
Plan: `.specs/features/pwa/plan.md`

8 checks in 2 slices · 1 one-way door · 0 open

Os proofs unitários rodam com `bun test --conditions react-server`. Os proofs de borda (`e2e/`)
sobem o build de produção com `next start` numa porta livre, com `APP_PASSWORD` definida e um
banco temporário, e precisam de `bun run build` antes.

## Checks

### S1 - O navegador consegue instalar o app · 5 files · 14 KB · ~4k

- [x] **C1** - `GET /manifest.webmanifest` responde `200` com `name` "Ponto · Banco de horas", `short_name` "Ponto", `id` "/", `start_url` "/", `scope` "/" e `display` "standalone" (AC 1)
Proof: `bun test ./e2e/pwa.e2e.ts -t "manifest é servido sem sessão"`

- [x] **C2** - O manifest lista um PNG `192x192` e um `512x512`. Cada `src` responde `200` com `content-type` `image/png`, e o cabeçalho IHDR do arquivo tem as dimensões declaradas (AC 2)
Proof: `bun test ./e2e/pwa.e2e.ts -t "ícones do manifest existem com o tamanho declarado"`

- [x] **C3** - Sem cookie e com `APP_PASSWORD`, o `proxy` deixa passar (`NextResponse.next`, sem `location`) `/manifest.webmanifest`, `/icons/icon-192.png`, `/icons/icon-512.png` e `/apple-icon.png` (AC 3)
Proof: `bun test --conditions react-server src/proxy.test.ts -t "arquivos do PWA são públicos"`
Proof: `bun test ./e2e/pwa.e2e.ts -t "manifest é servido sem sessão"`

- [x] **C4** - Sem cookie e com `APP_PASSWORD`, `/` e `/relatorio` respondem `307` com `location` em `/login` (AC 4)
Proof: `bun test --conditions react-server src/proxy.test.ts -t "páginas continuam exigindo sessão"`
Proof: `bun test ./e2e/pwa.e2e.ts -t "painel continua exigindo sessão"`

- [x] **C5** - O HTML de `/login` traz `<link rel="manifest" href="/manifest.webmanifest">`, `<link rel="apple-touch-icon" ... sizes="180x180">` e `<meta name="apple-mobile-web-app-title" content="Ponto">`. `/apple-icon.png` responde `200` `image/png` 180×180 (AC 5)
Proof: `bun test ./e2e/pwa.e2e.ts -t "html anuncia manifest e ícone da apple"`

### S2 - Abrir pelo ícone vai direto ao botão · 2 files · 10 KB · ~3k

- [x] **C6** - O manifest declara `display` "standalone" e `scope` "/", que cobre `/` e `/login`. Assim, abrir pelo ícone fica sem barra de endereço, inclusive no redirecionamento para o login (AC 6, AC 8)
Proof: `bun test --conditions react-server src/app/manifest.test.ts -t "abre em tela cheia com o login dentro do escopo"`

- [x] **C7** - Depois de entrar, o login volta para `/`: `login` com a senha certa e `next` "/" redireciona para `/` (AC 8)
Proof: `bun test --conditions react-server src/app/login/actions.test.ts -t "login volta para o painel"`

- [x] **C8** - Numa janela de 390×844, o botão "Bater ponto" de `/` fica inteiro acima da dobra: `getBoundingClientRect().bottom` ≤ 844 (AC 7)
Proof: `bun test ./e2e/pwa.e2e.ts -t "botão bater ponto aparece sem rolar"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `GET /manifest.webmanifest` statuses (1) | 200 C1 | - |
| caminhos públicos do PWA (4) | `/manifest.webmanifest` C3 · `/icons/icon-192.png` C3 · `/icons/icon-512.png` C3 · `/apple-icon.png` C3 | - |
| caminhos que continuam protegidos (2) | `/` C4 · `/relatorio` C4 | - |
| ícones (3) | 192 C2 · 512 C2 · apple 180 C5 | - |
| campos de identidade do manifest, door 1 (3) | `id` C1 · `start_url` C1 · `scope` C1, C6 | - |
| plataformas do AC 6 (2) | Android Chrome C6 · iOS Safari C5, C6 | - |

- C1, C2, C4 e C5 afirmam status ou forma de resposta, e cada um tem um proof que passa pela borda HTTP do build de produção (`e2e/pwa.e2e.ts`).
- C7 prova o redirecionamento na Server Action (`redirect("/")`), não pela borda HTTP: o protocolo de Server Actions exige o ID interno da action.
- C8 usa o Chrome headless via DevTools Protocol, numa janela 390×844 com a sessão já aberta.
- C6 prova o que o navegador recebe, não o comportamento do sistema operacional ao abrir pelo ícone. Essa parte só pode ser confirmada num aparelho e está listada no relatório como passo manual.
- C8 mede o layout. Se o ambiente não tiver um navegador headless, ele fica sem proof automático e conta como não provado.

## Swept

- validation: n/a - o manifest não recebe entrada
- failure modes: n/a - arquivo gerado no build. Se a geração falha, o build falha antes do deploy.
- idempotency: n/a - só respostas `GET` estáticas
- authorization: C3, C4
- concurrency: n/a - nada é gravado
- data lifecycle: n/a - nada é persistido
- dependency failure: n/a - nenhuma dependência externa em tempo de execução
- state transitions: C7
- observability: n/a - nenhum caminho novo pode falhar em produção

## Handoff

- S1-S2 ≈ 7k tokens (≈ 24 KB nos arquivos tocados ÷ 4), abaixo do budget de 150k - one builder

- **Boundary:** C1-C8 closed in the commit `feat(pwa)`
- **Settled mid-build:** `viewport.themeColor` ficou com uma cor só (`#ffffff`), porque o app não ativa o tema escuro (`.dark` existe no CSS, mas nenhum `ThemeProvider` o aplica). Os ícones foram gerados uma vez com `sharp` via node (sob o bun, o sharp trava no Windows) e commitados como PNG.
- **Abandoned:** liberar os arquivos pelo `matcher` do proxy. A checagem foi para dentro da função `proxy`, para poder ser testada chamando `proxy()` diretamente.
