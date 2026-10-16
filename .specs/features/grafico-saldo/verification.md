# Gráfico do saldo verification

**Verdict**: PASS
**Profile**: light
**Diff range**: 9ce7b34..eafbd5b
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

A árvore de trabalho difere de `eafbd5b` só em fim de linha (`git diff` sem saída de conteúdo), então
os proofs rodaram sobre o conteúdo de HEAD. Todas as 11 checks têm evidência localizada e passaram.
Os achados abaixo são lacunas de precisão e de nível que as checks aceitam. Nenhum deles invalida
uma check.

## Binding sources

None - o plano não marca nenhuma fonte como binding (`Sources` traz só o `ROADMAP.md` como
objetivo). O passo 1 não roda no perfil light.

## Checks

Proof unitário (C1-C9), uma invocação só:
`bun test --conditions react-server src/lib/hours.test.ts -t "série das últimas 8 semanas|série começa no início do banco|último ponto é o saldo do topo|frase da variação|gráfico sempre mostra o zero|rótulos dos eixos|trechos acima e abaixo do zero|gráfico precisa de dois dias|descrição acessível do gráfico" --reporter=junit`
deu exit 0, 9 pass, 42 filtered out, 0 fail. No junit, cada um dos 9 nomes aparece como `<testcase>`
da suíte "gráfico do saldo", sem `<skipped>`, com `assertions` > 0, e `failures="0"`.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | banco desde 2026-07-01: 56 pontos, de 2026-08-22 a 2026-10-16, valor = `accumulated` | unit, `série das últimas 8 semanas` exit 0 (junit line 433, 59 assertions) | `src/lib/hours.test.ts:436` - `expect(points).toHaveLength(56)`; `:437` - `expect(points[0].date).toBe("2026-08-22")`; `:438` - `expect(points.at(-1)?.date).toBe(TODAY)`; `:440` - `expect(p.value).toBe(byDate.get(p.date) as number)` | PASS |
| C2 | banco desde 2026-10-07: 10 pontos, começa em 2026-10-07 | unit, `série começa no início do banco` exit 0 (line 443) | `src/lib/hours.test.ts:445` - `expect(points).toHaveLength(10)`; `:446` - `expect(points[0].date).toBe("2026-10-07")` | PASS |
| C3 | hoje em andamento com saldo negativo: último ponto é +90 = `days.at(-1).accumulated` | unit, `último ponto é o saldo do topo` exit 0 (line 449) | `src/lib/hours.test.ts:459` - `expect(points.at(-1)?.value).toBe(90)`; `:460` - `expect(points.at(-1)?.value).toBe(days.at(-1)?.accumulated as number)`. Ver achado 3 (−120 da check e −360 do teste) | PASS |
| C4 | +270, −135 e 0 dão as três frases | unit, `frase da variação` exit 0 (line 463) | `src/lib/hours.test.ts:469` - `toBe("Subiu 04:30 desde 22/08.")`; `:470` - `toBe("Caiu 02:15 desde 22/08.")`; `:471` - `toBe("Igual a 22/08.")` | PASS |
| C5 | zero sempre na escala: base (positiva), topo (negativa), meio (cruzando) | unit, `gráfico sempre mostra o zero` exit 0 (line 474) | `src/lib/hours.test.ts:481` - `expect(positive.zeroY).toBe(positive.height)`; `:483` - `expect(negative.zeroY).toBe(0)`; `:487` - `expect(crossing.zeroY).toBeCloseTo((270 / 330) * crossing.height, 6)`. A linha de referência em si está só no componente (`src/components/balance-chart.tsx:23`); ver achado 2 | PASS |
| C6 | série de −60 a +270 desde 22/08: `+04:30`, `−01:00`, `22/08`, `hoje` | unit, `rótulos dos eixos` exit 0 (line 490) | `src/lib/hours.test.ts:493` - `expect(c.labels).toEqual({ top: "+04:30", bottom: "−01:00", start: "22/08", end: "hoje" })`. Ver achado 1 (série de um sinal só) | PASS |
| C7 | trechos com a classe de `Balance`, cruzamento exatamente no zero, mesma função de cor | unit, `trechos acima e abaixo do zero` exit 0 (line 496) | `src/lib/hours.test.ts:497` - `expect(balanceTone(30)).toBe("text-emerald-600 dark:text-emerald-400")`; `:498` - `expect(balanceTone(-30)).toBe("text-red-600 dark:text-red-400")`; `:501` - `expect(c.segments.map((s) => s.tone)).toEqual([balanceTone(1), balanceTone(-1), balanceTone(1)])`; `:510` - `expect(end?.[1]).toBeCloseTo(c.zeroY, 6)`; `:511` - `expect(start).toEqual(end)`. Que `Balance` usa a mesma função só é visto lendo o código: `src/components/format.tsx:22` - `balanceTone(minutes)` | PASS |
| C8 | 1 ponto: sem geometria, mensagem do segundo dia | unit, `gráfico precisa de dois dias` exit 0 (line 515) | `src/lib/hours.test.ts:516` - `expect(balanceChart([at(TODAY, 30)])).toEqual({ kind: "empty", message: "O gráfico aparece a partir do segundo dia do banco." })` | PASS |
| C9 | `aria-label` "Subiu 04:30 desde 22/08. Saldo de hoje: +01:30." | unit, `descrição acessível do gráfico` exit 0 (line 522) | `src/lib/hours.test.ts:528` - `expect(series.label).toBe("Subiu 04:30 desde 22/08. Saldo de hoje: +01:30.")` | PASS |
| C10 | 360×800, banco de 10 dias: card com `svg[role=img]`, label começa por Subiu/Caiu/Igual, sem rolagem, SVG dentro do card | `bun run build` exit 0, depois `bun test ./e2e/pwa.e2e.ts -t "gráfico do saldo cabe em 360px" --reporter=junit` exit 0, 1 pass, 5 filtered out (junit line 151, 4 assertions, `failures="0"`) | `e2e/pwa.e2e.ts:224` - `expect(chart).not.toBeNull()`; `:225` - `expect(chart?.label).toMatch(/^(Subiu\|Caiu\|Igual)/)`; `:226` - `expect(chart?.scrollWidth).toBeLessThanOrEqual(360)`; `:227` - `expect(chart?.svgWidth).toBeLessThanOrEqual(chart?.cardWidth ?? 0)`. Ver achado 4 | PASS |
| C11 | nenhuma dependência nova | `git diff --exit-code 821eac4 -- package.json bun.lock` exit 0 | a saída vazia com exit 0 é a própria asserção. O import novo `@libsql/client` em `e2e/pwa.e2e.ts:11` já era dependência do projeto | PASS |

