-- ============================================
-- Migration: Custom Costs (Fase 1 MVP)
-- Criado em: 2026-04-20
-- ============================================

-- Tabela: Custos fixos customizados por usuário
CREATE TABLE IF NOT EXISTS custom_fixed_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    category TEXT NOT NULL, -- CostCategory
    value NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'BRL', -- Currency
    is_active BOOLEAN NOT NULL DEFAULT true,
    usage_count INTEGER NOT NULL DEFAULT 0, -- para priorizar os mais usados
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Unique: um usuário não pode ter dois custos com o mesmo nome na mesma categoria
    UNIQUE(user_id, label, category)
);

-- Tabela: Custos variáveis customizados por usuário
CREATE TABLE IF NOT EXISTS custom_variable_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    emoji TEXT,
    type TEXT NOT NULL DEFAULT 'percentage', -- 'percentage' | 'brl'
    default_value NUMERIC(12,2) NOT NULL DEFAULT 0,
    per_pax BOOLEAN DEFAULT true, -- true = R$ × pax, false = R$ ÷ pax
    is_active BOOLEAN NOT NULL DEFAULT true,
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(user_id, label)
);

-- ── Índices ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_custom_fixed_costs_user ON custom_fixed_costs(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_fixed_costs_usage ON custom_fixed_costs(user_id, usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_custom_variable_costs_user ON custom_variable_costs(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_variable_costs_usage ON custom_variable_costs(user_id, usage_count DESC);

-- ── Row Level Security ────────────────────────
ALTER TABLE custom_fixed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_variable_costs ENABLE ROW LEVEL SECURITY;

-- Usuário só vê e edita seus próprios custos
CREATE POLICY "users_can_view_own_fixed_costs" ON custom_fixed_costs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_can_insert_own_fixed_costs" ON custom_fixed_costs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_can_update_own_fixed_costs" ON custom_fixed_costs
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "users_can_delete_own_fixed_costs" ON custom_fixed_costs
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users_can_view_own_variable_costs" ON custom_variable_costs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_can_insert_own_variable_costs" ON custom_variable_costs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_can_update_own_variable_costs" ON custom_variable_costs
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "users_can_delete_own_variable_costs" ON custom_variable_costs
    FOR DELETE USING (auth.uid() = user_id);

-- ── Funções de trigger para updated_at ──────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_custom_fixed_costs_updated_at
    BEFORE UPDATE ON custom_fixed_costs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_variable_costs_updated_at
    BEFORE UPDATE ON custom_variable_costs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();