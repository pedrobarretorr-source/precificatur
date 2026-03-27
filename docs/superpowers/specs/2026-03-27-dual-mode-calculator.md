# Dual-Mode Calculator: Calculo Direto + Exploracao de Cenarios

**Data:** 2026-03-27
**Status:** Aprovado

## Problema

O sistema atual permite calcular de 1 a 100 pax, gerando uma tabela com uma linha por valor de pax + grafico. Isso e excessivo para usuarios que querem apenas o resultado de um numero especifico. A interface tambem e complexa para leigos e nao e otimizada para mobile.

## Solucao

Permitir dois comportamentos no mesmo fluxo, sem adicionar complexidade visual:

1. **Calculo direto** — usuario informa um unico numero de pax, recebe um card resumo explicativo
2. **Exploracao de cenarios** — usuario define uma faixa (de/ate), recebe cards com cenarios-chave

A transicao entre os modos e progressiva: comeca simples, expande se o usuario quiser.

## Design

### Input (Step 3 do wizard)

**Estado inicial:**
- Campo unico: "Quantidade de passageiros" (input numerico, min 1, max 100)
- Substitui os campos "De" e "Ate" atuais
- O modo de precificacao (preco/margem) continua como esta

**Ao calcular (Step 4):**
- `runSimulation` recebe `minPax = maxPax = valorDigitado` (gera 1 row)
- Exibe card resumo explicativo
- Botao "Comparar cenarios" aparece abaixo do resultado

**Ao clicar "Comparar cenarios":**
- Volta ao Step 3 com campo "ate" revelado: "De [valor ja preenchido] ate [___]"
- O valor original fica como minimo (editavel)
- Usuario preenche o maximo e recalcula
- Resultado: cards de cenarios-chave

### Card Resumo Explicativo (calculo direto)

Um unico card contendo:

- **Cabecalho:** "Resultado para X passageiros"
- **Metricas principais:** Custo por pax | Receita total | Resultado (lucro/prejuizo) | Margem %
- **Indicador visual:** cor verde (lucro) ou vermelho (prejuizo)
- **Observacoes contextuais** (frases automaticas geradas pela logica do sistema):
  - Se lucro: "Com X pax voce tem margem de Y%. Seu ponto de equilibrio e Z pax."
  - Se prejuizo: "Com X pax voce tem prejuizo de R$ N. Voce precisa de pelo menos Z pax para cobrir os custos."
  - Se no break-even: "Com X pax voce cobre exatamente seus custos."
- **Botao:** "Comparar cenarios"

**Evolucao futura:** Observacoes geradas por IA (assistente) com analise mais elaborada.

### Cards de Cenarios (modo exploracao)

- **4-5 cards empilhados** verticalmente (mobile-friendly)
- Cenarios selecionados automaticamente:
  - Minimo do range
  - Break-even (se existir no range)
  - Ponto medio
  - Maximo do range
  - (opcionalmente 1 ponto intermediario adicional se o range for grande)
- Cada card mostra: Pax | Custo total | Receita | Resultado | Margem
- Cores: verde/vermelho conforme lucro/prejuizo
- Card do break-even recebe destaque visual (borda ou badge "Equilibrio")
- **Sem grafico, sem tabela extensa**

## Componentes Impactados

1. **`src/pages/CalculatorPage.tsx`** — Substituir campos de/ate por campo unico, adicionar logica de revelacao do campo "ate", botao "Comparar cenarios"
2. **`src/components/calculator/SimulationResults.tsx`** — Reescrever para suportar dois modos de exibicao: card resumo (direto) vs cards de cenarios (exploracao). Remover grafico e tabela extensa.
3. **`src/lib/pricing-engine.ts`** — Sem alteracao na engine. Ja suporta minPax = maxPax.
4. **`src/types/index.ts`** — Sem alteracao necessaria nos tipos existentes.

## Fora de escopo

- Integracao com IA para observacoes (sera feito em iteracao futura)
- Alteracoes nos Steps 0-2 do wizard
- Alteracoes na engine de calculo
