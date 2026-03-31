# Spec: Quantidade de passageiros obrigatória + simulação em faixa

**Data:** 2026-03-31
**Arquivo principal:** `src/pages/CalculatorPage.tsx`

---

## Objetivo

Tornar a quantidade de passageiros obrigatória no Step 0 e permitir que o usuário ative uma simulação em faixa (de 1 até N pax) para comparação de cenários no resultado.

---

## Terminologia de estado

| Nome no código | Papel |
|---|---|
| `simulationPax` | Quantidade confirmada de passageiros (obrigatória, 1–100) |
| `isExplorationMode` | Toggle da faixa de comparação (`boolean`) |
| `maxPax` | Limite superior da faixa quando `isExplorationMode = true` (1–100) |
| `marginPax` | Pax usado apenas no cálculo do modo margem — já existe, não muda |

---

## Campos no Step 0

### 1. Quantidade de passageiros *(obrigatório)*
- Input numérico, min 1, max 100
- Label: `Quantidade de passageiros *`
- Placeholder: `Ex: 15`
- Hint: "Quantos passageiros você espera neste roteiro?"
- Bloqueia avançar se vazio ou zero
- **Valor inicial: `initialRoute?.simulationPax ?? 0`** — inicia em 0 (campo em branco) para forçar preenchimento

### 2. Toggle "Simular faixa de comparação" *(opcional)*
- Checkbox com label: `Simular faixa de comparação`
- Fica **desabilitado** (`disabled + opacity-50`) enquanto `simulationPax < 1 || simulationPax >= 100`
  (com simulationPax = 100, não há espaço para maxPax > 100)
- Quando ativado → aparece input: `Simular até quantos passageiros? (máx. 100)`
  - `min={Math.max(simulationPax + 1, 2)}`, `max={100}`
  - Clamping no `onChange`:
    ```ts
    const v = Math.min(100, Math.max(simulationPax + 1, parseInt(e.target.value, 10) || simulationPax + 1));
    setMaxPax(v);
    ```
  - **Valor padrão:** 30 na primeira abertura; valor persistido ao reabrir um roteiro salvo
  - Hint: "A tabela mostrará cenários de 1 até este número."
- Label do toggle: texto fixo (não reflete X dinamicamente)

### Remoção do campo de pax do Step 3
**Remover completamente o bloco de input de `simulationPax` do Step 3 UI.** Atualmente existe um campo numérico de pax no Step 3 junto com o preço/margem — esse bloco deve ser removido inteiramente.

---

## Validação

### Step 0 — `canAdvance()`
```ts
routeName.trim().length > 0 && simulationPax >= 1
```

### Step 3 — remover condição de pax
Atualmente:
```ts
if (mode === 'price') return price > 0 && simulationPax > 0;
return marginPct > 0 && marginPax > 0 && simulationPax > 0;
```
Após a mudança:
```ts
if (mode === 'price') return price > 0;
return marginPct > 0 && marginPax > 0;
```
(`marginPax` já existe no código — é o pax usado apenas para o cálculo de margem, linha 99 do arquivo atual.)

---

## Estado (`CalculatorPage.tsx`)

### `simulationPax`
- Inicializador inalterado: `initialRoute?.simulationPax ?? 0`
- `fromDbRow` já retorna fallback `|| 0` para registros antigos — compatível
- Obrigatório via `canAdvance()` no step 0

### `isExplorationMode`
- Linha atual: `const [isExplorationMode] = useState(false)` (sem setter)
- **Mudar para:** `const [isExplorationMode, setIsExplorationMode] = useState(initialRoute?.isExplorationMode ?? false)`

### `maxPax`
- Linha atual: `const [maxPax, setMaxPax] = useState(50)`
- **Mudar para:** `const [maxPax, setMaxPax] = useState(initialRoute?.maxPax ?? 30)`

---

## `buildCurrentRoute()` (`CalculatorPage.tsx`)

Adicionar `isExplorationMode` e `maxPax` ao objeto retornado:
```ts
isExplorationMode,
maxPax,
```

---

## Assinatura de `runSimulation`

```ts
runSimulation(fixedCosts, variables, estimatedPrice, maxPax=50, discounts=0, minPax=1)
```
- Gera linhas para `pax` de 1 a `maxPax`, mas só inclui em `rows` quando `pax >= minPax`
- Não existe parâmetro de "pax destacado" — o destaque é responsabilidade do componente

### Chamadas no `simulation` useMemo:

**Toggle desativado** (`isExplorationMode = false`) — exibe apenas a linha do pax confirmado:
```ts
runSimulation(fixedCosts, varCosts, effectivePrice, simulationPax, 0, simulationPax)
```

**Toggle ativado** (`isExplorationMode = true`) — exibe de 1 até maxPax:
```ts
runSimulation(fixedCosts, varCosts, effectivePrice, maxPax, 0, 1)
```

---

## Impacto no Step 4 — `SimulationResults`

### Novo prop: `simulationPax`
Passar `simulationPax` para o componente `SimulationResults`:
```tsx
<SimulationResults
  simulation={simulation}
  estimatedPrice={effectivePrice}
  isExplorationMode={isExplorationMode}
  breakEvenPax={breakEvenForDisplay}
  simulationPax={simulationPax}   // NOVO
/>
```

### Dentro de `SimulationResults`
- Aceitar `simulationPax: number` nos props
- Na tabela de cenários, na linha onde `row.pax === simulationPax`: aplicar `bg-brand-orange-50 font-extrabold` e ícone `👤` antes do número na coluna de pax
- A linha sempre estará no range:
  - Toggle off: range = [simulationPax, simulationPax] → linha garantida
  - Toggle on: range = [1, maxPax] e maxPax >= simulationPax + 1 → linha garantida

---

## Persistência (`useRoutes.ts`)

### `toDbRow` — adicionar ao `metadata`:
```ts
isExplorationMode: route.isExplorationMode ?? false,
maxPax: route.maxPax ?? 30,
```

### `fromDbRow` — restaurar com fallback para registros legados:
```ts
isExplorationMode: (meta.isExplorationMode as boolean) ?? false,
maxPax: (meta.maxPax as number) ?? 30,
```
(`simulationPax` já tem fallback `|| 0` no `fromDbRow` atual — não muda.)

---

## Tipos (`src/types/index.ts`)

```ts
simulationPax: number;        // era simulationPax?: number — tornar não-opcional
isExplorationMode: boolean;   // novo campo
maxPax: number;               // novo campo
```

---

## Fora do escopo

- Mudanças no Step 1 (custos fixos) e Step 2 (variáveis)
- Lógica interna do pricing engine (`runSimulation`, `findBreakEven`)
- Redesign visual completo do Step 4
