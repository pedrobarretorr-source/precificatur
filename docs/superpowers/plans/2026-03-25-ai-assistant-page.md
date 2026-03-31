# AI Assistant Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a frontend-only chat-based AI assistant page with mocked responses, suggestion chips, and the PrecificaTur avatar as guide.

**Architecture:** Single-file page component (`AiAssistantPage.tsx`) with local state for messages. Mocked response data is co-located in the same file. One line change in `App.tsx` to wire the route.

**Tech Stack:** React + TypeScript, Tailwind CSS (existing brand tokens), Lucide icons (`Send`)

**Spec:** `docs/superpowers/specs/2026-03-25-ai-assistant-page-design.md`

---

### File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/pages/AiAssistantPage.tsx` | Entire page: types, data, components, state |
| Modify | `src/App.tsx` (lines 5, 31-32) | Import + route swap |

---

### Task 1: Create page file with types and mocked data

**Files:**
- Create: `src/pages/AiAssistantPage.tsx`

- [ ] **Step 1: Create the file with types, constants, and mocked response map**

```tsx
import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { cn, generateId } from '@/lib/utils';

// ── Types ──

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

// ── Mocked Data ──

const SUGGESTIONS = [
  'Como funciona a calculadora?',
  'O que são custos fixos e variáveis?',
  'Como definir meu preço de venda?',
  'Quando é alta temporada em Roraima?',
  'Como montar um roteiro atrativo?',
  'O que é ponto de equilíbrio?',
];

const RESPONSE_MAP: Record<string, string> = {
  'Como funciona a calculadora?':
    'A calculadora funciona em 5 etapas: primeiro você dá um nome ao roteiro, depois adiciona os custos fixos (van, hotel, guia...), define os percentuais variáveis, escolhe o preço ou a margem desejada, e no final vê a simulação completa com gráfico e tabela.',
  'O que são custos fixos e variáveis?':
    'Custos fixos são os que você paga independente de quantos passageiros vão — como a van ou o guia. Já os variáveis dependem do preço de venda: taxas de cartão, comissões. Separar os dois é essencial para saber seu preço mínimo.',
  'Como definir meu preço de venda?':
    'Você tem duas opções na calculadora: definir o preço diretamente ou informar a margem de lucro desejada. Na segunda opção, a plataforma calcula o preço ideal para a quantidade de passageiros que você espera.',
  'Quando é alta temporada em Roraima?':
    'Em Roraima, a alta temporada vai de outubro a março, período de seca. É quando as praias dos rios aparecem e o Monte Roraima tem melhores condições. Considere ajustar seus preços para essa época — a demanda justifica margens maiores.',
  'Como montar um roteiro atrativo?':
    'Um bom roteiro combina experiências variadas: natureza, cultura e gastronomia local. Inclua paradas estratégicas, tempo de descanso, e destaque diferenciais como guias especializados. Na precificação, roteiros com mais valor percebido sustentam preços mais altos.',
  'O que é ponto de equilíbrio?':
    'É o número mínimo de passageiros para cobrir todos os custos. Abaixo dele, você tem prejuízo. Acima, cada passageiro extra gera lucro. Na calculadora, ele aparece em destaque no gráfico e na tabela de cenários.',
};

const FALLBACK_RESPONSE =
  'Essa é uma ótima pergunta! Em breve terei acesso ao banco de dados completo para te ajudar melhor. Por enquanto, experimente as sugestões acima.';

function getResponse(question: string): string {
  return RESPONSE_MAP[question] ?? FALLBACK_RESPONSE;
}
```

- [ ] **Step 2: Verify file was created and has no syntax errors**

Run: `npx tsc --noEmit src/pages/AiAssistantPage.tsx 2>&1 || echo "expected — component not exported yet"`

---

### Task 2: Build the page component shell with header and input bar

**Files:**
- Modify: `src/pages/AiAssistantPage.tsx`

- [ ] **Step 1: Add the exported page component with state, header, and input bar**

Append to the file after `getResponse`:

```tsx
export function AiAssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new message or typing indicator
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  function sendMessage(text: string) {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: generateId(),
      sender: 'user',
      text: text.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const botMsg: ChatMessage = {
        id: generateId(),
        sender: 'assistant',
        text: getResponse(text.trim()),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
    }, 400);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] lg:h-[calc(100vh-4rem)] animate-fade-in">
      {/* ── Header ── */}
      <div className="card flex items-center gap-4 mb-4 flex-shrink-0">
        <img
          src="/AVATAR-TESTE.png"
          alt="Assistente"
          className="w-16 h-16 rounded-full object-cover shadow-md"
        />
        <div>
          <h1 className="text-lg font-extrabold text-brand-navy">
            Assistente PrecificaTur
          </h1>
          <p className="text-sm text-surface-500">
            Tire dúvidas sobre a plataforma, precificação e o mercado turístico.
          </p>
        </div>
      </div>

      {/* ── Chat area ── */}
      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-4">
        {/* Suggestion chips (empty state) */}
        {!hasMessages && (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <p className="text-sm text-surface-400 text-center">
              Escolha uma pergunta ou digite a sua:
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className={cn(
                    'bg-white border border-surface-300 text-surface-700 rounded-full px-4 py-2 text-sm',
                    'hover:border-brand-orange hover:text-brand-orange transition-all',
                    'animate-scale-in'
                  )}
                  style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'both' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map(msg =>
          msg.sender === 'user' ? (
            <UserBubble key={msg.id} message={msg} />
          ) : (
            <AssistantBubble key={msg.id} message={msg} />
          )
        )}

        {/* Typing indicator */}
        {isTyping && <TypingIndicator />}

        <div ref={chatEndRef} />
      </div>

      {/* ── Input bar ── */}
      <div className="flex-shrink-0 border-t border-surface-200 p-4 flex gap-3 items-center">
        <input
          className="input flex-1"
          placeholder="Digite sua pergunta..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim()}
          className={cn(
            'w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all',
            'bg-brand-orange text-white hover:bg-brand-orange-500',
            'disabled:opacity-40 disabled:cursor-not-allowed'
          )}
          aria-label="Enviar mensagem"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the component compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: errors about missing `UserBubble`, `AssistantBubble`, `TypingIndicator` (not defined yet)

---

### Task 3: Build the sub-components (bubbles + typing indicator)

**Files:**
- Modify: `src/pages/AiAssistantPage.tsx`

- [ ] **Step 1: Add the three sub-components at the bottom of the file**

Append after `AiAssistantPage`:

```tsx
// ── Sub-components ──

function UserBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="flex justify-end animate-slide-up">
      <div className="max-w-[75%]">
        <div className="bg-brand-orange-50 border border-brand-orange-100 rounded-2xl rounded-tr-sm px-4 py-3">
          <p className="text-sm text-surface-800">{message.text}</p>
        </div>
        <p className="text-[10px] text-surface-400 text-right mt-1 mr-1">
          {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

function AssistantBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="flex items-start gap-3 animate-fade-in">
      <img
        src="/AVATAR-TESTE.png"
        alt="Assistente"
        className="w-9 h-9 rounded-full object-cover shadow-sm flex-shrink-0 mt-1"
      />
      <div className="max-w-[75%]">
        <p className="text-xs font-bold text-brand-navy mb-1">Assistente PrecificaTur</p>
        <div className="bg-brand-navy-50 border border-brand-navy-100 rounded-2xl rounded-tl-sm px-4 py-3">
          <p className="text-sm text-surface-800 leading-relaxed">{message.text}</p>
        </div>
        <p className="text-[10px] text-surface-400 mt-1 ml-1">
          {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <img
        src="/AVATAR-TESTE.png"
        alt="Assistente"
        className="w-9 h-9 rounded-full object-cover shadow-sm flex-shrink-0 mt-1"
      />
      <div>
        <p className="text-xs font-bold text-brand-navy mb-1">Assistente PrecificaTur</p>
        <div className="bg-brand-navy-50 border border-brand-navy-100 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5 items-center">
          <span className="w-2 h-2 bg-brand-navy-300 rounded-full animate-pulse-soft" />
          <span className="w-2 h-2 bg-brand-navy-300 rounded-full animate-pulse-soft" style={{ animationDelay: '200ms' }} />
          <span className="w-2 h-2 bg-brand-navy-300 rounded-full animate-pulse-soft" style={{ animationDelay: '400ms' }} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles with no errors**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: no errors related to `AiAssistantPage.tsx`

- [ ] **Step 3: Commit the complete page component**

```bash
git add src/pages/AiAssistantPage.tsx
git commit -m "feat: add AI assistant page with mocked chat"
```

---

### Task 4: Wire the route in App.tsx

**Files:**
- Modify: `src/App.tsx` (add import after existing imports, replace route at lines 31-32)

- [ ] **Step 1: Add import for AiAssistantPage**

In `src/App.tsx`, add after line 4:

```tsx
import { AiAssistantPage } from '@/pages/AiAssistantPage';
```

- [ ] **Step 2: Replace the PlaceholderPage route for ai-assistant**

Change line 31-32 from:

```tsx
      case 'ai-assistant':
        return <PlaceholderPage title="Assistente de IA" />;
```

To:

```tsx
      case 'ai-assistant':
        return <AiAssistantPage />;
```

- [ ] **Step 3: Verify the app compiles**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: no errors

- [ ] **Step 4: Commit the route wiring**

```bash
git add src/App.tsx
git commit -m "feat: wire AI assistant page route"
```

---

### Task 5: Visual smoke test

- [ ] **Step 1: Start dev server and verify**

Run: `npm run dev`

Open browser, navigate to Assistente de IA via sidebar. Verify:

1. Header shows avatar + title + description
2. Six suggestion chips appear with staggered animation
3. Click a chip → user bubble appears right, typing dots show, then assistant bubble left
4. Type free text + Enter → gets fallback response
5. Chat auto-scrolls on new messages
6. Input clears after sending

- [ ] **Step 2: Final commit if any tweaks were needed**

```bash
git add -A
git commit -m "fix: visual tweaks for AI assistant page"
```
