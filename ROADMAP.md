# Roadmap

Ideias de melhoria, ordenadas pelo quanto ajudam no objetivo principal: saber com confiança quanto estou devendo ou tenho de crédito no banco de horas.

## Prioridade alta

- [x] **Feriados nacionais automáticos**
  - Problema: um feriado que eu esquecer de abonar vira −8h sem aviso e distorce o saldo.
  - Ideia: buscar os feriados do ano na [BrasilAPI](https://brasilapi.com.br/docs#tag/Feriados-Nacionais) e abonar automaticamente. Os municipais e as pontes da empresa continuam sendo marcados à mão.
- [x] **Abono parcial**
  - Problema: hoje só dá para abonar o dia inteiro. Uma consulta médica de 2h com atestado ou uma saída liberada pelo gestor vira "horas devendo".
  - Ideia: permitir abonar X horas num dia, o que reduz a meta daquele dia.
- [x] **Instalar no celular (PWA)**
  - Ícone na tela inicial que abre direto no botão "Bater ponto", em tela cheia e sem barra do navegador.
  - Pouco trabalho para o recurso mais usado no dia a dia.

## Prioridade média

- [x] **Exportar CSV**
  - Backup dos dados.
  - Conferência mês a mês com o ponto oficial da empresa quando o saldo não bater.
- [x] **Alertas da CLT no dia**, como avisos simples no painel:
  - intervalo de almoço menor que 1h numa jornada acima de 6h;
  - mais de 2h extras no dia;
  - menos de 11h de descanso entre a saída de um dia e a entrada do seguinte.
- [x] **Gráfico do saldo ao longo do tempo**
  - Mostrar se o banco está crescendo ou caindo nas últimas semanas, o que a tabela não deixa ver.
- [x] **Jornada diferente por dia da semana**
  - Por exemplo, 9h de segunda a quinta e 4h na sexta.

## Depende da regra da empresa

- [x] **Prazo de compensação do banco**
  - Muitas empresas zeram ou pagam o banco a cada 4 meses.
  - Mostrar quanto vence e quando.
- [ ] **Lembrete de saída**
  - Notificação no horário previsto para fechar as 8h.
  - Notificação push no celular dá mais trabalho e precisa de permissão no navegador.

## Pequenos ajustes

- [ ] Permitir editar a observação de uma batida já criada.
- [ ] Mostrar no alerta de pendências do painel os dias úteis passados sem nenhuma batida, como já acontece com os dias de batida ímpar.

## Sugestão de próximo pacote

Os três itens de prioridade alta juntos: eles corrigem os dois jeitos mais prováveis de o saldo ficar errado e deixam o uso diário mais rápido.
