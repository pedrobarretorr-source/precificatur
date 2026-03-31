# Design: Tooltips Educacionais — Custos Variáveis

**Data:** 2026-03-30
**Status:** Aprovado
**Escopo:** Step 2 (Custos Variáveis) do wizard de precificação

---

## Objetivo

Adicionar conteúdo educacional discreto ao step 2 (Custos Variáveis) do `CalculatorPage`, ajudando usuários a entender os conceitos sem poluir a interface.

---

## Solução: Tooltips em pontos-chave

Ícone `?` pequeno ao lado dos 3 elementos de maior confusão. Clique abre um popover; clique fora ou no mesmo ícone fecha. Apenas um popover aberto por vez.

### Elementos e conteúdo

| Elemento | Texto do tooltip |
|---|---|
| Toggle `% / R$` | "Percentual: incide sobre o preço de venda. Ex: taxa de cartão de 3% = R$3 por cada R$100 cobrado. Valor fixo (R$): custo direto, como um fotógrafo." |
| "Por passageiro?" | "Por passageiro: cada pessoa paga esse valor. Rateado: o custo total é dividido entre todos os passageiros." |
| "Total % sobre o preço" | "Esse percentual sai do seu preço antes do lucro. Se o total for 30%, você fica com apenas 70% de cada venda para cobrir custos fixos e lucro." |

---

## Implementação

### Componente `Tooltip`

Componente React local em `CalculatorPage.tsx`:

```tsx
function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  // Ícone ? que toggling open state
  // Popover posicionado abaixo do ícone
}
```

- Estado local (`useState`) — sem contexto global
- Fecha ao clicar fora (listener `mousedown` no document)
- Sem dependência externa de biblioteca de tooltip
- Estilo: ícone círculo cinza (`w-4 h-4`), popover com `max-w-xs` e `z-50`

### Pontos de inserção em `CalculatorPage.tsx`

1. **Toggle % / R$** — `<Tooltip>` ao lado do toggle (entre o `<Divider>` e os botões `%/R$`), como sibling imediato antes do `<div>` do toggle
2. **"Por passageiro?"** — `<Tooltip>` ao lado do label do toggle
3. **"Total % sobre o preço"** — `<Tooltip>` ao lado do label no `<TotalRow>`

### TotalRow — ajuste necessário

`TotalRow` precisa aceitar um `tooltip?: string` prop opcional para renderizar o `<Tooltip>` inline ao lado do label.

---

## O que NÃO muda

- Lógica de cálculo (`pricing-engine`)
- Estrutura de dados (`VariableCost`, `DEFAULT_VARIABLE_COSTS`)
- Outros steps do wizard
- Componentes além de `CalculatorPage.tsx` e `TotalRow`

---

## Critérios de sucesso

- Tooltips aparecem nos 3 locais corretos
- Apenas um popover aberto por vez
- Fecha ao clicar fora
- Nenhuma mudança visual quando tooltips estão fechados
