# Instalar no celular (PWA)

## Problem

Bater ponto é a ação mais frequente do app, várias vezes por dia e quase sempre pelo celular. Hoje
isso significa abrir o navegador, achar a aba ou digitar o endereço e esperar a página com barra de
endereço. Fazer isso algumas vezes por dia tem um custo, e é aí que uma batida fica para depois e
vira um dia com batida ímpar. O app não tem um ícone próprio e, com `APP_PASSWORD` definida, o
`proxy.ts` redireciona para `/login` qualquer arquivo que o navegador peça para instalar o app.

Quando isso estiver pronto, um ícone na tela inicial abre o painel em tela cheia com o botão
"Bater ponto" à vista.

## Flow

Reaproveita o painel `/` e o `ClockButton` como estão: nenhuma tela nova, só o que o navegador
precisa para instalar.

1. navegador `GET /manifest.webmanifest` → `src/proxy.ts` (exists) - deixa passar sem sessão o manifest e os arquivos de ícone
2. `src/app/manifest.ts` (new, door 1) - devolve o `MetadataRoute.Manifest`
3. ícones (new, no door - placement per conventions): `src/app/apple-icon.png` (180×180) e PNGs de 192 e 512 em `public/`
4. `src/app/layout.tsx` (exists) - `metadata.appleWebApp` e `viewport.themeColor` para o iOS e para a barra de status
5. out: o ícone abre `/` (exists) em modo `standalone`. Sem sessão, `/login` (exists) volta para `/` depois de entrar.

## Impact

| Front | What changes |
| --- | --- |
| auth | a função `proxy` em `src/proxy.ts` passa a deixar passar sem sessão `/manifest.webmanifest`, `/apple-icon.png` e `/icons/*`, que ficam públicos mesmo com `APP_PASSWORD`. Esses arquivos expõem só o nome do app e o ícone, nenhum dado. |
| session | no iOS, o app instalado tem cookies separados dos do Safari, então o primeiro uso pede a senha uma vez. A sessão continua durando 1 ano (`SESSION_MAX_AGE`). |
| stored data | nothing to migrate |

## Relations

None - no stored-data shape change

## Surface

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `GET /manifest.webmanifest` | nenhum, sem cookie de sessão | `name` · `short_name` · `id` · `start_url` · `scope` · `display` · `background_color` · `theme_color` · `icons` | `200` |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| identidade do app instalado | `id: "/"`, `start_url: "/"`, `scope: "/"` | `start_url: "/?origem=pwa"` para medir o uso: o app não tem métricas, e mudar `id` ou `start_url` depois faz o navegador tratar como outro app, o que obriga a reinstalar |

- Nothing else in this change is hard to reverse

## Criteria

### S1: O navegador consegue instalar o app (P1)

O manifest e os ícones são servidos, inclusive sem login.

**Acceptance Criteria**

1. WHEN `GET /manifest.webmanifest` THEN the system SHALL responder `200` com `name` "Ponto · Banco de horas", `short_name` "Ponto", `id` "/", `start_url` "/", `scope` "/" e `display` "standalone"
2. The system SHALL listar no manifest um ícone PNG de `192x192` e um de `512x512`, e cada `src` SHALL responder `200` com `content-type` `image/png`
3. WHILE `APP_PASSWORD` está definida e não há cookie de sessão the system SHALL responder `200` em `GET /manifest.webmanifest`, nos ícones do manifest e em `GET /apple-icon.png`, sem redirecionar para `/login`
4. WHILE `APP_PASSWORD` está definida e não há cookie de sessão the system SHALL continuar respondendo `307` para `/login` em `GET /` e `GET /relatorio`
5. The system SHALL incluir no HTML de toda página `<link rel="manifest" href="/manifest.webmanifest">`, `<link rel="apple-touch-icon">` de 180×180 e `<meta name="apple-mobile-web-app-title" content="Ponto">`

**Independent test:** com `APP_PASSWORD` definida, `curl -i` no manifest e nos três ícones devolve `200`, e `curl -i /` devolve `307`.

### S2: Abrir pelo ícone vai direto ao botão (P1)

Pelo ícone, o app abre em tela cheia já no painel.

**Acceptance Criteria**

6. WHEN o app é aberto pelo ícone da tela inicial (Android Chrome ou iOS Safari) THEN the system SHALL abrir `/` sem a barra de endereço do navegador
7. WHEN `/` renderiza numa tela de 390×844 THEN the system SHALL mostrar o botão "Bater ponto" inteiro sem rolagem
8. IF o app é aberto pelo ícone sem sessão válida THEN the system SHALL mostrar `/login` dentro do app instalado e, depois da senha certa, voltar para `/` sem sair do modo tela cheia

**Independent test:** instalar no celular, fechar e abrir pelo ícone: o painel aparece sem barra de navegador e o botão está visível.

## Out of scope

| Excluded | Why |
| --- | --- |
| Funcionamento offline / service worker com cache | toda batida depende do servidor e do banco. Uma batida offline precisaria de fila e sincronização. |
| Notificações push | item separado do roadmap ("Lembrete de saída") |
| Atalhos no ícone (`shortcuts`), como "Bater ponto" com toque longo | bater direto pelo atalho seria uma ação sem confirmação visual. O painel já abre com o botão na tela. |
| Banner próprio de "Instalar app" | o menu do navegador já oferece a instalação |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Visual do ícone | o `ClockIcon` do lucide (o mesmo do cabeçalho) em branco sobre o fundo escuro do tema, com margem de segurança para ícone `maskable` | reaproveita a identidade que já está no cabeçalho | n |
| Cores do manifest | `background_color` e `theme_color` iguais ao fundo do tema claro, e `viewport.themeColor` com uma cor para claro e outra para escuro via `media` | o manifest só aceita uma cor, e a barra de status acompanha o tema pelo `viewport` | n |
| Service worker | nenhum | Chrome e Safari instalam pelo menu só com o manifest. **Não confirmei** se o Chrome Android atual exige service worker para mostrar o aviso automático de instalação. Sem ele, instala-se pelo menu "Instalar app"/"Adicionar à tela inicial". | n |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| API `GET /manifest.webmanifest` | response shape | AC 1, AC 2 |
| API `GET /manifest.webmanifest` | who may call it | AC 3 - público, por ser exigência do navegador |
| API `GET /manifest.webmanifest` | error shape, versioning, rate limits | n/a - arquivo estático gerado no build, sem entrada nem erro de domínio |
| screen app instalado | unauthorised | AC 8 |
| screen app instalado | empty, loading, error states | existing - os estados atuais de `/` (`Suspense` "Carregando…" e `error.tsx`) |
| screen app instalado | densidade e ordem | AC 7 |

## Sources

- `ROADMAP.md`, item "Instalar no celular (PWA)" - ícone na tela inicial, tela cheia, abre no botão "Bater ponto"
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/manifest.md` - convenção `app/manifest.ts` servida em `/manifest.webmanifest`
