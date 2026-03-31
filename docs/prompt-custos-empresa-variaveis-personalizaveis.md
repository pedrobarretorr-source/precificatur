# Prompt: Implementar 3 Camadas de Custo + Custos Variáveis Simplificados e Personalizáveis

## Contexto do projeto

Estou construindo a **PrecificaTur**, uma plataforma de precificação de roteiros turísticos em React + TypeScript + Tailwind CSS + Vite. O público-alvo são guias de turismo, agências de turismo receptivo e organizadores de roteiros — gente que precisa de simplicidade, não de planilha complexa.

A calculadora atual trabalha com **2 camadas de custo**:
- **Custos fixos do roteiro**: transfer, hospedagem, alimentação, guia local, ingressos (diluídos por passageiro)
- **Custos variáveis**: percentuais fixos hardcoded (administrativo 10%, comissão 10%, encargos 12.5%, taxas de cartão 4%)

### O que precisa mudar

**1) Adicionar camada de custos fixos da empresa** — despesas mensais que existem independente de qualquer roteiro (folha, aluguel, contador, etc), rateadas entre os roteiros do mês.

**2) Reformular os custos variáveis** — o sistema atual é rígido (4 itens fixos). O novo deve ser totalmente **personalizável**: o usuário adiciona e remove itens livremente. Existem dois tipos de custo variável:
- **Percentuais (% sobre o preço)**: impostos sobre faturamento (Simples/ISS), taxa de cartão, comissão de vendedor, agenciador, plataforma de venda online
- **Por passageiro (R$ fixo por pax)**: seguro viagem, kit lanche, material impresso, brinde

**3) Agenciador como toggle especial** — quando a venda é via intermediário, adiciona 10% automaticamente.

---

## Nova arquitetura de custos — 3 camadas

```
┌─────────────────────────────────────────────────────────┐
│  CAMADA 1: Custos fixos da empresa (rateio mensal)      │
│  Folha, aluguel, contador, impostos fixos, marketing... │
│  → Configurado UMA VEZ no perfil                        │
│  → Rateio = total mensal ÷ qtd roteiros/mês             │
└────────────────────────┬────────────────────────────────┘
                         │ rateio por roteiro
┌────────────────────────▼────────────────────────────────┐
│  CAMADA 2: Custos fixos do roteiro                      │
│  Transfer, hospedagem, alimentação, guia, ingressos...  │
│  → Específico de cada operação                          │
│  → Diluído pela quantidade de passageiros               │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│  CAMADA 3: Custos variáveis (só existem se vendeu)      │
│                                                         │
│  Tipo A — % sobre preço:                                │
│    Imposto faturamento, taxa cartão, comissão vendedor,  │
│    agenciador (toggle S/N), plataforma online...        │
│                                                         │
│  Tipo B — R$ por passageiro:                            │
│    Seguro viagem, kit alimentação, material, brinde...  │
└─────────────────────────────────────────────────────────┘

FÓRMULA FINAL:
Custo por pax = ((rateio empresa + fixo roteiro) ÷ qtd pax)
              + soma dos variáveis por pax
              + (preço × soma dos % variáveis)
```

---

## O que precisa ser implementado

### 1. Novos tipos em `src/types/index.ts`

Substituir o sistema atual de `VariableCost` (que é só percentual) por um sistema unificado e personalizável:

