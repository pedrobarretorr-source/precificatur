# Design: Custos Variáveis — UX estilo Card

**Data:** 2026-03-30
**Status:** Aprovado
**Escopo:** Step 2 (Custos Variáveis) do wizard de precificação

---

## Objetivo

Alinhar o visual e o fluxo de adição dos custos variáveis ao padrão já estabelecido pelos custos fixos: cards individuais com emoji, label e valor editável inline. Chips de sugestão passam a adicionar itens diretamente.

---

## Mudanças

### 1. Visual da lista de itens

**Antes:** itens separados por `divide-y`, sem fundo, sem emoji.

**Depois:** cada item é um card `bg-surface-100 rounded-xl px-3 py-2.5` com:

```
[emoji]  [label]              [input editável]  [× remover]
```

- Itens `type: 'percentage'`: input numérico + `%` à direita (comportamento já existente, só o wrapper muda)
- Itens `type: 'brl'`: input numérico editável inline + `/ pax` ou `rateado` à direita (hoje são texto estático — passam a ser editáveis)

### 2. Chips de sugestão — adição direta

`applyVarSuggestion` é substituída por `addVarFromPreset(preset)` que chama `setVarCosts` diretamente, adicionando o item com `brlValue: preset.defaultValue` (ou `percentage: preset.defaultValue`). Não pré-preenche mais o formulário.

### 3. `PresetVariableCost` — novos campos

```ts
export interface PresetVariableCost {
  label: string;
  emoji: string;
  type: 'percentage' | 'brl';
  defaultValue: number;
  perPax?: boolean; // só para type: 'brl'
}
```

`PRESET_VARIABLE_COSTS` atualizado com emoji + type + defaultValue por item.

### 4. `VariableCost` — campo emoji opcional

```ts
export interface VariableCost {
  // ... campos existentes ...
  emoji?: string;
}
```

`DEFAULT_VARIABLE_COSTS` (Administrativo, Comissão, Encargos, Taxas/Cartão) recebe emojis:
- Administrativo → 📊
- Comissão → 🤝
- Encargos → 📋
- Taxas / Cartão → 💳

### 5. Formulário manual — sem mudanças visuais no formulário

O formulário de adição manual permanece igual. Itens adicionados via formulário **não recebem emoji** (campo `emoji` fica `undefined`). O card renderiza sem emoji quando o campo está ausente — sem espaço reservado vazio.

### 6. Comportamento do input R$ inline

- Input numérico com `onChange` imediato (igual ao input de `%` já existente)
- Label `/ pax` ou `rateado` permanece texto estático (view-only) à direita do input
- Sem formatação de moeda no input — valor numérico bruto (igual ao padrão dos outros inputs)
- Sem validação de min/max além do que o browser já impõe para `type="number"`

---

## Emojis dos presets

| Label | Emoji | Type | Default |
|---|---|---|---|
| Ingresso museu | 🎫 | brl | 0 |
| Taxa de visitação | 🎫 | brl | 0 |
| Refeição | 🍽️ | brl | 0 |
| Café da manhã | ☕ | brl | 0 |
| Ingresso show | 🎭 | brl | 0 |
| Hospedagem | 🏨 | brl | 0 |
| Camping | ⛺ | brl | 0 |
| Seguro | 🛡️ | brl | 0 |
| Brinde | 🎁 | brl | 0 |
| Etiqueta de bagagem | 🏷️ | brl | 0 |
| Lanche de bordo | 🥪 | brl | 0 |
| Depreciação equipamento | 🎒 | brl | 0 |
| Passagem aérea | ✈️ | brl | 0 |
| Passagem terrestre | 🚌 | brl | 0 |
| Passagem fluvial | ⛵ | brl | 0 |

---

## Arquivos alterados

1. `src/types/index.ts` — adicionar `emoji?` em `VariableCost`, atualizar `DEFAULT_VARIABLE_COSTS`
2. `src/data/preset-costs.ts` — atualizar `PresetVariableCost` e `PRESET_VARIABLE_COSTS`
3. `src/pages/CalculatorPage.tsx` — atualizar lista de itens (cards), chips (addVarFromPreset), input inline para R$

---

## O que NÃO muda

- Lógica de cálculo (`pricing-engine`)
- Outros steps do wizard
- Tooltips adicionados anteriormente
- Formulário de adição manual
