# Ponto · Banco de horas

Ponto eletrônico pessoal que mostra quanto você está devendo ou tem de crédito no banco de horas.

Stack: Next.js 16 (App Router, Server Actions), Tailwind v4, shadcn/ui, Bun, Biome e SQLite via libSQL (arquivo local ou [Turso](https://turso.tech) em produção).

## Uso

```bash
bun install
bun dev          # http://localhost:3000
```

Os dados ficam em `data/ponto.db` (crie um backup copiando esse arquivo). Use a variável `PONTO_DB` para apontar para outro arquivo.

Para usar no dia a dia, prefira o build de produção:

```bash
bun run build && bun run start
```

## Deploy na Vercel (com Turso)

A Vercel não tem disco gravável, então o arquivo SQLite local não funciona lá. Em produção o app usa o Turso, que é SQLite hospedado.

1. Crie um banco no Turso. Pelo [painel](https://app.turso.tech) ou pela CLI:
   ```bash
   turso db create ponto
   turso db show ponto --url        # TURSO_DATABASE_URL (libsql://...)
   turso db tokens create ponto     # TURSO_AUTH_TOKEN
   ```
2. Na Vercel, em **Settings → Environment Variables**, adicione `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` e `APP_PASSWORD` (a senha de acesso; veja abaixo).
3. Faça um novo deploy. As tabelas são criadas automaticamente na primeira requisição.

### Senha de acesso

Com `APP_PASSWORD` definida, todas as páginas e ações pedem login. A sessão dura 1 ano no navegador, e o ícone de sair fica no topo da página. Trocar a senha encerra todas as sessões abertas. Sem a variável, como no uso local, o app fica aberto.

Opcional: `APP_TIMEZONE` define o fuso usado para "agora". O padrão é `America/Sao_Paulo`, já que o servidor da Vercel roda em UTC.

Para migrar os dados locais para o Turso, faça isto antes de abrir o app em produção, enquanto o banco ainda está vazio: gere o dump com `sqlite3 data/ponto.db .dump > dump.sql` e importe com `turso db shell ponto < dump.sql`.

## Instalar no celular

O app pode ser instalado como PWA e abre direto no painel, em tela cheia.

- **Android (Chrome):** menu ⋮ → **Instalar app** (ou **Adicionar à tela inicial**).
- **iPhone (Safari):** botão Compartilhar → **Adicionar à Tela de Início**. O app instalado tem cookies separados dos do Safari, então peça a senha uma vez dentro dele.

## Regras

- Jornada padrão de 8h por dia útil (segunda a sexta) = 40h por semana. A jornada pode ser alterada em **Configurações**.
- **Bater ponto** registra o horário atual. O tipo (entrada ou saída) vem da última batida do dia.
- **Batida avulsa** registra um horário escolhido. As batidas do dia precisam alternar entrada e saída, começando por entrada.
- Um dia passado com número ímpar de batidas aparece como pendente. Só os pares fechados contam no saldo.
- Um dia útil passado sem batidas conta −8h. Marque feriados, folgas e atestados como **abono** (meta de 0h).
- **Feriados nacionais** são abonados automaticamente. Os de cada ano do banco são importados uma vez da [BrasilAPI](https://brasilapi.com.br/docs#tag/Feriados-Nacionais), incluindo Carnaval e Corpus Christi. Se você trabalha num deles, marque o dia como "Dia normal", e ele não volta. Abonos que você já tinha marcado não são alterados. Feriados municipais e pontes continuam manuais.
- **Abono parcial**: preencha as horas abonadas (HH:MM) antes de escolher o tipo do abono. A meta do dia vira a jornada menos essas horas. Por exemplo, uma consulta de 2h com atestado deixa a meta em 6h. Só vale para dias úteis, e as horas precisam ser menores que a jornada.
- Horas trabalhadas no fim de semana ou em dia abonado contam inteiras como extra.
- O saldo é acumulado desde a data de início do banco (por padrão, a primeira batida). Durante o dia de hoje, só o excedente entra no total. Assim o saldo não fica negativo no meio do expediente.

## Scripts

| Comando          | O que faz                    |
| ---------------- | ---------------------------- |
| `bun dev`        | servidor de desenvolvimento  |
| `bun run test`   | testes (regras, actions e banco) |
| `bun run test:e2e` | build de produção + testes do PWA (precisa do Chrome) |
| `bun run lint`   | Biome (lint + formatação)    |
| `bun run format` | Biome com correções          |
