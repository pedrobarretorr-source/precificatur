# Design: Resultado — Análise Detalhada

**Data:** 2026-03-30
**Status:** Aprovado
**Escopo:** Step 4 (Resultado) do wizard — redesign da `SimulationResults` e novo painel expansível

---

## Objetivo

Redesenhar o step de resultado para ser visualmente mais impactante, usar linguagem acessível (sem jargão técnico), e oferecer uma análise detalhada expansível com insights práticos sobre o roteiro.

---

## Terminologia — de técnico para acessível

| Antes (técnico) | Depois (acessível) |
|---|---|
| Ponto de equilíbrio / break-even | Mínimo de pessoas para não ter prejuízo |
| Margem | % de lucro |
| Receita total | Total que vai entrar |
| Custo por pax | Custo por pessoa |
| Resultado | Lucro / Prejuízo |
| Comparar cenários | Ver análise detalhada |

---

## Seção principal (sempre visível)

### Hero
- Valor do lucro ou prejuízo em destaque grande (verde se positivo, vermelho se negativo)
- `% de lucro` logo abaixo, em fonte menor mas em destaque
- Badge de status: "✅ Lucrando", "⚠️ No limite" (break-even), "❌ Prejuízo"

### Grade de métricas secundárias (3 cards)
1. **Custo por pessoa** — quanto custa servir 1 passageiro
2. **Total que vai entrar** — receita total (preço × pax)
3. **Mínimo de pessoas para não ter prejuízo** — break-even com ícone 🎯

---

## Painel "Ver análise detalhada" (expansível)

Toggle: botão "Ver análise detalhada ▼" / "Fechar análise ▲". Expande inline, sem modal.

### Seção 1 — "Quantas pessoas você precisa?"

Barra de progresso visual:
- Fundo cinza representando o máximo = `max(breakEvenPax, pax) × 1.5` arredondado para inteiro
- Se break-even é null: máximo = `pax × 1.5`
- Segmento colorido até o break-even (🔵 azul) — omitido se break-even é null
- Marcador do pax simulado (linha vertical)
- Texto abaixo: *"Com [X] pessoas você começa a lucrar. Você simulou [Y] pessoas."*
- Cor da barra: verde se pax ≥ breakEven, vermelho se pax < breakEven
- Se break-even null: substituir barra por mensagem *"Com os custos e preço atuais, não foi possível encontrar o número mínimo de pessoas. Tente aumentar o preço ou reduzir os custos."*

### Seção 2 — "Para onde vai cada real do seu preço?"

Barra horizontal 100% dividida em segmentos proporcionais ao preço por pax:
- 🔵 **Custos fixos por pessoa** (`totalFixed ÷ pax`) — label + valor em R$
- 🟠 **Custos variáveis por pessoa** (`row.costPerPax - fixedSliceR`) — inclui TODOS os variáveis (% e R$) — label + valor em R$
- 🟢 **Seu lucro por pessoa** (se positivo) OU 🔴 **Prejuízo por pessoa** (se negativo)

Abaixo da barra: legenda com cor + nome + valor em R$ de cada segmento.

**Cálculo dos segmentos (preço por pax = 100%):**
```
fixedSliceR  = totalFixed / pax
varSliceR    = row.costPerPax - fixedSliceR   // captura % e R$ de uma vez
lucroSliceR  = estimatedPrice - fixedSliceR - varSliceR  // pode ser negativo
```
- Se `lucroSliceR >= 0`: barra verde proporcional
- Se `lucroSliceR < 0`: o segmento vermelho ocupa o espaço proporcional ao prejuízo, limitado visualmente a 100% da barra (sem overflow). O valor em R$ do prejuízo por pessoa aparece na legenda abaixo com cor vermelha.

**PriceDistBar renderiza sempre** (não depende do break-even).

### Seção 3 — "O que muda com mais ou menos pessoas?"

Tabela compacta de até 5 linhas representando cenários.

**Quando break-even é conhecido:**
- `max(1, breakEven - 5)` — sem badge (clampado a 1 se breakEven < 5)
- Break-even — linha verde + badge "Mínimo p/ lucrar"
- Pax simulado — linha azul + badge "Sua simulação" (omitir se igual a uma das outras linhas)
- `breakEven + 5`
- `breakEven + 15`

**Quando break-even é null:**
- `max(1, pax - 10)`
- `max(1, pax - 5)`
- Pax simulado — linha azul + badge "Sua simulação"
- `pax + 5`
- `pax + 15`

Geração da lista: coletar todos os pax candidatos num array, converter para `Set` (deduplicar), ordenar por pax crescente, pegar os 5 primeiros. Se pax ≤ 10, os cenários negativos (`pax - 5`, `pax - 10`) são clampados a `max(1, ...)` antes de entrar no Set.

