# Prompt: Arquitetura Enterprise — Backend + Assistente de IA + Infraestrutura Completa

## Visão geral

O **PrecificaTur** é uma plataforma SaaS de precificação de roteiros turísticos. O frontend React + TypeScript + Tailwind já está em desenvolvimento. Este prompt cobre a implementação de toda a camada de backend, infraestrutura e o assistente de IA integrado.

A plataforma será apresentada ao **Programa Centelha (governo federal)** e a **clientes institucionais** (Sebrae, secretarias de turismo), portanto precisa de arquitetura robusta, escalável, auditável e documentada.

---

## Stack definida

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend/Orquestrador | **N8N** (self-hosted ou cloud) |
| Banco de dados | **Supabase** (PostgreSQL + Auth + Storage + Realtime) |
| IA | **OpenAI API** (GPT-4o-mini para chat, GPT-4o para análises complexas) |
| Deploy frontend | Vercel |
| Deploy N8N | Railway / Render / VPS próprio |
| Deploy Supabase | Supabase Cloud (managed) |

---

## Parte 1: Modelagem do banco de dados (Supabase/PostgreSQL)

### Esquema de tabelas

Criar todas as tabelas abaixo no Supabase com Row Level Security (RLS) habilitado.

```sql
-- ══════════════════════════════════════
-- PERFIL E AUTENTICAÇÃO
-- ══════════════════════════════════════

-- Estende auth.users do Supabase
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company_name TEXT,                    -- nome da agência/empresa
  company_document TEXT,                -- CNPJ ou CPF
  region TEXT,                          -- região de atuação
  state TEXT,                           -- UF
  city TEXT,
  role TEXT NOT NULL DEFAULT 'user',    -- 'user', 'admin', 'institutional'
  plan TEXT NOT NULL DEFAULT 'free',    -- 'free', 'professional', 'institutional'
  avatar_url TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════
-- CUSTOS FIXOS DA EMPRESA (CAMADA 1)
-- ══════════════════════════════════════

CREATE TABLE public.company_overhead (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  value DECIMAL(12,2) NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'outro',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.company_settings (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  estimated_routes_per_month INTEGER NOT NULL DEFAULT 10,
  default_currency TEXT NOT NULL DEFAULT 'BRL',
  default_max_pax INTEGER NOT NULL DEFAULT 50,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════
-- ROTEIROS
-- ══════════════════════════════════════

CREATE TABLE public.routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  client TEXT,
  date DATE,
  contact TEXT,
  notes TEXT,
  region TEXT,
  route_type TEXT NOT NULL DEFAULT 'outro',
  estimated_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  max_pax INTEGER NOT NULL DEFAULT 50,
  discounts DECIMAL(12,2) DEFAULT 0,
  has_agent BOOLEAN DEFAULT FALSE,
  is_multi_day BOOLEAN DEFAULT FALSE,
  is_template BOOLEAN DEFAULT FALSE,       -- roteiros-modelo reutilizáveis
  status TEXT NOT NULL DEFAULT 'draft',     -- 'draft', 'active', 'archived'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════
-- CUSTOS FIXOS DO ROTEIRO (CAMADA 2)
-- ══════════════════════════════════════

CREATE TABLE public.route_fixed_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  day_number INTEGER DEFAULT 1,             -- para multi-dia
  label TEXT NOT NULL,
  value DECIMAL(12,2) NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'outro',
  currency TEXT NOT NULL DEFAULT 'BRL',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════
-- CUSTOS VARIÁVEIS DO ROTEIRO (CAMADA 3)
-- ══════════════════════════════════════

CREATE TABLE public.route_variable_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  cost_type TEXT NOT NULL,                  -- 'percentage' ou 'per_pax'
  value DECIMAL(12,4) NOT NULL DEFAULT 0,   -- se percentage: 6.0 = 6%. Se per_pax: 15.00 = R$15
  is_system_item BOOLEAN DEFAULT FALSE,     -- true = agenciador (toggle)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════
-- DIAS DO ROTEIRO (MULTI-DIA)
-- ══════════════════════════════════════

CREATE TABLE public.route_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  is_optional BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════
-- HISTÓRICO DE SIMULAÇÕES
-- ══════════════════════════════════════

CREATE TABLE public.simulation_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  snapshot_data JSONB NOT NULL,              -- resultado completo da simulação
  break_even_pax INTEGER,
  total_fixed DECIMAL(12,2),
  total_variable_percent DECIMAL(8,4),
  estimated_price DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════
-- CHAT DO ASSISTENTE DE IA
-- ══════════════════════════════════════

CREATE TABLE public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL,  -- conversa pode estar vinculada a um roteiro
  title TEXT,
  status TEXT NOT NULL DEFAULT 'active',   -- 'active', 'archived'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,                        -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  metadata JSONB,                            -- sugestões de preenchimento, ações propostas
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════
-- BENCHMARK (DADOS ANÔNIMOS AGREGADOS)
-- ══════════════════════════════════════

CREATE TABLE public.benchmark_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region TEXT NOT NULL,
  route_type TEXT NOT NULL,
  price_per_pax DECIMAL(12,2),
  total_fixed_costs DECIMAL(12,2),
  break_even_pax INTEGER,
  margin_percent DECIMAL(8,4),
  pax_count INTEGER,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Sem referência a user_id — dados completamente anônimos

-- ══════════════════════════════════════
-- AUDITORIA
-- ══════════════════════════════════════

CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,                     -- 'route.created', 'route.simulated', 'ai.chat', etc.
  entity_type TEXT,                         -- 'route', 'profile', 'overhead'
  entity_id UUID,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════

CREATE INDEX idx_routes_user_id ON public.routes(user_id);
CREATE INDEX idx_routes_status ON public.routes(status);
CREATE INDEX idx_route_fixed_costs_route_id ON public.route_fixed_costs(route_id);
CREATE INDEX idx_route_variable_costs_route_id ON public.route_variable_costs(route_id);
CREATE INDEX idx_ai_conversations_user_id ON public.ai_conversations(user_id);
CREATE INDEX idx_ai_messages_conversation_id ON public.ai_messages(conversation_id);
CREATE INDEX idx_benchmark_region_type ON public.benchmark_data(region, route_type);
CREATE INDEX idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_action ON public.audit_log(action);

-- ══════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_overhead ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_fixed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_variable_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benchmark_data ENABLE ROW LEVEL SECURITY;

-- Policies: cada usuário só acessa seus próprios dados
CREATE POLICY "Users can CRUD own profile" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users can CRUD own overhead" ON public.company_overhead FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own settings" ON public.company_settings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own routes" ON public.routes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own route costs" ON public.route_fixed_costs FOR ALL USING (route_id IN (SELECT id FROM public.routes WHERE user_id = auth.uid()));
CREATE POLICY "Users can CRUD own variable costs" ON public.route_variable_costs FOR ALL USING (route_id IN (SELECT id FROM public.routes WHERE user_id = auth.uid()));
CREATE POLICY "Users can CRUD own route days" ON public.route_days FOR ALL USING (route_id IN (SELECT id FROM public.routes WHERE user_id = auth.uid()));
CREATE POLICY "Users can read own snapshots" ON public.simulation_snapshots FOR ALL USING (route_id IN (SELECT id FROM public.routes WHERE user_id = auth.uid()));
CREATE POLICY "Users can CRUD own conversations" ON public.ai_conversations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own messages" ON public.ai_messages FOR ALL USING (conversation_id IN (SELECT id FROM public.ai_conversations WHERE user_id = auth.uid()));
CREATE POLICY "Users can read own audit" ON public.audit_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Everyone can read benchmark" ON public.benchmark_data FOR SELECT USING (true);
```

