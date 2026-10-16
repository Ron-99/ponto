# Gráfico do saldo checks

Profile: light
Plan: `.specs/features/grafico-saldo/plan.md`

11 checks in 2 slices · 1 one-way door · 0 open

Os proofs unitários rodam com `bun test --conditions react-server`. O gráfico sai de duas funções
puras: a série (pontos e frase) e a geometria (caminhos, eixos, rótulos e `aria-label`). O
componente só interpola o resultado. C10 roda no build de produção com o Chrome headless, como o
teste do botão "Bater ponto". Antes de abrir o painel, ele grava `start_date` 10 dias antes de
hoje no banco temporário.

## Checks

### S1 - A série e a variação · 2 files · 18 KB · ~5k

- [x] **C1** - Com o banco desde 2026-07-01 e hoje 2026-10-16, a série tem 56 pontos. O primeiro é 2026-08-22, o último é 2026-10-16, e cada valor é o `accumulated` do dia. (AC 1)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "série das últimas 8 semanas"`

- [x] **C2** - Com o banco desde 2026-10-07 e hoje 2026-10-16, a série tem 10 pontos e começa em 2026-10-07 (AC 2)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "série começa no início do banco"`

- [x] **C3** - Hoje em andamento com `balance` −120 e acumulado anterior +90: o último ponto é +90, igual ao `total` de `loadBank` (`days.at(-1).accumulated`) (AC 3)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "último ponto é o saldo do topo"`

- [x] **C4** - Do primeiro ponto (22/08) ao último, +270 dá "Subiu 04:30 desde 22/08.", −135 dá "Caiu 02:15 desde 22/08." e 0 dá "Igual a 22/08." (AC 4)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "frase da variação"`

### S2 - O gráfico no painel · 4 files · 22 KB · ~6k

- [x] **C5** - A escala vertical sempre inclui o zero, e a geometria traz uma linha de referência nele. Uma série toda positiva (+30 a +270) põe o zero na base, uma toda negativa põe no topo, e uma que cruza põe no meio. (AC 5)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "gráfico sempre mostra o zero"`

- [x] **C6** - Para uma série de −60 a +270 que começa em 22/08, os rótulos são `+04:30` no topo, `−01:00` na base, `22/08` à esquerda e `hoje` à direita (AC 6)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "rótulos dos eixos"`

- [x] **C7** - Uma série que cruza o zero vira trechos com sinal: o trecho acima do zero usa a mesma classe de cor do saldo positivo de `Balance` (`text-emerald-600 dark:text-emerald-400`), e o abaixo, a do negativo (`text-red-600 dark:text-red-400`). O ponto de cruzamento fica exatamente no zero. `Balance` e o gráfico usam a mesma função de cor. (AC 7)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "trechos acima e abaixo do zero"`

- [x] **C8** - Uma série de 1 ponto não gera geometria e devolve a mensagem "O gráfico aparece a partir do segundo dia do banco." (AC 8)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "gráfico precisa de dois dias"`

- [x] **C9** - O `aria-label` de uma série que subiu 04:30 desde 22/08 até +01:30 é "Subiu 04:30 desde 22/08. Saldo de hoje: +01:30." (AC 9)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "descrição acessível do gráfico"`

- [x] **C10** - No painel em 360×800, com o banco de 10 dias, existe o card "Saldo nas últimas 8 semanas" com um `svg[role="img"]` cujo `aria-label` começa com "Subiu", "Caiu" ou "Igual". `document.documentElement.scrollWidth` ≤ 360, e a largura do SVG não passa a do card. (AC 5, AC 9, AC 10)
Proof: `bun test ./e2e/pwa.e2e.ts -t "gráfico do saldo cabe em 360px"`

- [x] **C11** - Nenhuma dependência nova: `package.json` e `bun.lock` não mudam na feature (door 1)
Proof: `git diff --exit-code 821eac4 -- package.json bun.lock`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| tamanho do banco (2) | ≥ 56 dias C1 · < 56 dias C2 | - |
| sentido da variação (3) | subiu C4 · caiu C4 · igual C4 | - |
| posição do zero (3) | série toda positiva C5 · toda negativa C5 · cruzando C5 | - |
| trechos por sinal (2) | positivo C7 · negativo C7 | - |
| quantidade de pontos (2) | 1, mensagem C8 · ≥ 2, gráfico C5, C10 | - |
| rótulos (4) | máximo C6 · mínimo C6 · data inicial C6 · `hoje` C6 | - |
| doors do plano (1) | SVG inline sem biblioteca C10, C11 | - |

- Nenhuma check afirma rota nem status HTTP: o plano não tem `Surface`.
- C5-C9 provam a geometria e os textos na função pura que o componente interpola. C10 prova no navegador o que só existe renderizado: o card, o SVG e a largura.

## Swept

- validation: n/a - não há entrada do usuário
- failure modes: n/a - função pura sem I/O. Os dados chegam pelo mesmo `loadBank` do painel.
- idempotency: n/a - nada é gravado
- authorization: existing - o painel é protegido pelo `proxy` (`src/proxy.ts`)
- concurrency: n/a - cálculo por requisição, sem estado compartilhado
- data lifecycle: C2 - um banco mais curto que a janela começa no primeiro dia
- dependency failure: n/a - não chama nada externo
- state transitions: n/a - não há estado
- observability: n/a - visual, sem log

## Handoff

- S1-S2 ≈ 10k tokens (≈ 40 KB: `hours.ts` 9 KB, `hours.test.ts` 9 KB, `page.tsx` 8 KB, `format.tsx` 3 KB, `e2e/pwa.e2e.ts` 7 KB, mais ≈ 4 KB novos no componente, ÷ 4), abaixo do budget de 150k - one builder
