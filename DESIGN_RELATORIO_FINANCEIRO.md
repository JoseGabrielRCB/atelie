# Design do Relatório Financeiro — Ateliê (handoff de implementação)

> Especificação do relatório financeiro do painel admin. Evoluir os relatórios de **vendas** que já
> existem para um relatório **financeiro** completo (resultado + margem + caixa). PT-BR. A fonte da verdade
> de qualquer cálculo é o **backend**.
>
> ⚠️ **Ajustes acordados com o dono (têm precedência sobre o texto abaixo)** — ver também o prompt:
> 1. **`em_revisao` NÃO é dedução de "devoluções" na DRE.** Receita bruta = só pedidos `pago`; `em_revisao`
>    não é receita reconhecida. Exibir como **linha informativa/alerta** ("Pedidos em revisão — a estornar"),
>    não como dedução da receita.
> 2. **Custo (Fase 2): usar SNAPSHOT no `ItemPedido`** (congelar o custo na venda, como `preco_unit`),
>    para o CMV histórico não mudar quando o custo da variação for editado.
> 3. **Taxas do Mercado Pago** entram como Despesa "Taxa de pagamento" (Fase 3) — sem isso a margem é parcial.
> 4. **Taxa de recompra:** fixar a definição (lifetime) para não enganar — ver §4.

---

## 1. Contexto técnico (o que já existe)
**Stack:** Python 3.13 / Django 5.2 / DRF. Frontend React + Vite (admin CSR). Pagamento Mercado Pago. App `catalogo`.
**Arquivos:** `catalogo/models.py`, `catalogo/relatorios.py`, `catalogo/views.py` (`Relatorio*View`),
`catalogo/urls.py` (`/api/relatorios/...`), `catalogo/permissions.py` (`PodeFinanceiro`),
`catalogo/tests/test_relatorios.py` e `test_auditoria_financeira.py`.

**Relatórios atuais** (gate `PodeFinanceiro`, só `Pedido.status=="pago"`, export `?formato=csv|pdf`):
- `vendas_por_periodo(de, ate, granularidade)` → `GET /api/relatorios/vendas-por-periodo/`
- `produtos_mais_vendidos(de, ate, top)` → `GET /api/relatorios/produtos-mais-vendidos/`
- `resumo_do_mes(mes)` → `GET /api/relatorios/resumo-do-mes/`

**Convenções (manter):** dinheiro em `Decimal` (2 casas, `ROUND_HALF_UP`); fuso de `settings.TIME_ZONE`
(`Trunc*(tzinfo=...)`); export CSV (`;`+BOM) e PDF (`reportlab`, import tardio); relatórios agregados
(nunca nome/contato/CPF); datas `AAAA-MM-DD`; erro `400` PT-BR.

## 2. Modelos
### 2.1 Usar sem alterar schema
`Pedido` (`total`, `desconto`, `status`, `cliente`, `cupom`, `criado_em`, `codigo`); `ItemPedido`
(`variacao` PROTECT, `quantidade`, `preco_unit` snapshot); `Variacao` (`peca`, `tamanho`, `cor`, `estoque`);
`Peca` (`nome`, `preco`, `categoria`); `Cliente` (`usuario`, `nome`, `criado_em`); `Promocao` (`nome`, `codigo`, `usos`).
### 2.2 Campos novos (faseado — §6)
**Fase 2 — custo:** `Variacao.custo` (Decimal 10,2, null/blank). **+ snapshot `ItemPedido.custo_unit`**
(congelado na venda — ajuste acordado). **Fase 3 — `Despesa`** (categoria, descrição, valor, data de competência).

## 3. Layout (uma página: Admin › Financeiro › Relatório), 4 blocos
- **A — Filtros:** `de`/`ate` + atalhos (Este mês, Mês passado, Últimos 30/90 dias, Este ano);
  granularidade Dia/Semana/Mês; Exportar CSV/PDF. Padrão: últimos 30 dias, "dia".
