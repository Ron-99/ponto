# Feriados nacionais automáticos

## Problem

Um dia útil passado sem batidas e sem abono conta −8h. Hoje todo feriado nacional precisa ser
marcado à mão no `DayDialog`. Se eu esquecer um, o saldo cai 8h em silêncio, e o painel não mostra
nada, porque `needsAttention` só aponta dias com batida ímpar ou com sequência inválida. São 12 a 14
datas por ano que a mesma pessoa precisa lembrar sempre. O app não tem dados sobre quantas vezes
isso já aconteceu.

Quando isso estiver pronto, todo feriado nacional desde a data de início do banco vai estar abonado
sem nenhuma ação minha, e o saldo deixa de depender da minha memória.

## Flow

Reaproveita `day_overrides` e o caminho `listOverrides` → `buildReport` sem mudanças: um feriado
importado vira uma linha de abono `feriado` igual às marcadas à mão.

1. `loadBank` (exists, `src/lib/data.ts`) - antes de ler os abonos, calcula os anos de `startDate` até `now.date` que ainda não têm `holidays_synced:<ano>` (door 1)
2. `syncNationalHolidays` (new, no door - placement per conventions) - `GET https://brasilapi.com.br/api/feriados/v1/<ano>` com timeout de 3s, valida a lista (door 3)
3. `db.ts` (exists) - um batch `write` por ano: insere cada data como `feriado` com `note` igual ao `name`, com `ON CONFLICT (date) DO NOTHING`, e grava `holidays_synced:<ano>` (door 1, door 2)
4. `listOverrides` → `buildReport` (exists) - inalterados, já leem as linhas novas
5. out: painel e relatório mostram o dia como "Feriado", e o `DayDialog` (exists) mostra o nome do feriado

## Impact

| Front | What changes |
| --- | --- |
| stored data | backfill now: o primeiro carregamento depois do deploy importa todos os anos desde a data de início do banco. Cada feriado passado em dia útil sem batidas sai de −8h para 0h, e as horas trabalhadas num feriado passam a contar inteiras como extra. **O saldo atual muda de uma vez só.** Abonos que já existem nessas datas ficam como estão. |
| domain | existing term: um abono `feriado` era sempre manual, e agora pode vir da importação. Nada no código diferencia a origem: `targetFor`, `summarizeDay`, `StatusBadge` e `OverridePicker` tratam o abono do mesmo jeito. |
| domain | new term: ano sincronizado, que é um ano cujos feriados já foram importados uma vez e nunca mais são buscados |
| runtime | o carregamento do painel e do relatório passa a fazer uma chamada HTTP externa (no máximo uma por ano não sincronizado) e a gravar no banco durante a renderização |

## Relations

None - no stored-data shape change. Os feriados entram em `day_overrides` (já existente) e a marca
de sincronização entra em `settings` (já existente), sem coluna nem tabela nova.

## Surface

None - nothing consumed outside. A chamada para a BrasilAPI é de saída, e nenhuma rota nova é exposta.

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| marca de ano importado | uma chave por ano em `settings`: `holidays_synced:2026` = `1`, gravada no mesmo batch das linhas | uma chave só com a lista `"2025,2026"`: duas requisições simultâneas, cada uma importando um ano diferente, sobrescrevem a lista e perdem um ano |
| feriado importado vira abono comum | `INSERT INTO day_overrides (date, kind, note) VALUES (?, 'feriado', <name>) ON CONFLICT (date) DO NOTHING`, sem coluna de origem | tabela `holidays` separada, aplicada por cima dos abonos: precisa guardar estado de "dispensado" para o botão "Dia normal" funcionar e cria uma segunda fonte de verdade para o abono |
| dependência externa | BrasilAPI `GET /api/feriados/v1/{ano}` via `fetch` nativo, sem pacote novo | calcular localmente (datas fixas mais a Páscoa): um feriado nacional criado por lei, como o 20/11 a partir de 2024, exigiria uma nova versão do app |

- Nothing else in this change is hard to reverse

## Criteria

### S1: Feriados importados viram abono (P1)

Ao abrir o app, os feriados nacionais dos anos do banco aparecem abonados.

**Acceptance Criteria**

