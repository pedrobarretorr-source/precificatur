// Supabase Edge Function para MiniMax Chat
// Deploy com: supabase functions deploy send-minimax-chat

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MINIMAX_API_URL = 'https://api.minimax.chat/v1/text/chatcompletion_pro'
const DEFAULT_MODEL = 'abab6.5s'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const SYSTEM_PROMPT = `Você é o assistente virtual do PrecificaTur, uma plataforma de precificação para agências de turismo em Roraima, Brasil.

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
- O ponto de equilíbrio é o número mínimo de passageiros para não ter prejuízo`

serve(async (req: Request) => {
  try {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    }

    // Handle preflight
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    // Get API key from environment or request header
    const apiKey = Deno.env.get('MINIMAX_API_KEY') || req.headers.get('x-minimax-key')
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'MINIMAX_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { messages, model } = await req.json()
    
    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'messages é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build messages with system prompt
    const allMessages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages,
    ]

    // Call MiniMax API
    const minimaxResponse = await fetch(MINIMAX_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        messages: allMessages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    })

    if (!minimaxResponse.ok) {
      const errorText = await minimaxResponse.text()
      return new Response(
        JSON.stringify({ error: `MiniMax API Error: ${minimaxResponse.status}`, details: errorText }),
        { status: minimaxResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await minimaxResponse.json()

    // Return response
    return new Response(
      JSON.stringify({
        choices: data.choices || [],
        model: model || DEFAULT_MODEL,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})