---

## Parte 2: Workflows N8N

### Workflow 1: Assistente de IA (chat)

**Trigger:** Webhook POST `/api/ai/chat`

**Payload recebido do frontend:**
```json
{
  "userId": "uuid",
  "conversationId": "uuid | null",
  "message": "string",
  "context": {
    "currentPage": "calculator | dashboard | scenarios",
    "routeId": "uuid | null",
    "routeData": {
      "name": "City Tour Boa Vista",
      "estimatedPrice": 150,
      "fixedCosts": [...],
      "variableCosts": [...],
      "overheadPerRoute": 400,
      "simulation": { "breakEvenPax": 8, "totalFixed": 1290 }
    }
  }
}
```

**Fluxo N8N:**

```
[Webhook] → [Validar token JWT Supabase] → [Buscar/criar conversa no Supabase]
    → [Montar contexto: buscar perfil + overhead + roteiro atual do Supabase]
    → [Salvar mensagem do usuário no Supabase]
    → [Chamar OpenAI API com system prompt + histórico + contexto]
    → [Parsear resposta: separar texto de sugestões de ação]
    → [Salvar resposta no Supabase]
    → [Retornar resposta ao frontend via webhook response]
```

**Nós N8N detalhados:**

1. **Webhook** — POST, autenticado, retorna JSON
2. **HTTP Request (Supabase)** — validar JWT extraindo user_id de `Authorization: Bearer <token>`
3. **IF** — conversationId existe? Se sim, busca conversa. Se não, cria nova.
4. **HTTP Request (Supabase)** — buscar `profiles`, `company_settings`, `company_overhead` do user
5. **HTTP Request (Supabase)** — se routeId existe, buscar `routes` + `route_fixed_costs` + `route_variable_costs`
6. **HTTP Request (Supabase)** — buscar últimas 20 mensagens da conversa (histórico)
7. **HTTP Request (Supabase)** — INSERT na tabela `ai_messages` (mensagem do usuário)
8. **HTTP Request (OpenAI)** — POST `/v1/chat/completions` com:
   - model: `gpt-4o-mini` (custo baixo, suficiente para orientação)
   - messages: [system_prompt, ...histórico, user_message]
   - temperature: 0.7
   - max_tokens: 1000
   - response_format: JSON mode (para parsear sugestões)