```typescript
// ── Custos fixos da empresa (rateio operacional) ──
export interface CompanyOverheadItem {
  id: string;
  label: string;
  value: number; // valor mensal em R$
  category: OverheadCategory;
}

export type OverheadCategory =
  | 'folha_pagamento'
  | 'aluguel'
  | 'impostos'
  | 'contador'
  | 'internet_telefone'
  | 'marketing'
  | 'veiculo'
  | 'software'
  | 'outro';

export const OVERHEAD_CATEGORY_LABELS: Record<OverheadCategory, string> = {
  folha_pagamento: 'Folha de pagamento',
  aluguel: 'Aluguel do ponto',
  impostos: 'Impostos fixos',
  contador: 'Contador',
  internet_telefone: 'Internet / Telefone',
  marketing: 'Marketing mensal',
  veiculo: 'Manutenção de veículo',
  software: 'Software / Sistemas',
  outro: 'Outro',
};

export interface CompanyOverheadConfig {
  items: CompanyOverheadItem[];
  estimatedRoutesPerMonth: number;
}

// ── Custos variáveis (NOVO — unificado e personalizável) ──
export type VariableCostType = 'percentage' | 'per_pax';

export interface VariableCostItem {
  id: string;
  label: string;
  type: VariableCostType;
  value: number;         // se percentage: 0-100 (ex: 6 = 6%). Se per_pax: valor em R$ (ex: 15.00)
  isSystemItem: boolean; // true = agenciador (controlado por toggle, não editável/removível pelo usuário)
}

// Itens sugeridos que aparecem pré-preenchidos na primeira vez (todos editáveis e removíveis)
export const DEFAULT_VARIABLE_COSTS: VariableCostItem[] = [
  { id: 'imposto_faturamento', label: 'Imposto s/ faturamento (Simples/ISS)', type: 'percentage', value: 6, isSystemItem: false },
  { id: 'taxa_cartao', label: 'Taxa de cartão', type: 'percentage', value: 4, isSystemItem: false },
];

// Item do agenciador — injetado automaticamente quando toggle está ativo
export const AGENT_COST_ITEM: VariableCostItem = {
  id: 'agenciador',
  label: 'Agenciador / Intermediário',
  type: 'percentage',
  value: 10,
  isSystemItem: true,
};
```

Remover o antigo `VariableCost` interface e `DEFAULT_VARIABLE_COSTS` com os 4 itens hardcoded.

Adicionar na interface `Route`:
```typescript
hasAgent: boolean;
```

### 2. Atualizar o pricing engine (`src/lib/pricing-engine.ts`)

Substituir as funções de cálculo de variáveis para suportar os dois tipos:

```typescript
import type { CostItem, VariableCostItem, CompanyOverheadConfig, SimulationRow, SimulationSummary } from '@/types';
import { AGENT_COST_ITEM } from '@/types';

/** Calcula o rateio mensal da empresa por roteiro */
export function calcOverheadPerRoute(config: CompanyOverheadConfig): number {
  if (config.estimatedRoutesPerMonth <= 0) return 0;
  const totalMonthly = config.items.reduce((sum, item) => sum + item.value, 0);
  return totalMonthly / config.estimatedRoutesPerMonth;
}

/** Soma todos os custos fixos reais (rateio empresa + fixos do roteiro) */
export function calcTotalRealFixedCosts(
  routeFixedCosts: CostItem[],
  overheadPerRoute: number
): number {
  const routeFixed = routeFixedCosts.reduce((sum, item) => sum + item.value, 0);
  return routeFixed + overheadPerRoute;
}

/** Monta a lista efetiva de variáveis (inclui agenciador se hasAgent) */
export function getEffectiveVariables(
  userVariables: VariableCostItem[],
  hasAgent: boolean
): VariableCostItem[] {
  const filtered = userVariables.filter(v => !v.isSystemItem);
  if (hasAgent) {
    return [...filtered, AGENT_COST_ITEM];
  }
  return filtered;
}

/** Soma dos percentuais variáveis */
export function calcTotalVariablePercent(variables: VariableCostItem[]): number {
  return variables
    .filter(v => v.type === 'percentage')
    .reduce((sum, v) => sum + v.value, 0);
}

/** Soma dos custos variáveis por passageiro (R$ fixo por pax) */
export function calcTotalVariablePerPax(variables: VariableCostItem[]): number {
  return variables
    .filter(v => v.type === 'per_pax')
    .reduce((sum, v) => sum + v.value, 0);
}

/** Custo por passageiro para uma quantidade específica */
export function calcCostPerPax(
  totalFixed: number,
  variablePercentAmount: number,
  variablePerPax: number,
  pax: number
): number {
  if (pax <= 0) return 0;
  return (totalFixed / pax) + variablePerPax + variablePercentAmount;
}

/** Gera uma linha de simulação */
export function calcSimulationRow(
  pax: number,
  totalFixed: number,
  variables: VariableCostItem[],
  estimatedPrice: number,
  discounts: number = 0
): SimulationRow {
  const totalPercent = calcTotalVariablePercent(variables);
  const variablePercentAmount = estimatedPrice * (totalPercent / 100);
  const variablePerPax = calcTotalVariablePerPax(variables);
  const costPerPax = calcCostPerPax(totalFixed, variablePercentAmount, variablePerPax, pax);
  const totalCost = costPerPax * pax;
  const revenue = estimatedPrice * pax;
  const partialResult = revenue - totalCost;
  const finalResult = partialResult - discounts;
  const margin = revenue > 0 ? (finalResult / revenue) * 100 : 0;

  return { pax, costPerPax, totalCost, estimatedPrice, revenue, partialResult, discounts, finalResult, margin };
}

/** Simulação completa */
export function runSimulation(
  routeFixedCosts: CostItem[],
  overheadPerRoute: number,
  variables: VariableCostItem[],
  estimatedPrice: number,
  maxPax: number = 50,
  discounts: number = 0
): SimulationSummary {
  const totalFixed = calcTotalRealFixedCosts(routeFixedCosts, overheadPerRoute);
  const totalVariablePercent = calcTotalVariablePercent(variables);
  const rows: SimulationRow[] = [];
  let breakEvenPax: number | null = null;

  for (let pax = 1; pax <= maxPax; pax++) {
    const row = calcSimulationRow(pax, totalFixed, variables, estimatedPrice, discounts);
    rows.push(row);
    if (breakEvenPax === null && row.finalResult >= 0) breakEvenPax = pax;
  }

  return { breakEvenPax, rows, totalFixedCosts: totalFixed, totalVariableCostsPercent: totalVariablePercent };
}

/** Precificação reversa: dado lucro desejado e pax, encontra o preço */
export function calcReversePrice(
  desiredProfit: number,
  pax: number,
  totalFixed: number,
  variables: VariableCostItem[],
  discounts: number = 0
): number {
  if (pax <= 0) return 0;
  const totalPercent = calcTotalVariablePercent(variables);
  const variablePerPax = calcTotalVariablePerPax(variables);
  // preço*pax*(1 - %var/100) - totalFixed - variablePerPax*pax - discounts = desiredProfit
  const factor = pax * (1 - totalPercent / 100);
  if (factor <= 0) return 0;
  return (desiredProfit + totalFixed + (variablePerPax * pax) + discounts) / factor;
}
```

### 3. Atualizar o hook (`src/hooks/usePricingCalculator.ts`)

Estado novo:

```typescript
// Overhead da empresa
const [companyOverhead, setCompanyOverhead] = useState<CompanyOverheadConfig>({
  items: [],
  estimatedRoutesPerMonth: 10,
});

// Variáveis — agora personalizáveis
const [variableCosts, setVariableCosts] = useState<VariableCostItem[]>(DEFAULT_VARIABLE_COSTS);

// Agenciador
const [hasAgent, setHasAgent] = useState(false);
```

Funções CRUD para overhead:
```typescript
addOverheadItem, removeOverheadItem, updateOverheadItem, setEstimatedRoutesPerMonth
```

Funções CRUD para variáveis:
```typescript
addVariableCost(item: Omit<VariableCostItem, 'id' | 'isSystemItem'>)  // sempre isSystemItem: false
removeVariableCost(id: string)  // não permitir remover se isSystemItem === true
updateVariableCost(id: string, updates: Partial<VariableCostItem>)  // não permitir editar se isSystemItem === true
```

Computados:
```typescript
const overheadPerRoute = useMemo(() => calcOverheadPerRoute(companyOverhead), [companyOverhead]);
const effectiveVariables = useMemo(() => getEffectiveVariables(variableCosts, hasAgent), [variableCosts, hasAgent]);

const simulation = useMemo(
  () => runSimulation(fixedCosts, overheadPerRoute, effectiveVariables, estimatedPrice, maxPax, discounts),
  [fixedCosts, overheadPerRoute, effectiveVariables, estimatedPrice, maxPax, discounts]
);
```

