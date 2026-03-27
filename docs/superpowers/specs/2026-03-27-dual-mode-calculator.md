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
- Substitui os campos "De" e "Ate" atuais na secao "Faixa de passageiros para simular"
- O modo de precificacao (preco/margem) continua como esta
- No modo "profit", o campo `marginPax` (usado para calcular o preco reverso) permanece separado — ele define o pax para calculo de preco, nao para simulacao
- O novo campo "Quantidade de passageiros" e exclusivo para a simulacao

**Estado: novo state**
- `simulationPax: number` — valor unico digitado pelo usuario (default: 0, sem valor)
- `isExplorationMode: boolean` — false = calculo direto, true = exploracao de cenarios
- `maxPax: number` — limite superior da faixa (usado apenas quando isExplorationMode = true)
- Remove o state `minPax` antigo (substituido por `simulationPax`)

**Ao calcular (Step 4):**
- Modo direto: `runSimulation` recebe `minPax = maxPax = simulationPax` (gera 1 row)
- Exibe card resumo explicativo
- Botao "Comparar cenarios" aparece abaixo do resultado

**Ao clicar "Comparar cenarios":**
- Seta `isExplorationMode = true`
- Volta ao Step 3 com campo "ate" revelado: "De [simulationPax] ate [___]"
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
  - Se break-even nao encontrado (acima de 100): "Nao foi possivel encontrar o ponto de equilibrio ate 100 passageiros."
- **Nota sobre break-even:** Para as observacoes contextuais, o break-even e buscado rodando a engine ate pax=100 (independente do valor digitado). Isso garante que a observacao sempre informa o break-even real, mesmo quando o usuario consulta um pax menor.
- **Botao:** "Comparar cenarios"

**Evolucao futura:** Observacoes geradas por IA (assistente) com analise mais elaborada.

### Cards de Cenarios (modo exploracao)

- **4-5 cards empilhados** verticalmente (mobile-friendly)
- Cenarios selecionados automaticamente:
  - Minimo do range
  - Break-even (se existir no range)
  - Ponto medio
  - Maximo do range
  - (1 ponto intermediario adicional se range > 20 pax)
- Se break-even coincide com min ou max, nao duplicar o card — apenas adicionar badge "Equilibrio" ao card existente
- Se break-even esta fora do range, mencionar em texto mas nao criar card para ele
- Cada card mostra: Pax | Custo total | Receita | Resultado | Margem
- Cores: verde/vermelho conforme lucro/prejuizo
- Card do break-even recebe destaque visual (borda ou badge "Equilibrio")
- **Sem grafico, sem tabela extensa**

## Componentes Impactados

1. **`src/pages/CalculatorPage.tsx`** — Substituir campos de/ate por campo unico, adicionar logica de revelacao do campo "ate", botao "Comparar cenarios"
2. **`src/components/calculator/SimulationResults.tsx`** — Reescrever para suportar dois modos de exibicao: card resumo (direto) vs cards de cenarios (exploracao). Remover grafico e tabela extensa.
3. **`src/lib/pricing-engine.ts`** — Adicionar funcao auxiliar `findBreakEven(fixedCosts, variables, price, discounts): number | null` que busca o break-even ate pax=100 independente do range da simulacao. Usada pelas observacoes contextuais.
4. **`src/types/index.ts`** — Sem alteracao necessaria nos tipos existentes.

## Limpeza

- Remover dependencia do Recharts (nao ha mais grafico)
- Remover preview cards do Step 3 (break-even, custos fixos, margem a 10 pax) — ficam redundantes com o novo card resumo do Step 4

## Fora de escopo

- Integracao com IA para observacoes (sera feito em iteracao futura)
- Alteracoes nos Steps 0-2 do wizard