9. **Function** — parsear a resposta da OpenAI separando `text` (mensagem ao usuário) de `suggestions` (ações propostas)
10. **HTTP Request (Supabase)** — INSERT na tabela `ai_messages` (resposta da IA com metadata de sugestões)
11. **HTTP Request (Supabase)** — INSERT na `audit_log`
12. **Respond to Webhook** — retorna:

```json
{
  "conversationId": "uuid",
  "message": {
    "id": "uuid",
    "role": "assistant",
    "content": "Texto da resposta...",
    "suggestions": [
      {
        "type": "fill_field",
        "field": "estimatedPrice",
        "value": 180,
        "reason": "Baseado nos seus custos e na margem de 25%, sugiro R$ 180 por passageiro."
      },
      {
        "type": "add_cost",
        "category": "fixedCost",
        "item": { "label": "Seguro viagem", "value": 15, "costType": "per_pax" },
        "reason": "Roteiros de aventura geralmente incluem seguro viagem."
      }
    ]
  }
}
```

**System prompt da IA (enviar como primeira mensagem no array):**

```
Você é o assistente do PrecificaTur, uma plataforma de precificação de roteiros turísticos.

SEU PAPEL:
- Ajudar guias de turismo e agências a precificar roteiros corretamente
- Explicar conceitos financeiros de forma simples e acessível
- Sugerir preenchimentos e ajustes baseados nos dados do usuário
- Educar sobre boas práticas de precificação no turismo

CONTEXTO DO USUÁRIO:
- Perfil: {profile.full_name}, {profile.company_name}, região: {profile.region}
- Custos fixos da empresa: R$ {overhead_total}/mês, {settings.estimated_routes_per_month} roteiros/mês
- Rateio por roteiro: R$ {overhead_per_route}

ROTEIRO ATUAL (se houver):
- Nome: {route.name}
- Preço estimado: R$ {route.estimated_price}/pax
- Custos fixos do roteiro: R$ {route_fixed_total}
- Custos variáveis: {variable_percent}% sobre preço + R$ {variable_per_pax}/pax
- Ponto de equilíbrio: {simulation.breakEvenPax} passageiros
- Margem com 10 pax: {margin_10pax}%

REGRAS:
1. Responda sempre em português do Brasil, linguagem simples e direta
2. Quando sugerir valores, SEMPRE retorne no campo "suggestions" do JSON
3. Tipos de sugestão válidos:
   - "fill_field": preencher um campo (field + value + reason)
   - "add_cost": sugerir adicionar um custo (category + item + reason)
   - "alert": alerta sobre risco financeiro (message + severity: info|warning|danger)
   - "tip": dica educativa (message)
4. Nunca invente dados de mercado — se não souber valores reais da região, diga que não sabe
5. Se o preço está abaixo do custo, ALERTE imediatamente
6. Lembre que o público são empreendedores de turismo, muitos sem formação financeira
7. Seja proativo: se vê que falta seguro num roteiro de aventura, sugira. Se a margem está muito baixa, avise.

FORMATO DE RESPOSTA (JSON):
{
  "text": "Mensagem em texto natural para o usuário...",
  "suggestions": [
    { "type": "fill_field|add_cost|alert|tip", ...dados }
  ]
}

Se não houver sugestões, retorne "suggestions": []
```