### 4. Novo componente: `src/components/calculator/CompanyOverheadForm.tsx`

Card "Custos fixos da empresa" com:
- Input "Quantos roteiros você faz por mês em média?" (padrão: 10)
- Lista de items com ícone + label editável + valor + botão remover
- Form para adicionar (descrição + categoria + valor mensal)
- Rodapé: Total mensal + **Rateio por roteiro: R$ X** (destacado em brand-navy bold)
- Dica educativa: "Esses custos existem todo mês, independente de ter roteiros. Incluí-los garante que seu preço cobre toda a operação."
- Mini slider de sensibilidade: "E se fizer menos roteiros?" mostrando como o rateio muda

Ícones por categoria:
```typescript
const OVERHEAD_ICONS: Record<OverheadCategory, string> = {
  folha_pagamento: '👥', aluguel: '🏢', impostos: '📋', contador: '🧮',
  internet_telefone: '📡', marketing: '📣', veiculo: '🚗', software: '💻', outro: '📦',
};
```

### 5. Reformular o `VariableCostsForm.tsx`

Substituir completamente o componente atual. O novo deve ser:

**Estrutura do card:**

```
┌─ Custos variáveis ──────────────────────────────────────┐
│                                                         │
│  [Toggle] Venda via agenciador? ──────── Sim/Não        │
│  Adiciona 10% sobre o preço como comissão               │
│                                                         │
│  ── Percentuais (% sobre preço) ──────────────────      │
│  Imposto s/ faturamento (Simples)    [  6  ] %  [🗑]   │
│  Taxa de cartão                      [  4  ] %  [🗑]   │
│  ✦ Agenciador                        [ 10  ] %  (fixo)  │  ← só aparece se toggle ON, não editável
│  + Adicionar percentual                                  │
│                                                         │
│  ── Por passageiro (R$ por pax) ──────────────────      │
│  Seguro viagem                       [ 15.00] R$ [🗑]   │
│  Kit lanche                          [  8.00] R$ [🗑]   │
│  + Adicionar custo por pax                               │
│                                                         │
│  Resumo: 20% sobre preço + R$ 23,00 por pax             │
└─────────────────────────────────────────────────────────┘
```

**Regras de UX:**
- O usuário pode adicionar quantos itens quiser em cada seção
- Para adicionar, basta preencher nome + valor e clicar no botão ou pressionar Enter
- Ao adicionar, o tipo (percentage ou per_pax) é determinado pela seção onde clicou em "+ Adicionar"
- Itens com `isSystemItem: true` (agenciador) têm visual diferenciado (badge laranja, sem botão de remover/editar)
- O toggle de agenciador fica **no topo** do card, visualmente separado — é a primeira coisa que o usuário vê
- O resumo no rodapé mostra: soma dos %, soma dos R$/pax, e se agenciador está ativo

**Props do componente:**
```typescript
interface VariableCostsFormProps {
  costs: VariableCostItem[];
  hasAgent: boolean;
  onAdd: (item: Omit<VariableCostItem, 'id' | 'isSystemItem'>) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<VariableCostItem>) => void;
  onToggleAgent: (value: boolean) => void;
}
```

### 6. Atualizar `CalculatorPage.tsx`

Layout:
```
1. Dados do roteiro (nome, preço, max pax) — row de inputs
2. Custos fixos da empresa (CompanyOverheadForm) — full width, colapsável
3. Grid 2 colunas:
   - Custos fixos do roteiro (FixedCostsForm)
   - Custos variáveis (VariableCostsForm — novo)
4. Simulação (SimulationResults)
```

O CompanyOverheadForm deve ser **colapsável** (expandido por padrão na primeira vez, recolhido depois). Usar um Chevron que mostra/esconde o conteúdo. Quando recolhido, mostrar em uma linha: "Rateio operacional: R$ 400/roteiro (R$ 8.000/mês ÷ 20 roteiros)".