### Achados (lacunas de precisão e de nível)

1. **Precisão, AC 6 / C6.** O AC 6 pede no eixo vertical "o maior e o menor valor da série". O código
   rotula os limites da escala presos ao zero (`src/lib/hours.ts:368` `Math.max(0, ...values)`,
   `:369` `Math.min(0, ...values)`, `:400-401`). Numa série toda positiva (+30 a +270), o rótulo de
   baixo mostra `00:00` e não o menor valor (`+00:30`). Numa toda negativa, o de cima mostra `00:00`.
   C6 só testa uma série que cruza o zero, onde as duas leituras dão o mesmo resultado, então uma
   implementação literal do AC e esta passam igual. Falta decidir qual leitura vale (o zero na escala
   do C5 sugere que a atual foi intencional) e acrescentar uma série de sinal único à check.
2. **Nível, AC 5-8 no componente.** C5-C8 provam a função pura. Nada prova que `BalanceChart`
   desenha o que ela devolve. Um componente sem a `<line>` do zero (`src/components/balance-chart.tsx:23`),
   sem `className={s.tone}` (`:43`), sem `labels.bottom`/`start`/`end` (`:57`, `:60-61`) ou sem a
   mensagem vazia (`:7`) passaria todas as checks: C10 só lê o `aria-label`, a largura e o
   `scrollWidth`. As checks aceitam isso de forma explícita ("o componente só interpola"). Na leitura,
   o componente está de acordo com AC 5-9 (zero com `text-border`, rótulos topo/base/início/"hoje",
   cor por `currentColor` + `balanceTone`, mensagem no lugar do SVG, `role="img"` + `aria-label`).
3. **Precisão, C3.** A check fala em "`balance` −120". O teste monta entrada às 08:00 e agora 10:00,
   o que dá −360 (comentário em `src/lib/hours.test.ts:450`), e só afirma `toBeLessThan(0)` (`:457`).
   A afirmação que decide a check (+90, `:459-460`) está correta. O número escrito na check está errado.
4. **Precisão, C10.** O teste só confere o prefixo do `aria-label`. Não confere que a gravação de
   `start_date` levou a 10 pontos, nem o texto completo. Qualquer série com 2 ou mais pontos passa. O
   texto exato está provado em nível unitário (C9), e a ligação `aria-label={label}`
   (`src/components/balance-chart.tsx:18`) e `label={series.label}` (`src/app/page.tsx:208`) só foi
   confirmada lendo o código.
5. **Menor, cor de série toda zero.** Com todos os valores 0, `sign` começa em 1
   (`src/lib/hours.ts:376`) e a linha sai verde, enquanto `Balance` mostra zero apagado
   (`text-muted-foreground`). Nenhum AC decide esse caso.

## Swept existing

- authorization: existing - confirmado. `src/proxy.ts` deixa passar só `/login`, os arquivos do PWA
  ou uma sessão válida (`isValidSession`). Fora disso, redireciona GET para `/login` e responde 401 a
  não-GET. O matcher cobre `/`, onde fica o card. O teste e2e "painel continua exigindo sessão"
  (`e2e/pwa.e2e.ts:80`) já existia.
- As outras linhas `n/a` são política aprovada. A linha "data lifecycle" está coberta por C2.

## Coverage

Not recomputed at light profile. A tabela `Coverage` de `checks.md` foi lida, mas não refeita.

## Faults injected

Not run at light profile - no faults injected.

## Gate

`bun run test` (`bun test --conditions react-server`) - 79 passed, 0 failed, 266 expect() calls,
7 files. Os logs `[feriados] falha ao importar 2026` são ruído de rede de outro teste e não são
falhas.
