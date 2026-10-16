# Instalar no celular (PWA) verification

**Verdict**: PASS
**Profile**: light
**Diff range**: 2c11813..0ce5310
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

## Binding sources

Profile `light`: step 1 (checks vs binding sources) is a `ui`-only step. The two sources the plan names
were still opened and read against the checks; no contradiction found.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| `ROADMAP.md` item "Instalar no celular (PWA)" (lines 13-15) | yes | none | - |
| `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/manifest.md` | yes - `app/manifest.ts` returning `MetadataRoute.Manifest`, served at `/manifest.webmanifest` | none | - |

ROADMAP asks for: home-screen icon (C2, C5), full screen without browser bar (C1/C6 declare
`display: "standalone"`; OS behaviour is device-only, see below), opens straight on "Bater ponto" (C8).

## Checks

All proofs run at HEAD `0ce5310`. Each named test was confirmed individually as passed through
`--reporter=junit` (bun's default non-TTY output prints only totals); 0 `<failure>` elements.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | manifest `200` with name/short_name/id/start_url/scope/display | `bun test ./e2e/pwa.e2e.ts` - "manifest é servido sem sessão" (e2e/pwa.e2e.ts:50) passed | `e2e/pwa.e2e.ts:52` - `expect(response.status).toBe(200)`; `e2e/pwa.e2e.ts:54` - `expect(m).toMatchObject({ name: "Ponto · Banco de horas", short_name: "Ponto", id: "/", start_url: "/", scope: "/", display: "standalone" })` | PASS |
| C2 | icons 192 and 512, each `200` `image/png`, IHDR matches | same run - "ícones do manifest existem com o tamanho declarado" (e2e/pwa.e2e.ts:66) passed | `e2e/pwa.e2e.ts:69` - `expect(sizes).toEqual(["192x192", "512x512"])`; `:74` - `expect(response.headers.get("content-type")).toBe("image/png")`; `:75` - `expect(pngSize(await response.arrayBuffer())).toBe(icon.sizes)` | PASS |
| C3 | without cookie, proxy passes manifest, both icons and apple-icon | `bun test --conditions react-server src/proxy.test.ts ...` - "arquivos do PWA são públicos" (src/proxy.test.ts:15) passed; e2e "manifest é servido sem sessão" passed | `src/proxy.test.ts:23` - `expect(response.headers.get("x-middleware-next")).toBe("1")`; `src/proxy.test.ts:24` - `expect(response.headers.get("location")).toBeNull()`; `e2e/pwa.e2e.ts:62` - `expect((await get(icon.src)).status).toBe(200)`; `e2e/pwa.e2e.ts:63` - `expect((await get("/apple-icon.png")).status).toBe(200)` (fetch with `redirect: "manual"`, server has `APP_PASSWORD`) | PASS |
| C4 | `/` and `/relatorio` still `307` -> `/login` | "páginas continuam exigindo sessão" (src/proxy.test.ts:28) passed; e2e "painel continua exigindo sessão" (e2e/pwa.e2e.ts:79) passed | `src/proxy.test.ts:31` - `expect(response.status).toBe(307)`; `:32` - `...pathname).toBe("/login")`; `e2e/pwa.e2e.ts:82` - `expect(response.status).toBe(307)`; `e2e/pwa.e2e.ts:83` - `expect(new URL(response.headers.get("location") ?? "", BASE).pathname).toBe("/login")` | PASS |
| C5 | HTML has manifest link, apple-touch-icon 180x180, apple-mobile-web-app-title; apple-icon 180x180 png | e2e "html anuncia manifest e ícone da apple" (e2e/pwa.e2e.ts:87) passed | `e2e/pwa.e2e.ts:89` - `expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest"')`; `:90` - `expect(html).toMatch(/<link rel="apple-touch-icon" href="\/apple-icon\.png[^"]*"[^>]*sizes="180x180"/)`; `:93` - `expect(html).toContain('<meta name="apple-mobile-web-app-title" content="Ponto"/>')`; `:96` - `expect(pngSize(await icon.arrayBuffer())).toBe("180x180")` | PASS |
| C6 | manifest declares `standalone` and scope `/` covering `/` and `/login` | "abre em tela cheia com o login dentro do escopo" (src/app/manifest.test.ts:4) passed | `src/app/manifest.test.ts:6` - `expect(m.display).toBe("standalone")`; `:7` - `expect(m.scope).toBe("/")`; `:9` - `expect(page.startsWith(m.scope ?? "")).toBe(true)` for `/` and `/login` | PASS |
| C7 | correct password with next `/` redirects to `/` | "login volta para o painel" (src/app/login/actions.test.ts:20) passed | `src/app/login/actions.test.ts:21` - `await expect(login("segredo", "/")).rejects.toThrow("NEXT_REDIRECT")`; `:22` - `expect(redirects).toEqual(["/"])` | PASS |
| C8 | at 390x844 "Bater ponto" bottom <= 844 | e2e "botão bater ponto aparece sem rolar" (e2e/pwa.e2e.ts:99) passed (headless Chrome found, 1.65s) | `e2e/pwa.e2e.ts:142` - `expect(bottom).not.toBeNull()`; `e2e/pwa.e2e.ts:143` - `expect(bottom as number).toBeLessThanOrEqual(844)` | PASS |

All five proof files are new in the diff range (`git diff --stat 2c11813..0ce5310`), so no proof
resolves only to a pre-existing test.

## Level and sampling judgment

- C1, C2, C4, C5 claim statuses/response shapes and each has a proof at the HTTP edge of the
  production build (`next start`). No level gap.
- C3 is proven both at the `proxy()` function and over HTTP. The proxy matcher
  (`src/proxy.ts:29`, `/((?!_next/static|_next/image|favicon.ico).*)`) does reach these paths, so the
  in-function `isPwaFile` check (`src/proxy.ts:5-8`) is the one that decides, and the e2e run confirms it.
- C5 samples only `/login` for "toda página" (AC 5). Acceptable: the tags come from the root
  `src/app/layout.tsx` `metadata`/`viewport`, shared by every route.
- C7 is below the HTTP boundary (Server Action), justified in checks.md because the action protocol
  needs the internal action ID. `src/app/login/page.tsx:23` defaults `next` to `/` when the proxy
  omits it for `/`, so the tested input matches the real flow.
- AC 6 and the "sem sair do modo tela cheia" half of AC 8 are OS behaviour on a real phone. The checks
  scope this honestly: C6 claims only what the browser receives (`display`/`scope`), and checks.md
  states the device part is a manual step. Not automated, not claimed as proven - recorded below.

## Swept existing

`authorization: C3, C4` and `state transitions: C7` resolve to checks, both proven above. All other
Swept rows are `n/a` (approved policy).

## Manual (not automatable, outside the automated verdict)

1. Install on Android Chrome and iOS Safari, close, open from the icon: `/` with no address bar,
   "Bater ponto" visible (AC 6, AC 7).
2. Open from the icon with no session: `/login` shows inside the installed app; after the correct
   password, back on `/` still in standalone (AC 8). On iOS expect one login (separate cookie jar).

## Observations (non-blocking)

- Built HTML (`.next/server/app/login.html`) emits `<meta name="mobile-web-app-capable" content="yes"/>`
  and `<meta name="theme-color" content="#ffffff"/>` from `appleWebApp.capable` / `viewport.themeColor`;
  no check asserts them. Coverage row "plataformas do AC 6 - iOS Safari C5, C6" leans on the manifest
  (honoured by iOS 16.4+) rather than this meta; fine under `light`.
- `isPwaFile` makes every path under `/icons/` public (`src/proxy.ts:8`), slightly wider than the plan's
  enumerated two files; `public/icons/` holds only the two PNGs, so nothing sensitive is exposed.
- `e2e/pwa.e2e.ts:89` matches the manifest link without its closing `/>`, which is intentionally loose.

## Gate

- `timeout 120 bun test --conditions react-server src/proxy.test.ts src/app/manifest.test.ts src/app/login/actions.test.ts` - 4 passed, 0 failed, exit 0
- `PONTO_DB="$(mktemp -d)/b.db" timeout 300 bun run build` - exit 0; routes include `/manifest.webmanifest` and `/apple-icon.png` (static)
- `timeout 120 bun test ./e2e/pwa.e2e.ts` - 5 passed, 0 failed, exit 0. Afterwards `netstat -ano | grep -E ":3999|:9333"` showed only `TIME_WAIT` entries, nothing `LISTENING`; no kill needed.
- No command timed out.
- `git status --short` after the build: only the pre-existing untracked entries (`.agents/`, `.claude/`, `.cursor/`, `.specs/LESSONS.md`, `.windsurf/`, `ROADMAP.md`); no tracked file changed.
- `validate_verification.py` was NOT run: no Python interpreter is available in this environment. The report was self-checked against its own rows (no non-PASS result, no Contradiction/Uncovered/Unproven cell).

Profile `light`: Coverage recompute, Test policy verdicts and fault injection do not run (checks.md has
no `Test policy` section).