1. WHEN o painel ou o relatório carrega e um ano X entre o ano de `startDate` e o ano de `now.date` não tem `holidays_synced:X` THEN the system SHALL buscar `https://brasilapi.com.br/api/feriados/v1/X` e gravar cada `date` retornada como abono `feriado` com `note` igual ao `name`
2. WHEN as linhas de um ano X são gravadas THEN the system SHALL gravar `holidays_synced:X` = `1` no mesmo batch `write`, de modo que ou as duas coisas persistem ou nenhuma persiste
3. WHILE `holidays_synced:X` existe the system SHALL não chamar a BrasilAPI para o ano X
4. IF a data de um feriado retornado já tem abono de qualquer tipo THEN the system SHALL manter o `kind` e a `note` existentes
5. IF o usuário marcou "Dia normal" num feriado importado THEN the system SHALL não recriar esse abono nos carregamentos seguintes
6. The system SHALL ignorar os itens da resposta cuja `date` não está no formato `yyyy-MM-dd` ou não pertence ao ano X
7. WHEN o `DayDialog` abre num dia com abono que tem `note` THEN the system SHALL mostrar a `note` (ex.: "Tiradentes") ao lado de "Abono do dia"

**Independent test:** apontar `PONTO_DB` para um banco novo com `start_date` = `2026-01-01`, abrir `/relatorio?periodo=mes&ref=2026-04-21` e ver 21/04 com o badge "Feriado" e saldo do dia 00:00.

### S2: Falha da BrasilAPI não derruba a página (P1)

Com a API fora do ar, o app continua funcionando e tenta de novo depois.

**Acceptance Criteria**

8. IF a BrasilAPI não responde em 3s, responde com status diferente de `200` ou devolve algo que não é uma lista não vazia de objetos com `date` e `name` THEN the system SHALL renderizar a página com os abonos já existentes e não gravar `holidays_synced:X`
9. IF a importação do ano X falhou THEN the system SHALL não tentar o ano X de novo no mesmo processo durante 1h
10. WHEN a importação de um ano falha THEN the system SHALL registrar `console.error` com o ano e o motivo (`timeout`, `status <n>` ou `resposta inválida`)

**Independent test:** com `fetch` simulado devolvendo `500`, carregar o painel duas vezes: a página renderiza, nenhuma linha é gravada e só uma chamada é feita.

## Out of scope

| Excluded | Why |
| --- | --- |
| Feriados estaduais e municipais | a BrasilAPI só cobre os nacionais, e o roadmap mantém esses como manuais |
| Pontes e recessos da empresa | regra da empresa, e o roadmap mantém como manual |
| Reimportar um ano já sincronizado | só serve se a lista oficial mudar depois da importação, o que é raro e precisa de uma ação de "reimportar" com regra própria |
| Aviso no painel quando a importação falha | a falha é temporária e a próxima tentativa acontece em até 1h. Um aviso visível precisa de texto e de um lugar no painel. |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Carnaval (2 dias) e Corpus Christi vêm como `national`, mas são ponto facultativo | importar tudo o que a API devolve, e quem trabalha nesses dias usa "Dia normal" | a maioria das empresas libera esses dias. Mas se você trabalha neles, cada dia esquecido vira +8h em silêncio, o inverso do problema original. | y - aprovado em 2026-10-16 ("pode seguir") |
| Feriado que cai no fim de semana (ex.: Páscoa, sempre domingo) | importar também | a meta já é 0h, então o saldo não muda. O badge mostra "Feriado" em vez de "Fim de semana". | n |
| Anos futuros | importar só até o ano de `now.date`, o que já inclui os feriados ainda por vir no ano atual | o ano seguinte é importado no primeiro carregamento depois de 1º de janeiro | n |
| Quando roda a importação | durante o carregamento de `/` e `/relatorio`, que já chamam `loadBank` | não existe cron na Vercel configurado, e um botão manual tiraria o "automático" | n |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen painel e relatório | empty state | n/a - nenhum estado novo, o dia só passa a ter abono |
| screen painel e relatório | loading state | existing - `Suspense` com "Carregando…". A chamada externa entra nesse tempo, limitada a 3s pelo AC 8. |
| screen painel e relatório | error state | AC 8 |
| screen painel e relatório | unauthorised | existing - `proxy.ts` redireciona para `/login` antes de `loadBank` |
| screen `DayDialog` | exibição do nome do feriado | AC 7 |
| screen `DayDialog` | destructive action confirms | existing - "Dia normal" remove sem confirmar, como hoje. AC 5 garante que a remoção é definitiva. |

## Sources

- `ROADMAP.md`, item "Feriados nacionais automáticos" - escopo (nacionais automáticos, municipais e pontes manuais)
- BrasilAPI `GET /api/feriados/v1/2026` - resposta conferida em 2026-10-16: 14 itens `{date, name, type: "national"}`, incluindo Carnaval (16 e 17/02) e Corpus Christi
