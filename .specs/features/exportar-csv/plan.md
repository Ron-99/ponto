# Exportar CSV

## Problem

Os dados do banco de horas só existem dentro do app: no arquivo `data/ponto.db` local ou no Turso
em produção. Para conferir um mês com o espelho de ponto oficial da empresa quando o saldo não
bate, preciso comparar dia a dia na tela, e não há como levar os números para uma planilha. Em
produção não existe backup que eu mesmo consiga fazer, porque o `sqlite3 .dump` do README só vale
para o arquivo local.

O `ROADMAP.md` não traz números, só os dois usos: backup e conferência mês a mês.

Quando isso estiver pronto, o relatório tem um botão que baixa o período visível (semana, mês ou
tudo) como CSV, um dia por linha, que abre direto no Excel ou no Google Planilhas.

## Flow

Reaproveita `loadBank` e `buildReport`: o CSV é o mesmo `ReportDay[]` que a tela do relatório
filtra, então os números do arquivo e da tela vêm do mesmo cálculo e não podem divergir.

1. botão "Exportar CSV" no relatório (`src/app/relatorio/page.tsx`, exists) - link para `/relatorio/csv?periodo=<p>&ref=<data>` com o período em tela
2. `proxy` (exists, `src/proxy.ts`) - sem sessão válida, redireciona o GET para `/login?next=...`, como em qualquer página
3. route handler `GET /relatorio/csv` (door 1) - lê `periodo` e `ref` com a mesma regra de fallback da página, chama `loadBank` (exists) e filtra o intervalo
4. `reportCsv` (new, no door - placement per conventions, puro em `src/lib`) - transforma os dias em texto CSV (door 2)
5. out: `200 text/csv` com `Content-Disposition: attachment` e o nome do arquivo (door 3)

## Impact

| Front | What changes |
| --- | --- |
| domain | `rangeFor` (hoje privado em `src/app/relatorio/page.tsx`) passa a ser compartilhado entre a página e a rota, para que os dois usem exatamente o mesmo intervalo |
| stored data | nothing to migrate - só leitura |
| docs | `README.md` troca a dica de backup por "Exportar CSV" no relatório e mantém o `.dump` para o arquivo local |

## Relations

None - no stored-data shape change

## Surface

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `GET /relatorio/csv` | `periodo` (`semana` · `mes` · `tudo`), `ref` (`yyyy-MM-dd`) | `text/csv; charset=utf-8`, anexo `ponto-<período>.csv` | `200`, `307` |

`307` é o redirecionamento do `proxy` para `/login` sem sessão. Parâmetro inválido não gera erro:
cai no mesmo padrão da página (`mes`, hoje).

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| primeiro route handler do projeto | `src/app/relatorio/csv/route.ts` com `export async function GET(request: NextRequest)`, protegido pelo `proxy` existente, sem checagem própria de sessão | Server Action que devolve o texto e o cliente monta um `Blob`: exige JavaScript no cliente para baixar e não funciona como link comum no PWA |
| colunas do CSV (uma planilha montada em cima delas quebra se mudarem) | cabeçalho literal `Data;Dia;Batidas;Trabalhado;Meta;Saldo;Acumulado;Status;Abono;Horas abonadas;Observações` | uma linha por batida: serve de backup bruto, mas não dá para comparar com o espelho de ponto, que vem um dia por linha |
| formato do arquivo | UTF-8 com BOM, separador `;`, fim de linha `\r\n`, datas `dd/MM/yyyy`, durações `HH:MM` com `-` nas negativas | separador `,` sem BOM: o Excel em pt-BR abre tudo numa coluna só e quebra os acentos |
| nome do arquivo | `ponto-<yyyy-MM>.csv` (mês), `ponto-semana-<yyyy-MM-dd>.csv` (segunda da semana), `ponto-ate-<yyyy-MM-dd>.csv` (tudo, até hoje) | nome fixo `ponto.csv`: vários meses baixados se sobrescrevem ou viram `ponto (3).csv` |

- Nothing else in this change is hard to reverse

## Criteria

### S1: Baixar o período em CSV (P1)

O relatório baixa os dias do período em tela, com os mesmos números da tela.

**Acceptance Criteria**

1. WHEN o relatório está aberto THEN the system SHALL mostrar um link "Exportar CSV" apontando para `/relatorio/csv` com o `periodo` e o `ref` da tela
2. WHEN `GET /relatorio/csv?periodo=mes&ref=2026-10-05` é pedido com sessão válida THEN the system SHALL responder `200`, `Content-Type: text/csv; charset=utf-8` e `Content-Disposition: attachment; filename="ponto-2026-10.csv"`
3. WHEN o período é `semana` com `ref` 2026-10-15 THEN the system SHALL nomear o arquivo `ponto-semana-2026-10-12.csv`, e quando é `tudo` com hoje 2026-10-16, `ponto-ate-2026-10-16.csv`
4. The system SHALL começar o arquivo com o BOM UTF-8 e a linha de cabeçalho `Data;Dia;Batidas;Trabalhado;Meta;Saldo;Acumulado;Status;Abono;Horas abonadas;Observações`, com linhas separadas por `\r\n`
5. The system SHALL escrever uma linha por dia do período que existe no banco (do início do banco até hoje), em ordem crescente de data, com os mesmos `worked`, `target`, saldo e `accumulated` que o relatório mostra para esse dia
6. IF `periodo` ou `ref` são inválidos THEN the system SHALL usar `mes` e a data de hoje, igual à página
7. IF nenhum dia do período existe no banco (ex.: um mês futuro) THEN the system SHALL responder `200` só com o cabeçalho
8. IF o pedido chega sem sessão válida e `APP_PASSWORD` está definida THEN the system SHALL redirecionar para `/login` com `next=/relatorio/csv?...` e não entregar o arquivo