- **B — KPIs:** cartões com valor + **variação % vs. período anterior** (↑/↓): Faturamento, Nº vendas,
  Ticket médio, Descontos, Taxa de recompra (Fase 1); Lucro bruto / margem % (Fase 2).
- **C — DRE simplificada (tabela):**
  ```
  Receita bruta (vendas pagas)            [Fase 1]
  (–) Descontos concedidos                [Fase 1]
  = Receita líquida
  (–) CMV                                 [Fase 2] ⚠️
  = Lucro bruto            ( margem __% )  [Fase 2] ⚠️
  (–) Despesas operacionais (por categ.)  [Fase 3] ⚠️
  = Resultado operacional                 [Fase 3] ⚠️

  (informativo) Pedidos em revisão — a estornar   [Fase 1]   ← NÃO entra como dedução da receita
  ```
- **D — Detalhamento:** (1) Vendas por período (gráfico, fonte `vendas_por_periodo`); (2) Produtos mais
  vendidos (+ coluna margem na Fase 2); (3) Cupons (fonte `resumo_do_mes`); (4) Clientes/recompra (top clientes).

## 4. API — `GET /api/relatorios/financeiro/`
Consolida Blocos B e C. Params: `de`, `ate`, `granularidade`, `formato` (json|csv|pdf). Gate `PodeFinanceiro`.
JSON com `de`/`ate`, `comparativo` (janela anterior de mesma duração), `resumo` (cada KPI = `{valor,
variacao_pct, disponivel?}`) e `dre` (lista de `{linha, valor, destaque?, disponivel?}`).
**Regras:** período anterior = janela imediatamente anterior de mesma duração; `variacao_pct=(atual−ant)/ant×100`,
`null` se ant=0; receita = Σ `Pedido.total` pagos no intervalo; **CMV** = Σ(`custo_unit`×`quantidade`) [Fase 2];
**taxa de recompra** = % de clientes (lifetime) com ≥2 pedidos pagos — **fixar a definição e documentá-la**;
**pedidos em revisão** = Σ `total` de `em_revisao` no intervalo, exibido como **linha informativa** (não dedução);
campos de fases futuras → `"disponivel": false`, `valor: null` (não quebrar). Erros `400`/`401`/`403` PT-BR.
> `vendas-por-periodo`, `produtos-mais-vendidos`, `resumo-do-mes` continuam e alimentam o Bloco D.

## 5. Exportação
Reaproveitar `exportar(formato, nome, titulo, subtitulo, cabecalhos, linhas)`. PDF do financeiro: título +
período + KPIs + DRE + (opcional) ranking. Estética atual (cabeçalho `#7e4e2e`, zebra, Helvetica).

## 6. Fases
**Fase 1 (sem migration):** endpoint `/financeiro/` (resumo + DRE parcial), comparativo + `variacao_pct`,
taxa de recompra, linha informativa de `em_revisao`, bloco clientes/recompra, testes (comparativo, recompra,
divisão por zero, gate). **Fase 2 (margem):** `Variacao.custo` + `ItemPedido.custo_unit` (snapshot), CMV/lucro/
margem, coluna de margem em "mais vendidos", UI de custo na variação. **Fase 3 (DRE completa):** `Despesa` + CRUD
(gate `PodeFinanceiro`), despesas por categoria → resultado operacional; (opcional) regime de caixa via liquidação do MP.

## 7. Aceite
Totais batem (estilo `test_auditoria_financeira.py`); dinheiro `Decimal` 2 casas `ROUND_HALF_UP`, nada no front;
anônimo `401`, funcionário sem `acesso_financeiro` `403`; sem dado pessoal; fuso de `settings`; `de>ate` → `400`;
fases futuras não quebram (`disponivel:false`); CSV abre no Excel PT-BR; PDF sem dependência de SO.

## 8. Glossário (para o dono)
Faturamento/Receita bruta; CMV (custo do que foi vendido); Lucro bruto (faturamento−CMV); Margem bruta %
(lucro bruto÷faturamento); DRE (da receita ao lucro); Ticket médio; Taxa de recompra (% que compra >1×).
Referência moda/vestuário: margem bruta saudável **50–62%**.
