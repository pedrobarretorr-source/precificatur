# AI Assistant Page — Design Spec

## Overview

A chat-based AI assistant page for PrecificaTur where users can ask questions about the platform, pricing concepts, and the tourism market. This is a **frontend-only** implementation with mockable data — no backend integration yet.

**File:** `src/pages/AiAssistantPage.tsx` (single new file, no changes to existing code)

**Routing:** Replace the existing `PlaceholderPage` for `ai-assistant` in `App.tsx`.

## Personality

Friendly and didactic — like a patient teacher explaining concepts in simple language. The avatar (`/AVATAR-TESTE.png`) serves as the visual identity of the assistant.

## Layout

Three vertical zones inside a full-height flex container (`h-full flex flex-col`):

### 1. Header (fixed top)

- Class `card`, white background
- Avatar image 64px (rounded-full) on the left
- Title: "Assistente PrecificaTur" — `text-lg font-extrabold text-brand-navy`
- Description: "Tire dúvidas sobre a plataforma, precificação e o mercado turístico." — `text-sm text-surface-500`

### 2. Chat Area (scrollable middle, `flex-1 overflow-y-auto`)

**Empty state:** suggestion chips centered in the middle.

**With messages:** chronological list, auto-scrolls to bottom on new message.

**Message bubbles:**

| Sender | Alignment | Background | Border | Corner Style |
|--------|-----------|------------|--------|--------------|
| User | Right | `brand-orange-50` | `brand-orange-100` | `rounded-2xl rounded-tr-sm` |
| Assistant | Left (with 36px avatar) | `brand-navy-50` | `brand-navy-100` | `rounded-2xl rounded-tl-sm` |

- Message text: `text-sm`, `text-surface-800`
- Assistant name: `text-xs font-bold text-brand-navy` above bubble
- Timestamps: `text-[10px] text-surface-400`

### 3. Input Bar (fixed bottom)

- Separated by `border-t border-surface-200`, padding `p-4`
- Uses existing `input` class for the text field
- Circular send button: `bg-brand-orange`, white `Send` icon (Lucide), to the right
- Submit on Enter key or click

## Message Type

```ts
interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}
```

## Suggestion Chips

Six chips shown when chat is empty, disappear after first interaction:

| Chip Text | Category |
|-----------|----------|
| "Como funciona a calculadora?" | Plataforma |
| "O que são custos fixos e variáveis?" | Precificação |
| "Como definir meu preço de venda?" | Precificação |
| "Quando é alta temporada em Roraima?" | Turismo |
| "Como montar um roteiro atrativo?" | Turismo |
| "O que é ponto de equilíbrio?" | Precificação |

**Style:** `bg-white border border-surface-300 text-surface-700 rounded-full px-4 py-2 text-sm`
**Hover:** `border-brand-orange text-brand-orange`
**Layout:** `flex flex-wrap gap-2 justify-center`

## Mocked Responses

Keyed by chip text. When user types a free-text message that doesn't match a chip, return a generic fallback: "Essa é uma ótima pergunta! Em breve terei acesso ao banco de dados completo para te ajudar melhor. Por enquanto, experimente as sugestões acima."

### Response Map

1. **"Como funciona a calculadora?"**
   "A calculadora funciona em 5 etapas: primeiro você dá um nome ao roteiro, depois adiciona os custos fixos (van, hotel, guia...), define os percentuais variáveis, escolhe o preço ou a margem desejada, e no final vê a simulação completa com gráfico e tabela."

2. **"O que são custos fixos e variáveis?"**
   "Custos fixos são os que você paga independente de quantos passageiros vão — como a van ou o guia. Já os variáveis dependem do preço de venda: taxas de cartão, comissões. Separar os dois é essencial para saber seu preço mínimo."

3. **"Como definir meu preço de venda?"**
   "Você tem duas opções na calculadora: definir o preço diretamente ou informar a margem de lucro desejada. Na segunda opção, a plataforma calcula o preço ideal para a quantidade de passageiros que você espera."

4. **"Quando é alta temporada em Roraima?"**
   "Em Roraima, a alta temporada vai de outubro a março, período de seca. É quando as praias dos rios aparecem e o Monte Roraima tem melhores condições. Considere ajustar seus preços para essa época — a demanda justifica margens maiores."

5. **"Como montar um roteiro atrativo?"**
   "Um bom roteiro combina experiências variadas: natureza, cultura e gastronomia local. Inclua paradas estratégicas, tempo de descanso, e destaque diferenciais como guias especializados. Na precificação, roteiros com mais valor percebido sustentam preços mais altos."

6. **"O que é ponto de equilíbrio?"**
   "É o número mínimo de passageiros para cobrir todos os custos. Abaixo dele, você tem prejuízo. Acima, cada passageiro extra gera lucro. Na calculadora, ele aparece em destaque no gráfico e na tabela de cenários."

## Animations

| Element | Animation | Delay |
|---------|-----------|-------|
| User message | `animate-slide-up` | 0ms |
| Typing indicator | 3 pulsing dots | appears immediately after user sends |
| Assistant message | `animate-fade-in` | 400ms after user message (replaces typing indicator) |
| Chips (initial load) | `animate-scale-in` | staggered, 50ms per chip |

**Typing indicator:** three small dots in `brand-navy` with `animate-pulse-soft`, inside a navy-50 bubble with the assistant avatar.

## Interaction Flow

1. Page loads → header visible, chips animate in, input ready
2. User clicks chip or types message → message appears as user bubble (right)
3. Typing indicator shows (left, with avatar)
4. After 400ms delay, indicator replaced by assistant response bubble
5. Chat auto-scrolls to bottom
6. Chips disappear after first message is sent
7. User can continue typing free-text → gets fallback response

## Isolation Constraints

- **Single new file:** `src/pages/AiAssistantPage.tsx`
- **Single line change in App.tsx:** import and render `AiAssistantPage` instead of `PlaceholderPage`
- **No shared state:** all chat state is local to the page component
- **No new dependencies:** uses only React, Lucide icons, and existing utility classes