### Workflow 2: Salvar/carregar roteiros (CRUD)

**Endpoints via webhooks N8N:**

```
POST   /api/routes              → Criar roteiro
GET    /api/routes              → Listar roteiros do usuário
GET    /api/routes/:id          → Detalhe de um roteiro (com custos)
PUT    /api/routes/:id          → Atualizar roteiro
DELETE /api/routes/:id          → Arquivar roteiro (soft delete: status → 'archived')
POST   /api/routes/:id/duplicate → Duplicar roteiro
POST   /api/routes/:id/snapshot  → Salvar snapshot da simulação
```

**Cada endpoint:**
1. Webhook com método correspondente
2. Validar JWT Supabase
3. Verificar que o roteiro pertence ao usuário (RLS já protege, mas validar na aplicação também)
4. Executar query no Supabase
5. Log na audit_log
6. Retornar resposta

### Workflow 3: Benchmark (coleta e consulta)

**Coleta (acionado quando usuário salva simulação):**
```
[Trigger: snapshot salvo] → [Verificar se usuário deu consentimento]
    → [Extrair dados anônimos (sem user_id): região, tipo, preço, custos, margem, mês/ano]
    → [INSERT na benchmark_data]
```

**Consulta:**
```
GET /api/benchmark?region=RR&type=city_tour

→ Busca aggregations: AVG, MIN, MAX, PERCENTILE de preço, custos, margem
→ Só retorna se houver >= 5 contribuidores na categoria (privacidade)
```

### Workflow 4: Câmbio automático

```
[Cron: a cada 6 horas] → [HTTP Request: API do Banco Central ou AwesomeAPI]
    → [Parsear cotações: USD, EUR, VES]
    → [Salvar em tabela exchange_rates no Supabase]
    → [Usado pelo frontend para conversão em tempo real]
```

### Workflow 5: Onboarding guiado

**Trigger:** Webhook acionado quando `profiles.onboarding_completed = false` e o usuário faz login

```
[Webhook] → [Verificar status do onboarding]
    → [Retornar próximo passo pendente]:
       1. Completar perfil (nome, empresa, região)
       2. Cadastrar custos fixos da empresa
       3. Criar primeiro roteiro
       4. Primeira simulação
    → [Se completou todos, UPDATE profiles SET onboarding_completed = true]
```

---

## Parte 3: Componente frontend — Chat do assistente de IA

### Novo componente: `src/components/ai/AiChatSidebar.tsx`

Chat lateral (sidebar direita) que abre/fecha com um FAB (floating action button) no canto inferior direito.

**Estrutura visual:**

```
┌─── Assistente PrecificaTur ──── [X] ─┐
│                                       │
│  ┌─────────────────────────────────┐  │
│  │ 🤖 Olá! Sou o assistente do    │  │
│  │ PrecificaTur. Posso te ajudar  │  │
│  │ a precificar seu roteiro.      │  │
│  └─────────────────────────────────┘  │
│                                       │
│  ┌─────────────────────────────────┐  │
│  │ 👤 Quanto devo cobrar por um   │  │
│  │ city tour de 4 horas?          │  │
│  └─────────────────────────────────┘  │
│                                       │
│  ┌─────────────────────────────────┐  │
│  │ 🤖 Com base nos seus custos... │  │
│  │                                │  │
│  │ ┌── Sugestão ───────────────┐  │  │
│  │ │ Preço sugerido: R$ 180    │  │  │
│  │ │ [Aplicar]  [Ignorar]      │  │  │
│  │ └──────────────────────────-┘  │  │
│  └─────────────────────────────────┘  │
│                                       │
│  ┌─────────────────────────────────┐  │
│  │  Digite sua mensagem...    [➤] │  │
│  └─────────────────────────────────┘  │
└───────────────────────────────────────┘
```