**Independent test:** abrir o relatório de outubro, clicar em "Exportar CSV", abrir no Excel e conferir que o acumulado da última linha é o "Banco total" da tela.

### S2: Conteúdo de cada linha (P1)

Cada coluna traz o que é preciso para conferir o dia com o espelho de ponto.

**Acceptance Criteria**

9. The system SHALL escrever `Data` como `dd/MM/yyyy` e `Dia` como o nome do dia em pt-BR com inicial maiúscula (`Segunda`, `Terça`, ..., `Sábado`), como no relatório
10. The system SHALL escrever `Batidas` como os horários do dia em ordem, separados por espaço (ex.: `08:00 12:00 13:00 17:30`), e vazio num dia sem batidas
11. The system SHALL escrever `Trabalhado`, `Meta`, `Saldo` e `Acumulado` como `HH:MM`, com `-` no começo quando negativo e sem `+` quando positivo (ex.: `-01:30`, `00:45`)
12. WHEN o dia é hoje THEN the system SHALL escrever em `Saldo` o mesmo valor que o relatório mostra para hoje (só o excedente, `bankDelta`)
13. The system SHALL escrever `Status` com o mesmo rótulo do badge do relatório (ex.: `OK`, `Sem batidas`, `Batida ímpar`, `Atestado`)
14. WHEN o dia tem abono THEN the system SHALL escrever `Abono` com o tipo (`Feriado`, `Folga`, `Atestado`) e `Horas abonadas` com `HH:MM` no abono parcial ou vazio no dia inteiro
15. The system SHALL escrever em `Observações` a observação do abono e as observações das batidas no formato `HH:MM <observação>`, separadas por ` | `
16. IF um campo contém `;`, `"` ou quebra de linha THEN the system SHALL envolvê-lo em aspas e duplicar as aspas internas
17. IF um campo de texto livre (`Observações`) começa com `=`, `+`, `-` ou `@` THEN the system SHALL prefixá-lo com `'`, para a planilha não executá-lo como fórmula

**Independent test:** um dia com atestado parcial de 02:00, observação "consulta" e uma batida com observação "almoço longo" sai com `Atestado;02:00;consulta | 12:00 almoço longo`.

## Out of scope

| Excluded | Why |
| --- | --- |
| Importar um CSV de volta | o roadmap pede backup para guardar e conferir, não restauração. Restaurar exige resolver conflito com o que já está no banco. |
| Exportar as configurações (jornada, início do banco) | não entram na conferência dia a dia, e a meta de cada dia já sai na coluna `Meta` |
| Outros formatos (XLSX, PDF) | CSV abre em qualquer planilha sem dependência nova |
| Exportação automática ou agendada | precisa de armazenamento externo, que o app não tem |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Um arquivo ou dois (relatório diário e batidas brutas) | um arquivo, um dia por linha, com as batidas e as observações em colunas | serve aos dois usos do roadmap. Com o período "Tudo", é o backup legível de todo o histórico. | n |
| Onde fica o botão | no topo do relatório, ao lado da navegação de período | exporta exatamente o que está em tela, então o período escolhido já é o filtro | n |
| Durações no CSV | texto `HH:MM`, igual à tela | o espelho de ponto da empresa usa `HH:MM`. Hora decimal (1,5) obrigaria a converter de cabeça na conferência. | n |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen relatório | onde fica o botão e o que ele exporta | AC 1 |
| screen relatório | estado vazio | AC 7 (o arquivo sai só com o cabeçalho) |
| screen relatório | loading state | n/a - é um link de download comum, o navegador mostra o progresso |
| API `GET /relatorio/csv` | response shape | AC 2, AC 4, AC 9-AC 15 |
| API `GET /relatorio/csv` | error shape and codes | AC 6 (parâmetro inválido cai no padrão), AC 8 (sem sessão) |
| API `GET /relatorio/csv` | who may call it | AC 8 - existing, o `proxy` protege todas as rotas |
| API `GET /relatorio/csv` | versioning, rate limits | n/a - app de um usuário só, e o arquivo é baixado à mão |
| document CSV | structure | AC 4, AC 5 |
| document CSV | what the reader does next | AC 11, AC 13 (comparar com o espelho de ponto, coluna a coluna) |

## Sources

- `ROADMAP.md`, item "Exportar CSV" - os dois usos: backup e conferência mês a mês com o ponto oficial
