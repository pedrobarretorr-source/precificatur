# Spec: Faixa de passageiros com dois inputs inline (mínimo + máximo)

**Data:** 2026-04-18
**Arquivo principal:** [src/pages/CalculatorPage.tsx](src/pages/CalculatorPage.tsx)
**Substitui (evolução UX):** [2026-03-31-pax-range-simulation-design.md](docs/superpowers/specs/2026-03-31-pax-range-simulation-design.md)

---

## Objetivo

Substituir o fluxo atual de "input único + checkbox + input condicional" no Step 0 por **dois inputs sempre visíveis** — um mínimo obrigatório e um máximo opcional — conectados pela palavra "até". Isso torna a seleção da quantidade de passageiros mais intuitiva, com hierarquia visual clara entre obrigatório/opcional, e comunica a função de comparação de cenários sem precisar de um toggle explícito.

---

## Contexto

Hoje, no Step 0 de [CalculatorPage.tsx](src/pages/CalculatorPage.tsx):

1. Usuário digita `simulationPax` num input numérico.
2. Um checkbox `isExplorationMode` (desabilitado até `simulationPax ≥ 1`) revela um segundo input `maxPax`.

Problemas observados:
- Dois passos mentais (digitar pax → entender checkbox → decidir ativar → digitar max).
- O propósito da comparação fica escondido até o checkbox ser ativado.
- Interação condicional polui a lógica de validação.

---

## Terminologia de estado

| Nome no código | Papel | Mudança |
|---|---|---|
| `simulationPax` | Mínimo / pax base (obrigatório, 1–100) | mantém |
| `maxPax` | Máximo da faixa (opcional, `> simulationPax`, ≤ 100) | mantém como número, `0` = vazio/sem comparação |
| `isExplorationMode` | Toggle da faixa | **removido como estado**; derivado de `maxPax > simulationPax` |

---

## Layout — Step 0

### Estrutura visual

```
Quantidade de passageiros *
┌──────────────┐        ┌──────────────────┐
│    15        │  até   │  comparar até…   │
│  passageiros │        │   (opcional)     │
└──────────────┘        └──────────────────┘
💡 Informe até quantos passageiros para comparar cenários
   lado a lado e ver como o preço e o lucro mudam conforme
   o grupo cresce.
```

### Input 1 — Mínimo (obrigatório)

- Label (shared): `Quantidade de passageiros *`
- Input numérico, `min=1`, `max=100`, placeholder `Ex: 15`.
- Estilo: `.input` padrão, fonte em destaque (ex: `text-2xl font-extrabold text-brand-navy text-center`).
- Sub-rótulo abaixo do número (inside/adjacente): `passageiros`, em `text-xs text-surface-500`.
- Largura fixa ~140px desktop; `flex-1` mobile.

### Conector "até"

- `<span>` textual com `text-sm font-semibold text-surface-500` centralizado verticalmente entre os inputs.
- Em mobile (breakpoint `sm`), vira um rótulo horizontal entre as linhas (não "some").

### Input 2 — Máximo (opcional, estado "ghost" até ativar)

- Input numérico, `min={simulationPax + 1}`, `max=100`, placeholder `comparar até…`.
- **Estado "ghost" (valor vazio)**:
  - `bg-surface-50`, `border-dashed`, `border-surface-300`.
  - Texto do placeholder em `text-surface-400`.
  - Sub-rótulo: `(opcional)` em `text-xs text-surface-400`.
- **Estado "ativo" (usuário começou a digitar)**:
  - Aplica estilos do `.input` padrão (`border-solid`, `border-surface-300`, fundo branco).
  - No foco, `ring-brand-blue/30` + `border-brand-blue` (igual ao mínimo).
- Disabled enquanto `simulationPax < 1` (usa `opacity-50` + `pointer-events-none`; placeholder passa a `preencha o mínimo primeiro`).
- Largura ~160px desktop; `flex-1` mobile.

### Hint explicativo (sempre visível, abaixo dos dois inputs)

Texto: **"Informe até quantos passageiros para comparar cenários lado a lado e ver como o preço e o lucro mudam conforme o grupo cresce."**

Usar classe `.input-hint` (já existe no design system).

### Validação inline

- Se `maxPax > 0 && maxPax <= simulationPax`: mostrar hint vermelho abaixo do input máximo: *"O máximo precisa ser maior que o mínimo"* (`text-xs text-red-500`).
  - Nesse estado, **não** atualiza `maxPax` efetivo para simulação; `isExplorationMode` continua `false` até correção. O botão "Próximo" não bloqueia por isso (só o mínimo é gate de avanço), mas o usuário vê o erro e deve corrigir.