**Comportamento:**
- FAB com ícone de chat no canto inferior direito (cor brand-orange)
- Ao clicar, abre sidebar de 380px de largura com animação slide-in da direita
- Header com título "Assistente PrecificaTur" e botão fechar
- Área de mensagens com scroll
- Mensagens do usuário alinhadas à direita (bg brand-navy/10)
- Mensagens da IA alinhadas à esquerda (bg white com borda)
- Quando a IA retorna `suggestions`, renderizar cards de ação inline:
  - `fill_field` → card com campo, valor sugerido, botões "Aplicar" e "Ignorar"
  - `add_cost` → card com item sugerido, botões "Adicionar" e "Ignorar"
  - `alert` → card com ícone de alerta (cor por severity), texto
  - `tip` → card com ícone de lâmpada, texto educativo
- Ao clicar "Aplicar", emitir evento/callback que atualiza o estado do formulário pai
- Input de texto com envio por Enter ou botão
- Loading state: typing indicator animado enquanto espera resposta da IA
- Persiste conversa: ao reabrir, carrega histórico da conversa ativa

**Props / integração:**
```typescript
interface AiChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  currentPage: string;
  routeId?: string;
  routeData?: RouteContextData;  // dados atuais do formulário para contexto
  onApplySuggestion: (suggestion: AiSuggestion) => void;  // callback para aplicar no form
}

interface AiSuggestion {
  type: 'fill_field' | 'add_cost' | 'alert' | 'tip';
  field?: string;
  value?: number | string;
  item?: { label: string; value: number; costType: string };
  message?: string;
  severity?: 'info' | 'warning' | 'danger';
  reason: string;
}
```

### Novo hook: `src/hooks/useAiChat.ts`

```typescript
// Gerencia estado do chat, envio de mensagens, carregamento de histórico
// Chamadas HTTP para o webhook N8N: POST /api/ai/chat
// Armazena conversationId no state/localStorage
// Retry automático com exponential backoff em caso de erro
// Streaming não é necessário (resposta vem completa do N8N)
```

### Novo componente: `src/components/ai/AiSuggestionCard.tsx`

Card reutilizável que renderiza cada tipo de sugestão da IA com visual apropriado:
- `fill_field` → ícone de edição, nome do campo, valor proposto, motivo, botões Aplicar/Ignorar
- `add_cost` → ícone de +, item de custo proposto com categoria, valor, motivo, botões Adicionar/Ignorar
- `alert` → borda colorida (info=azul, warning=amarelo, danger=vermelho), ícone, mensagem
- `tip` → borda brand-gold, ícone de lâmpada, texto educativo

---

## Parte 4: Autenticação e segurança

### Supabase Auth

Usar autenticação nativa do Supabase:
- **Email + senha** (padrão)
- **Login social**: Google (prioridade), Facebook (secundário)
- **Magic link** via email (alternativa sem senha)

### Middleware de autenticação no N8N

Todo webhook N8N deve:
1. Extrair o token JWT do header `Authorization: Bearer <token>`
2. Validar o JWT com a chave pública do Supabase (HTTP Request para `GET /auth/v1/user` com o token)
3. Extrair `user_id` do JWT decodificado
4. Recusar com 401 se inválido

### Rate limiting

Implementar no N8N usando nó de Function + Supabase:
- Chat IA: máximo 30 mensagens/hora por usuário (free), 100/hora (professional)
- CRUD routes: máximo 100 requests/hora
- Benchmark: máximo 10 consultas/hora
- Armazenar contadores em tabela `rate_limits` ou Redis se disponível

### LGPD

- Todos os dados pessoais estão protegidos por RLS
- Benchmark usa apenas dados anônimos (sem user_id)
- Endpoint `DELETE /api/account` para exclusão completa da conta e dados (LGPD compliance)
- Termos de uso e consentimento para benchmark no onboarding
- Log de consentimento na audit_log

---

## Parte 5: Estrutura de arquivos atualizada (frontend)

