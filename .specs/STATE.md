# Project state

## Decisions

| ID | Decision | Rationale | Status | Date |
| --- | --- | --- | --- | --- |
| AD-001 | Mudança de esquema entra como um item novo de `MIGRATIONS` em `src/lib/db.ts`, aplicado num batch junto com `settings.schema_version`. Nunca se edita o `SCHEMA` de uma tabela que já existe. | os bancos em uso (arquivo local e Turso) foram criados com `CREATE TABLE IF NOT EXISTS`, que não altera tabela existente | active | 2026-10-16 |
| AD-002 | Dados importados de fora (ex.: feriados) viram linhas comuns de `day_overrides`, inseridas com `ON CONFLICT DO NOTHING`. O que já foi importado é marcado por chave em `settings`, uma por unidade (`holidays_synced:<ano>`). | o abono manual sempre prevalece, a remoção pelo usuário é definitiva, e chaves separadas não se perdem quando duas requisições gravam ao mesmo tempo | active | 2026-10-16 |
| AD-003 | Regra que muda com o tempo (hoje: a jornada) é guardada por vigência: uma linha por data de início (`valid_from` único), escolhida pelo maior `valid_from` ≤ data, com uma linha `0000-01-01` "desde o início" que não pode ser removida. | mudar a regra não reescreve o saldo de dias que já passaram, e sempre existe uma linha que vale para qualquer data | active | 2026-10-16 |

## Handoff

**Feature**: nenhuma em andamento
**Where**: exportar-csv, alertas-clt, grafico-saldo e jornada-semanal verificados (PASS) em 2026-10-16, de `3311983` a `84a0157`. Nada foi enviado nem publicado: falta `git push` e deploy, e a migração 2 roda no Turso na primeira requisição depois do deploy.
**Next step**: deploy, com aprovação do usuário. Depois, o próximo item do `ROADMAP.md`.
**Blockers**: none
