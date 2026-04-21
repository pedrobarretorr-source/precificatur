/**
 * ai-service.ts
 * Serviço de comunicação com a API MiniMax
 */

const MINIMAX_API_URL = 'https://api.minimax.chat/v1/text/chatcompletion_pro';

interface MiniMaxMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface MiniMaxRequest {
  model: string;
  messages: MiniMaxMessage[];
  temperature?: number;
  max_tokens?: number;
}

interface MiniMaxResponse {
  id?: string;
  choices?: Array<{
    finish_reason?: string;
    message?: {
      role?: string;
      content?: string;
    };
  }>;
  error?: {
    message: string;
    type: string;
    code?: string;
  };
}

export interface AiServiceConfig {
  apiKey: string;
  model?: string;
}

const DEFAULT_MODEL = 'abab6.5s';

/**
 * Envia uma mensagem para o MiniMax e retorna a resposta
 */
export async function sendMessageToMiniMax(
  messages: MiniMaxMessage[],
  config: AiServiceConfig
): Promise<string> {
  const apiKey = config.apiKey || import.meta.env.VITE_MINIMAX_API_KEY;
  const model = config.model || import.meta.env.VITE_MINIMAX_MODEL || DEFAULT_MODEL;

  if (!apiKey || apiKey === 'your-minimax-api-key') {
    throw new Error('MINIMAX_API_KEY não configurada');
  }

  const request: MiniMaxRequest = {
    model,
    messages,
    temperature: 0.7,
    max_tokens: 1024,
  };

  const response = await fetch(MINIMAX_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as MiniMaxResponse;
    throw new Error(`MiniMax API Error: ${response.status} - ${errorData.error?.message || response.statusText}`);
  }

  const data: MiniMaxResponse = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error('Nenhuma resposta recebida do MiniMax');
  }

  return data.choices[0].message?.content ?? 'Desculpe, não consegui gerar uma resposta.';
}

/**
 * Monta o prompt do sistema para o assistente PrecificaTur
 */
export function buildSystemPrompt(): string {
  return `Você é o assistente virtual do PrecificaTur, uma plataforma de precificação para agências de turismo em Roraima, Brasil.

Seu papel é ajudar operadores turísticos com:
- Dúvidas sobre a calculadora de preços
- Conceitos de custos fixos e variáveis
- Dicas de precificação e lucro
- Informações sobre destinos turísticos em Roraima (Monte Roraima, Bonfim, etc)
- Dúvidas sobre o mercado turístico da região

Seja sempre amigável, objetivo e prestativo. Responda em português brasileiro.

Contexto da plataforma:
- Calculadora de preços em 5 etapas: nome, custos fixos, custos variáveis, preço/margem, simulação
- Custos fixos incluem: Van/Transporte, Hospedagem, Alimentação, Guia, Ingressos, Equipamentos, Seguro
- Custos variáveis são percentuais ou valores fixos que incidem sobre o preço (ex: taxa de cartão, comissão)
- O ponto de equilíbrio é o número mínimo de passageiros para não ter prejuízo`;
}

/**
 * Cria uma conversa com contexto inicial
 */
export async function chatWithMiniMax(
  userMessage: string,
  previousMessages: { role: string; content: string }[] = []
): Promise<string> {
  const systemPrompt = buildSystemPrompt();

  const allMessages: MiniMaxMessage[] = [
    { role: 'system', content: systemPrompt },
    ...previousMessages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  return sendMessageToMiniMax(allMessages, {
    apiKey: import.meta.env.VITE_MINIMAX_API_KEY || '',
    model: import.meta.env.VITE_MINIMAX_MODEL || DEFAULT_MODEL,
  });
}

/**
 * Verifica se a API está configurada
 */
export function isAiConfigured(): boolean {
  const apiKey = import.meta.env.VITE_MINIMAX_API_KEY;
  return Boolean(apiKey && apiKey !== 'your-minimax-api-key' && apiKey.trim().length > 0);
}