Atualizar o tip de precificação reversa para incluir overhead:
```
Seus custos fixos somam R$ X (R$ Y rateio operacional + R$ Z do roteiro).
Custos variáveis: W% sobre preço + R$ K por pax.
Para lucrar R$ 500 com 10 pax, cobre pelo menos R$ N por pessoa.
```

### 7. Atualizar `SimulationResults.tsx`

- Card de custos fixos: mostrar decomposição "Rateio empresa: R$ X + Roteiro: R$ Y = Total: R$ Z"
- Se hasAgent, badge "Via agenciador (+10%)" no topo dos resultados
- Alerta educativo se overhead > 30% do custo total: "O rateio da empresa representa X% do custo. Aumentar o volume de roteiros reduz esse peso."
- Na tabela de cenários, manter tudo como está — a fórmula já incorpora os novos custos automaticamente

---

## Arquivos que precisam ser modificados

1. `src/types/index.ts` — novo sistema de tipos (CompanyOverhead + VariableCostItem unificado)
2. `src/lib/pricing-engine.ts` — nova fórmula com 3 camadas + dois tipos de variável
3. `src/hooks/usePricingCalculator.ts` — novo state + CRUD de overhead e variáveis + agenciador
4. `src/components/calculator/VariableCostsForm.tsx` — REESCREVER completamente (novo layout com seções % e R$/pax + toggle agenciador)
5. `src/components/calculator/SimulationResults.tsx` — decomposição de custos + badge agenciador
6. `src/pages/CalculatorPage.tsx` — adicionar CompanyOverheadForm + novo layout + props atualizadas

## Arquivos que precisam ser criados

1. `src/components/calculator/CompanyOverheadForm.tsx`

---

## Design system (Tailwind)

Cores da marca configuradas no `tailwind.config.js`:
- `brand-navy` (#203478) — cor principal, títulos, sidebar
- `brand-blue` (#557ABC) — elementos secundários
- `brand-orange` (#EC6907) — CTAs, destaques, botões primários
- `brand-tangerine` (#F28B32) — apoio
- `brand-gold` (#FEC82F) — alertas, dicas

Classes utilitárias em `globals.css`: `card`, `card-hover`, `btn-primary`, `btn-secondary`, `btn-outline`, `btn-ghost`, `btn-sm`, `btn-lg`, `input`, `input-label`, `input-hint`, `badge-success`, `badge-warning`, `badge-danger`, `badge-info`, `gradient-brand`, `gradient-accent`.

Fonte: **Nunito** (Google Fonts). Ícones: **lucide-react**. Gráficos: **recharts**.

Padrão visual: cards `rounded-2xl`, animações `animate-fade-in` e `animate-slide-up`, espaçamento generoso, textos educativos em caixas com borda lateral colorida.

---

## Regras importantes

- **Simplicidade acima de tudo**: o público são guias de turismo, não contadores. Cada campo deve ter um label claro, um placeholder com exemplo, e uma dica quando necessário
- **Personalizável**: o usuário adiciona e remove variáveis livremente. Não existem campos obrigatórios nos variáveis — se a pessoa não tem custo de cartão, ela remove
- **Itens sugeridos como ponto de partida**: na primeira vez, os DEFAULT_VARIABLE_COSTS aparecem pré-preenchidos. O usuário pode remover qualquer um e adicionar os seus
- **Agenciador é especial**: controlado por toggle, não por formulário. Quando ativo, aparece na lista com visual diferenciado e não pode ser editado/removido (só desligado pelo toggle)
- **O overhead é do perfil**: configurado uma vez, aplicado a todos os roteiros. Futuramente persistido via Supabase
- **Variáveis são por roteiro**: cada roteiro pode ter variáveis diferentes (um tem seguro viagem, outro não)
- **Português do Brasil** em todos os textos
- **TypeScript strict**, componentes funcionais com hooks, sem classes
- **Manter** toda a lógica de cálculo existente — as mudanças são aditivas
