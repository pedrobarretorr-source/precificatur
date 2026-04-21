import { useState, useRef, useEffect } from 'react';
import { Send, AlertCircle, Bot } from 'lucide-react';
import { cn, generateId } from '@/lib/utils';
import { chatWithMiniMax, isAiConfigured } from '@/lib/ai-service';

// ── Types ──

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

// ── Mocked Data (fallback quando API não está configurada) ──

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

function getMockResponse(question: string): string {
  return RESPONSE_MAP[question] ?? FALLBACK_RESPONSE;
}

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

// ── Main Page Component ──

export function AiAssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const aiConfigured = isAiConfigured();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  async function sendMessage(text: string) {
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
    setError(null);

    try {
      let response: string;

      if (aiConfigured) {
        // Use MiniMax API
        const chatHistory = messages.map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text,
        }));
        response = await chatWithMiniMax(text.trim(), chatHistory);
      } else {
        // Use mock response
        response = getMockResponse(text.trim());
        // Add small delay to simulate "thinking"
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      const botMsg: ChatMessage = {
        id: generateId(),
        sender: 'assistant',
        text: response,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar mensagem');
      // Show fallback response
      const botMsg: ChatMessage = {
        id: generateId(),
        sender: 'assistant',
        text: 'Desculpe, tive um problema ao processar sua mensagem. Tente novamente.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMsg]);
    } finally {
      setIsTyping(false);
    }
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
        <div className="flex-1">
          <h1 className="text-lg font-extrabold text-brand-navy flex items-center gap-2">
            Assistente PrecificaTur
            {aiConfigured && (
              <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Bot size={12} />
                MiniMax
              </span>
            )}
          </h1>
          <p className="text-sm text-surface-500">
            {aiConfigured
              ? 'Powered by MiniMax — Tire dúvidas sobre a plataforma, precificação e o mercado turístico.'
              : 'Modo demonstração — Configure a API do MiniMax para respostas inteligentes.'}
          </p>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Chat area ── */}
      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-4">
        {!hasMessages && (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <p className="text-sm text-surface-400 text-center">
              {aiConfigured ? 'Escolha uma pergunta ou digite a sua:' : 'Modo demonstração — experimente as perguntas abaixo:'}
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

        {messages.map(msg =>
          msg.sender === 'user' ? (
            <UserBubble key={msg.id} message={msg} />
          ) : (
            <AssistantBubble key={msg.id} message={msg} />
          )
        )}

        {isTyping && <TypingIndicator />}

        <div ref={chatEndRef} />
      </div>

      {/* ── Input bar ── */}
      <div className="flex-shrink-0 border-t border-surface-200 p-4 flex gap-3 items-center">
        <input
          className="input flex-1"
          placeholder={aiConfigured ? "Digite sua pergunta..." : "Configure VITE_MINIMAX_API_KEY para ativar..."}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isTyping}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isTyping}
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