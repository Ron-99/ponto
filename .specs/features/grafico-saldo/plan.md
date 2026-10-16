# Gráfico do saldo

## Problem

O painel mostra o saldo de hoje, e o relatório mostra o acumulado dia a dia numa tabela. Nenhum
dos dois responde se o banco está crescendo ou caindo. Para saber isso, preciso abrir o relatório
de várias semanas e comparar a coluna "Acumulado" de cabeça, e uma queda lenta de 15 minutos por
dia só aparece quando já virou horas.

O `ROADMAP.md` não traz números, só o objetivo: "mostrar se o banco está crescendo ou caindo nas
últimas semanas, o que a tabela não deixa ver".

Quando isso estiver pronto, o painel tem um gráfico do saldo acumulado das últimas 8 semanas e uma
frase dizendo quanto ele subiu ou caiu nesse período.

## Flow

Reaproveita o `accumulated` de `buildReport`: cada ponto do gráfico é o acumulado de um dia, o
mesmo número da coluna "Acumulado" do relatório. Nada é recalculado.

1. `loadBank` (exists, `src/lib/data.ts`) - já entrega `days` com `accumulated` do início do banco até hoje
2. `balanceSeries` (new, no door - placement per conventions, função pura em `src/lib/hours.ts`) - recorta os últimos 56 dias e calcula a variação
3. `BalanceChart` (door 1) - componente de servidor que desenha um SVG inline
4. out: card "Saldo nas últimas 8 semanas" no painel (`src/app/page.tsx`, exists), abaixo dos cards Hoje e Semana atual

## Impact

| Front | What changes |
| --- | --- |
| domain | nada muda no cálculo. O gráfico só lê `accumulated`. |
| stored data | nothing to migrate |
| ui | o painel ganha um card. O primeiro gráfico do app, então as cores saem dos tokens de `globals.css`, que já têm variação de tema escuro. |

## Relations

None - no stored-data shape change

## Surface

None - nothing consumed outside

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| como o app desenha gráficos (o primeiro, e o próximo vai copiar) | SVG inline gerado num Server Component, sem biblioteca e sem JavaScript no cliente, com cores por `currentColor` e variáveis CSS do tema | `recharts` (base do componente Chart do shadcn): dependência nova e JavaScript no cliente para um gráfico de uma linha só, que o PWA baixaria toda vez |

- Nothing else in this change is hard to reverse

## Criteria

### S1: A série e a variação (P1)

**Acceptance Criteria**

1. The system SHALL usar um ponto por dia, de 55 dias antes de hoje até hoje (56 pontos), com o valor `accumulated` daquele dia
2. IF o banco começou há menos de 56 dias THEN the system SHALL começar a série no primeiro dia do banco
3. The system SHALL usar como último ponto o `accumulated` de hoje, igual ao saldo grande do topo do painel
4. WHEN a série tem 2 ou mais pontos THEN the system SHALL mostrar a frase "Subiu 04:30 desde 22/08." quando o último ponto é maior que o primeiro, "Caiu 02:15 desde 22/08." quando é menor e "Igual a 22/08." quando são iguais, com a data do primeiro ponto

**Independent test:** com um banco de 10 dias, o gráfico tem 10 pontos, e a frase compara o primeiro com hoje.

### S2: O gráfico no painel (P1)

**Acceptance Criteria**

5. WHEN a série tem 2 ou mais pontos THEN the system SHALL mostrar no painel o card "Saldo nas últimas 8 semanas" com uma linha do acumulado e uma linha de referência no zero
6. The system SHALL mostrar no eixo vertical os limites da escala em `HH:MM` com sinal (o maior valor da série ou zero, no topo, e o menor valor ou zero, na base), e no eixo horizontal a data do primeiro ponto e "hoje"
7. The system SHALL desenhar o trecho acima do zero com a cor de saldo positivo e o trecho abaixo com a cor de saldo negativo, as mesmas do componente `Balance`
8. IF a série tem menos de 2 pontos THEN the system SHALL mostrar no card "O gráfico aparece a partir do segundo dia do banco." no lugar do gráfico
9. The system SHALL dar ao SVG `role="img"` e um `aria-label` com a frase da variação e o saldo de hoje, para leitor de tela
10. WHILE a tela tem 360px de largura the system SHALL ocupar a largura do card sem rolagem horizontal

**Independent test:** abrir o painel no celular e ver o card com a linha, o zero e "Subiu ..." ou "Caiu ...".

## Out of scope

| Excluded | Why |
| --- | --- |
| Tooltip ou valor ao passar o dedo em cada dia | exige JavaScript no cliente. O valor exato de cada dia já está no relatório. |
| Escolher o período do gráfico | o roadmap fala em "últimas semanas". Um período fixo responde a pergunta sem mais um controle. |
| Gráfico no relatório | o relatório já tem a tabela. O objetivo é o que a tabela não mostra, e quem abre o painel todo dia é quem precisa ver a tendência. |
| Linha de projeção ou meta | é previsão, não histórico |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Onde fica o gráfico | no painel, abaixo dos cards Hoje e Semana atual | é a tela aberta todo dia, junto do saldo que o gráfico explica | n |
| Janela | 8 semanas (56 dias), um ponto por dia | "últimas semanas" com dados suficientes para ver tendência sem achatar a última semana | n |
| Fins de semana e feriados | entram como pontos normais, com o acumulado repetido | pular dias distorce o eixo do tempo, e a linha plana nesses dias é verdade | n |
| Hoje no meio do expediente | usa o `accumulated` de hoje, que só soma o excedente | é a mesma regra do saldo do topo, então o último ponto nunca contradiz o número grande | n |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen painel, card do gráfico | empty state | AC 8 |
| screen painel, card do gráfico | loading state | existing - o fallback "Carregando…" do `Suspense` do painel |
| screen painel, card do gráfico | error, unauthorised | existing - `error.tsx` e o `proxy` valem para o painel inteiro |
| screen painel, card do gráfico | density and ordering | AC 1, AC 6 |
| screen painel, card do gráfico | acessibilidade | AC 9 |
| screen painel, card do gráfico | celular | AC 10 |
| screen painel, card do gráfico | destructive action confirms | n/a - o gráfico não tem ação |
| document frase da variação | o que o leitor faz depois | AC 4 (sabe se precisa compensar) |

## Sources

- `ROADMAP.md`, item "Gráfico do saldo ao longo do tempo" - o objetivo: ver se o banco cresce ou cai nas últimas semanas