```
src/
├── components/
│   ├── ai/                          # 🆕 Assistente de IA
│   │   ├── AiChatSidebar.tsx        # Sidebar do chat
│   │   ├── AiSuggestionCard.tsx     # Cards de sugestão
│   │   ├── AiMessageBubble.tsx      # Bolha de mensagem
│   │   └── AiTypingIndicator.tsx    # Indicador de digitação
│   ├── auth/                        # 🆕 Autenticação
│   │   ├── LoginForm.tsx
│   │   ├── RegisterForm.tsx
│   │   ├── ForgotPasswordForm.tsx
│   │   └── AuthGuard.tsx            # Wrapper que protege rotas
│   ├── calculator/
│   │   ├── CompanyOverheadForm.tsx   # 🆕 Custos da empresa
│   │   ├── FixedCostsForm.tsx
│   │   ├── VariableCostsForm.tsx     # Reformulado (personaliz.)
│   │   └── SimulationResults.tsx
│   ├── dashboard/
│   │   └── StatsCards.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── TopBar.tsx               # 🆕 Barra superior com perfil
│   │   └── OnboardingWizard.tsx     # 🆕 Wizard de primeiro acesso
│   └── ui/
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Card.tsx
│       ├── Modal.tsx
│       ├── Toggle.tsx
│       └── Toast.tsx
├── hooks/
│   ├── useAiChat.ts                 # 🆕 Estado do chat IA
│   ├── useAuth.ts                   # 🆕 Autenticação Supabase
│   ├── usePricingCalculator.ts
│   ├── useRoutes.ts                 # 🆕 CRUD de roteiros
│   └── useSupabase.ts              # 🆕 Cliente Supabase
├── lib/
│   ├── pricing-engine.ts
│   ├── supabase.ts                  # 🆕 Configuração do Supabase client
│   ├── api.ts                       # 🆕 Funções de chamada aos webhooks N8N
│   └── utils.ts
├── pages/
│   ├── LoginPage.tsx                # 🆕
│   ├── RegisterPage.tsx             # 🆕
│   ├── OnboardingPage.tsx           # 🆕
│   ├── DashboardPage.tsx
│   ├── CalculatorPage.tsx
│   ├── RoutesListPage.tsx           # 🆕 Lista de roteiros salvos
│   ├── ScenariosPage.tsx            # 🆕 Simulador de cenários
│   ├── ReportsPage.tsx              # 🆕 Relatórios/PDF
│   └── SettingsPage.tsx             # 🆕 Configurações + overhead
├── styles/
│   └── globals.css
├── types/
│   ├── index.ts
│   └── ai.ts                       # 🆕 Types do assistente IA
├── App.tsx
└── main.tsx
```

---

## Parte 6: Variáveis de ambiente

### Frontend (`.env`)
```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_N8N_WEBHOOK_BASE_URL=https://n8n.seudominio.com/webhook
VITE_APP_VERSION=1.0.0
```

### N8N (credenciais)
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # ⚠️ service role, não anon key
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

---

## Parte 7: O que implementar primeiro (ordem de execução)

1. **Supabase**: criar todas as tabelas + RLS policies + triggers
2. **Frontend Auth**: login, registro, AuthGuard, hook useAuth
3. **N8N CRUD**: webhooks de routes (criar, listar, editar, deletar)
4. **Frontend CRUD**: conectar calculadora ao Supabase (salvar/carregar roteiros)
5. **N8N AI Chat**: workflow do assistente com OpenAI
6. **Frontend AI Chat**: sidebar, hook, suggestion cards
7. **N8N Onboarding**: workflow de onboarding guiado
8. **Frontend Onboarding**: wizard de primeiro acesso
9. **N8N Benchmark**: coleta anônima + endpoint de consulta
10. **Frontend Benchmark**: indicadores contextuais na calculadora

---

## Regras gerais

- **Português do Brasil** em todos os textos da interface e nas respostas da IA
- **TypeScript strict** em todo o frontend
- **RLS sempre ativo** no Supabase — nunca desabilitar
- **Audit log** em toda operação que modifica dados
- **Não expor** a service role key no frontend — usar apenas no N8N
- **JWT validation** em todo webhook N8N — nunca aceitar request sem token
- **Rate limiting** para proteger custo de OpenAI
- **Error handling**: todo webhook N8N deve ter nó de error handling que loga o erro e retorna 500 gracioso
- **Versionamento de API**: prefixar webhooks com `/api/v1/` para futuro
