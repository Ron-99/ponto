# Alertas da CLT

## Problem

O painel mostra quanto trabalhei e quanto falta, mas nada avisa quando o dia passa de um limite
da CLT. Um almoço de 30 minutos num dia de 8h, 3h extras num dia ou uma entrada às 7h depois de
sair às 22h na véspera passam sem ninguém perceber. Esses são exatamente os pontos que a empresa
pode questionar depois, e eu só fico sabendo quando já não dá para ajustar o dia.

O `ROADMAP.md` não traz números além dos três limites: intervalo de 1h em jornada acima de 6h
(CLT art. 71), no máximo 2h extras por dia (art. 59) e 11h de descanso entre jornadas (art. 66).

Quando isso estiver pronto, o card "Hoje" lista em linguagem simples qual limite o dia de hoje
passou e por quanto.

## Flow

Reaproveita `summarizeDay`: os alertas são uma leitura do `DaySummary` de hoje e do dia anterior,
que `loadBank` já calcula. Nenhum dado novo é gravado.

1. `loadBank` (exists, `src/lib/data.ts`) - já entrega `days` até hoje, com batidas ordenadas, `worked` e `target`
2. `cltAlerts` (new, no door - placement per conventions, função pura em `src/lib/hours.ts`) - recebe o dia de hoje e o anterior e devolve a lista de alertas
3. out: o card "Hoje" do painel (`src/app/page.tsx`, exists) mostra cada alerta numa linha

## Impact

| Front | What changes |
| --- | --- |
| domain | new term: `alerta CLT` - aviso calculado sobre um dia, nunca gravado, que não altera saldo nem status |
| domain | `intervalo` - o tempo entre uma saída e a entrada seguinte no mesmo dia. Hoje não existe no código. |
| stored data | nothing to migrate |

## Relations

None - no stored-data shape change

## Surface

None - nothing consumed outside

## Landing

None - os alertas são calculados a cada requisição e não são gravados nem expostos. Mudar a regra
ou o texto é uma edição de função pura.

## Criteria

### S1: Intervalo de almoço (P1)

Avisa quando um dia com mais de 6h trabalhadas não teve um intervalo de pelo menos 1h.

**Acceptance Criteria**

1. WHEN hoje tem `worked` > 06:00 e nenhum intervalo entre uma saída e a entrada seguinte chega a 01:00 THEN the system SHALL mostrar "Intervalo de 00:30 numa jornada de 07:15. A CLT pede pelo menos 1h acima de 6h." com o maior intervalo do dia e o `worked`
2. WHEN hoje tem `worked` > 06:00 e nenhuma saída seguida de entrada THEN the system SHALL mostrar "Sem intervalo numa jornada de 06:20. A CLT pede pelo menos 1h acima de 6h."
3. WHEN hoje tem `worked` > 06:00 e algum intervalo ≥ 01:00 THEN the system SHALL não mostrar o alerta de intervalo
4. IF `worked` é exatamente 06:00 ou menos THEN the system SHALL não mostrar o alerta de intervalo

**Independent test:** batidas 08:00, 12:00, 12:30, 16:00 hoje: o card mostra "Intervalo de 00:30 numa jornada de 07:30. ...".

### S2: Horas extras (P1)

Avisa quando o dia passa de 2h extras.

**Acceptance Criteria**

5. WHEN `worked − target` de hoje passa de 02:00 THEN the system SHALL mostrar "02:30 de horas extras hoje. A CLT permite até 2h por dia." com o valor do dia
6. IF `worked − target` é exatamente 02:00 ou menos THEN the system SHALL não mostrar o alerta de horas extras
7. WHILE hoje tem entrada aberta the system SHALL calcular o alerta de horas extras com o `worked` até agora, então ele aparece no primeiro minuto acima de 2h na próxima atualização do painel

**Independent test:** num sábado sem jornada, 08:00-10:31 dá "02:31 de horas extras hoje. ...".

### S3: Descanso entre jornadas (P1)

Avisa quando a primeira entrada de hoje veio menos de 11h depois da última saída de ontem.

**Acceptance Criteria**

8. WHEN a primeira batida de hoje é uma entrada e a última batida de ontem é uma saída, com menos de 11:00 entre as duas THEN the system SHALL mostrar "Descanso de 09:30 desde a saída de ontem às 22:00. A CLT pede pelo menos 11h." com o intervalo e o horário
9. IF o intervalo é exatamente 11:00 ou mais THEN the system SHALL não mostrar o alerta de descanso
10. IF ontem não tem batidas, termina numa entrada, está `inconsistente` ou é anterior ao início do banco THEN the system SHALL não mostrar o alerta de descanso

**Independent test:** ontem com saída às 22:00 e hoje com entrada às 07:30: o card mostra "Descanso de 09:30 ...".

### S4: Exibição no painel (P1)

**Acceptance Criteria**

11. WHEN hoje tem um ou mais alertas THEN the system SHALL listá-los no card "Hoje", na ordem intervalo, horas extras, descanso, cada um com um ícone de aviso
12. IF hoje está `inconsistente` THEN the system SHALL não mostrar os alertas de intervalo e de horas extras, porque `worked` não é calculado nesse status
13. The system SHALL manter o saldo, a meta e o status do dia iguais com ou sem alertas

**Independent test:** os três cenários acima ao mesmo tempo listam três linhas, na ordem.

## Out of scope

| Excluded | Why |
| --- | --- |
| Alertas em dias passados, no relatório | o roadmap pede "no dia", para ainda dar tempo de ajustar. Fica para um próximo pacote se fizer falta. |
| Intervalo de 15 min para jornadas de 4h a 6h (art. 71 §1º) | não está na lista do roadmap |
| Limite semanal de 44h e descanso semanal de 24h | não estão na lista do roadmap |
| Aviso preventivo ("saia até 18:30 para não passar de 2h extras") | é previsão, não alerta. Combina mais com o item "Lembrete de saída". |
| Jornada que atravessa a meia-noite | o app já trata cada data separadamente, e mudar isso é outra feature |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Quais dias mostram alertas | só hoje, no card "Hoje" do painel | "no dia" e "no painel" no roadmap. É quando o aviso ainda serve para mudar o horário de saída. | n |
| Intervalo fracionado (ex.: 30 min + 30 min) | conta o maior intervalo, não a soma | a CLT trata o intervalo intrajornada como um período contínuo de 1h, salvo acordo coletivo | n |
| "Jornada acima de 6h" | horas trabalhadas do dia (`worked`), não a meta | o art. 71 fala do trabalho contínuo efetivamente feito | n |
| Horas extras em dia sem meta (fim de semana, abonado) | `worked − target` com `target` 0, então mais de 2h trabalhadas já alerta | é a mesma conta que o saldo já faz para esses dias | n |
| Tom dos textos | informativo, com o valor e o limite, sem vermelho de erro | o alerta não é falha do app. Às vezes a hora extra foi combinada. | n |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen painel, card Hoje | estado sem alertas | AC 3, AC 6, AC 9 (nada aparece, o card fica como hoje) |
| screen painel, card Hoje | ordem e densidade | AC 11 |
| screen painel, card Hoje | dia inconsistente | AC 12 |
| screen painel, card Hoje | loading, error, unauthorised | existing - o painel inteiro já trata, os alertas vêm no mesmo render |
| screen painel, card Hoje | destructive action confirms | n/a - os alertas não têm ação |
| document texto dos alertas | tom e o que fazer depois | AC 1, AC 2, AC 5, AC 8 (valor do dia mais o limite da CLT) |

## Sources

- `ROADMAP.md`, item "Alertas da CLT no dia" - os três limites e o lugar (painel)