- Se `maxPax > 100`: clamp a 100 (comportamento atual).

---

## Comportamento derivado

```ts
const isExplorationMode = maxPax > simulationPax && simulationPax >= 1;
```

- Todos os usos de `isExplorationMode` que hoje são lidos de estado (`runSimulation`, `SimulationResults`, `buildCurrentRoute`) passam a ler esse `useMemo`/derivação.
- Em `buildCurrentRoute`, persistir `isExplorationMode` derivado (mantém a forma atual do tipo `Route`) e `maxPax` (o valor efetivo, mesmo que `0`).

### Rotas salvas — compatibilidade retroativa

- Ao carregar `initialRoute`:
  - `setSimulationPax(initialRoute.simulationPax ?? 0)` — inalterado.
  - `setMaxPax(initialRoute.isExplorationMode ? initialRoute.maxPax : 0)` — se a rota salva tinha `isExplorationMode=false`, o `maxPax` inicia em 0 (input máximo em estado "ghost"). Se tinha `true`, o `maxPax` herda o valor salvo e o input máximo já aparece preenchido.
- Isso evita mostrar `maxPax=30` (default antigo) como se fosse uma faixa ativa em rotas antigas sem exploração.

---

## Mudanças no código (resumo)

### Remover
- Estado `isExplorationMode` e seu setter.
- Checkbox `<label>Simular faixa de comparação</label>` e bloco condicional que revela `maxPax`.

### Adicionar/alterar
- `useMemo` (ou simples const) para `isExplorationMode` derivado.
- Inicialização de `maxPax`: `initialRoute?.isExplorationMode ? initialRoute.maxPax : 0` (em vez de `?? 30`).
- Novo bloco JSX com os dois inputs lado a lado + "até" + hint + erro inline.
- `canAdvance()` **não muda** (continua exigindo `routeName && simulationPax >= 1`).
- `runSimulation` continua usando `isExplorationMode` (derivado agora).
- `buildCurrentRoute` passa `isExplorationMode` derivado e `maxPax` puro.

### Não mudar
- `SimulationResults`, `pricing-engine`, tipos `Route`, persistência.
- Outros steps do wizard.
- Lógica do step 3 (margem) que usa `simulationPax`.

---

## Design system — classes aplicadas

- Card envolvendo: reutiliza `.card` já presente.
- Inputs: `.input` para ativo; variante local (via `cn`) para ghost: `bg-surface-50 border-dashed border-surface-300 placeholder:text-surface-400`.
- Cores brand: laranja (foco/ação) só em CTAs; inputs usam `brand-blue` no foco (consistente com `.input` base).
- Hint: `.input-hint`; erro: `text-xs text-red-500 mt-1`.
- Responsivo: `flex-col sm:flex-row` com `sm:items-center`; conector "até" vira label em mobile (`sm:mx-2`).

---

## Critérios de aceite

1. Step 0 renderiza dois inputs lado a lado com o conector "até" entre eles, ambos visíveis desde o carregamento da página.
2. Mínimo obrigatório; botão Próximo desabilitado até `simulationPax ≥ 1` (inalterado).
3. Máximo em estado ghost quando vazio; estilo ativa automaticamente ao digitar.
4. Máximo fica visualmente desabilitado enquanto o mínimo não foi preenchido.
5. `isExplorationMode` não existe mais como estado React; é derivação pura.
6. Validação `max ≤ min` exibe hint vermelho inline sem bloquear o avanço (só o mínimo bloqueia).
7. Hint explicativo fixo aparece abaixo dos inputs explicando a função da comparação.
8. Rotas antigas com `isExplorationMode=false` não mostram mais o campo máximo pré-preenchido com 30.
9. Resultado (Step 4) continua funcionando em ambos os modos: pax único (max vazio) e faixa (max preenchido > min).
10. Mobile: inputs empilham com "até" como rótulo entre as linhas; nada quebra em telas ≤ 375px.

---

## Fora de escopo (YAGNI)

- Slider de faixa (range slider) — dois inputs numéricos são mais rápidos para preencher.
- Sugestões rápidas (chips "10 pax", "20 pax") — pode vir depois se o usuário reclamar.
- Mudanças nos steps 1–4.
- Alterações na persistência/tipos `Route`.
- Validação via toast ou modal — inline é suficiente.
