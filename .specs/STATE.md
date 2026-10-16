# Project state

## Decisions

| ID | Decision | Rationale | Status | Date |
| --- | --- | --- | --- | --- |
| AD-001 | Mudança de esquema entra como um item novo de `MIGRATIONS` em `src/lib/db.ts`, aplicado num batch junto com `settings.schema_version`. Nunca se edita o `SCHEMA` de uma tabela que já existe. | os bancos em uso (arquivo local e Turso) foram criados com `CREATE TABLE IF NOT EXISTS`, que não altera tabela existente | active | 2026-10-16 |
| AD-002 | Dados importados de fora (ex.: feriados) viram linhas comuns de `day_overrides`, inseridas com `ON CONFLICT DO NOTHING`. O que já foi importado é marcado por chave em `settings`, uma por unidade (`holidays_synced:<ano>`). | o abono manual sempre prevalece, a remoção pelo usuário é definitiva, e chaves separadas não se perdem quando duas requisições gravam ao mesmo tempo | active | 2026-10-16 |

## Handoff

**Feature**: pwa
**Where**: abono-parcial e feriados-nacionais commitados; pwa com plano aprovado, sem checks
**Next step**: escrever `.specs/features/pwa/checks.md`
**Blockers**: none