Colunas: **Pessoas** | **Total arrecadado** | **Lucro / Prejuízo** | **% de lucro**

### Seção 4 — "O que isso significa para você?"

3–4 frases geradas dinamicamente com base nos dados calculados. Cada frase prefixada com um ícone.

Frases possíveis (geradas condicionalmente):
- 💰 *"Cada pessoa a mais te rende R$ [lucroMarginal] de lucro."* — sempre exibida (lucroMarginal = preço - costPerPax da última linha; se negativo: *"Cada pessoa a mais ainda gera R$ [X] de prejuízo."*)
- 📊 *"Suas taxas e comissões consomem [varPct]% do que você cobra."* — se `varSliceR / estimatedPrice * 100 > 15` (varSliceR = row.costPerPax - totalFixed/pax)
- 🚀 *"Com [diff] pessoas a mais que o mínimo, seu lucro vai de [X]% para [Y]%."* — se lucrando E breakEven não é null
- ⚠️ *"Você precisa de [diff] pessoas a mais para começar a lucrar."* — se prejuízo E breakEven não é null
- 🎯 *"Você simulou exatamente o mínimo de pessoas. Qualquer desistência gera prejuízo."* — se pax === breakEven (só quando breakEven não é null)
- ❓ *"Com os custos e preço atuais, não foi possível calcular o mínimo de pessoas. Tente aumentar o preço ou reduzir os custos."* — se breakEven é null

---

## Arquitetura

### Componente principal: `SimulationResults.tsx`

Refatorar completamente. Estrutura interna:

```
SimulationResults
├── ResultHero           — lucro/prejuízo + % de lucro + badge status
├── MetricsGrid          — 3 cards (custo/pessoa, total entrada, mínimo pax)
└── DetailPanel          — painel expansível (useState: open/closed)
    ├── PaxProgressBar   — seção 1
    ├── PriceDistBar     — seção 2
    ├── ScenariosTable   — seção 3
    └── InsightsList     — seção 4
```

- Estado `detailOpen: boolean` local em `SimulationResults`
- Todos os sub-componentes são funções locais no mesmo arquivo
- Sem bibliotecas de chart — tudo com Tailwind (divs com width %)

### Props — sem mudanças de interface

`SimulationResults` mantém as mesmas props. A lógica extra (lucroMarginal, segmentos de distribuição, cenários adicionais) é derivada internamente com `useMemo`.

### Cálculos adicionais necessários (derivados das props existentes)

```ts
const row = rows[0]; // pax simulado
// estimatedPrice === row.revenue / row.pax sempre, então:
const lucroMarginal = estimatedPrice - row.costPerPax; // lucro gerado por cada pessoa adicional
const fixedSliceR = simulation.totalFixedCosts / row.pax;
const varSliceR = row.costPerPax - fixedSliceR; // todos os variáveis (% + R$)
const lucroSliceR = estimatedPrice - fixedSliceR - varSliceR; // = row.finalResult / row.pax
```

---

## "Ver análise detalhada" — modo exploração (isExplorationMode)

No modo exploração, o componente mantém os cards de cenários existentes, porém redesenhados com a mesma linguagem acessível. O painel "Ver análise detalhada" não é exibido nesse modo (a análise já está toda visível nos cards).

---

## Botão "Ver análise detalhada"

O botão **não redireciona mais** para o modo exploração. Ele faz toggle do painel inline (`detailOpen`).

- Prop `onCompareScenarios` é **removida** de `SimulationResults`
- O handler correspondente no `CalculatorPage` é removido
- O estado `isExplorationMode` e o modo exploração existente são **mantidos** (ainda acessíveis via step 3), mas o botão de resultado não os aciona mais
- O botão fica dentro de `SimulationResults`, sem prop de callback

---

## Sobreposição entre Seções 1 e 3

Intencional: Seção 1 é visual/gráfica (barra de progresso — impacto emocional rápido). Seção 3 é tabular (números exatos por cenário — análise racional). Públicos diferentes do mesmo usuário em momentos diferentes.

## Comportamento do painel expansível

- Animação: `max-height` com transição CSS `transition-all duration-300` — expansão suave
- Estado inicial: fechado (`detailOpen = false`)
- Mobile: tabela da Seção 3 com `overflow-x-auto` para scroll horizontal

## Empty state

Mantido como está: se `estimatedPrice <= 0`, componente retorna o empty state atual sem renderizar nada mais.

## O que NÃO muda

- Lógica de cálculo em `pricing-engine.ts`
- Tipos em `types/index.ts`
- Outros steps do wizard
- Empty state (preço não definido)
