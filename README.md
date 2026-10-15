# Ponto · Banco de horas

Ponto eletrônico pessoal que mostra quanto você está devendo ou tem de crédito no banco de horas.

Stack: Next.js 16 (App Router, Server Actions), Tailwind v4, shadcn/ui, Bun, Biome e SQLite (better-sqlite3).

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

## Regras

- Jornada padrão de 8h por dia útil (segunda a sexta) = 40h por semana. A jornada pode ser alterada em **Configurações**.
- **Bater ponto** registra o horário atual. O tipo (entrada ou saída) vem da última batida do dia.
- **Batida avulsa** registra um horário escolhido. As batidas do dia precisam alternar entrada e saída, começando por entrada.
- Um dia passado com número ímpar de batidas aparece como pendente. Só os pares fechados contam no saldo.
- Um dia útil passado sem batidas conta −8h. Marque feriados, folgas e atestados como **abono** (meta de 0h).
- Horas trabalhadas no fim de semana ou em dia abonado contam inteiras como extra.
- O saldo é acumulado desde a data de início do banco (por padrão, a primeira batida). Durante o dia de hoje, só o excedente entra no total. Assim o saldo não fica negativo no meio do expediente.

## Scripts

| Comando          | O que faz                    |
| ---------------- | ---------------------------- |
| `bun dev`        | servidor de desenvolvimento  |
| `bun test`       | testes das regras de cálculo |
| `bun run lint`   | Biome (lint + formatação)    |
| `bun run format` | Biome com correções          |
