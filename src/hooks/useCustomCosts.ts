/**
 * useCustomCosts.ts
 * Hook para gerenciar custos customizados do usuário (fixos e variáveis)
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { CostCategory, Currency } from '@/types';

// ── Types ──────────────────────────────────────────────────────────

export interface CustomFixedCost {
  id: string;
  user_id: string;
  label: string;
  category: CostCategory;
  value: number;
  currency: Currency;
  is_active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface CustomVariableCost {
  id: string;
  user_id: string;
  label: string;
  emoji: string | null;
  type: 'percentage' | 'brl';
  default_value: number;
  per_pax: boolean;
  is_active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

// ── Hook ────────────────────────────────────────────────────────────

export function useCustomCosts() {
  const { user } = useAuth();
  
  const [fixedCosts, setFixedCosts] = useState<CustomFixedCost[]>([]);
  const [variableCosts, setVariableCosts] = useState<CustomVariableCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load custom costs from Supabase ──
  const loadCosts = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);

    try {
      // Load fixed costs
      const { data: fixedData, error: fixedError } = await supabase
        .from('custom_fixed_costs')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('usage_count', { ascending: false });

      if (fixedError) throw fixedError;

      // Load variable costs
      const { data: varData, error: varError } = await supabase
        .from('custom_variable_costs')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('usage_count', { ascending: false });

      if (varError) throw varError;

      setFixedCosts(fixedData ?? []);
      setVariableCosts(varData ?? []);
    } catch (err) {
      console.error('[useCustomCosts] load error:', err);
      setError('Erro ao carregar custos customizados.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) loadCosts();
  }, [user, loadCosts]);

  // ── CRUD Fixed Costs ──

  const addFixedCost = useCallback(async (
    label: string,
    category: CostCategory,
    value: number,
    currency: Currency = 'BRL'
  ): Promise<CustomFixedCost | null> => {
    if (!user) return null;
    
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('custom_fixed_costs')
        .insert({
          user_id: user.id,
          label,
          category,
          value,
          currency,
          is_active: true,
          usage_count: 0,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') return null;
        throw error;
      }

      if (data) {
        setFixedCosts(prev => [data as CustomFixedCost, ...prev]);
        return data as CustomFixedCost;
      }
      return null;
    } catch (err) {
      console.error('[useCustomCosts] addFixedCost error:', err);
      setError('Erro ao adicionar custo fixo.');
      return null;
    } finally {
      setSaving(false);
    }
  }, [user]);

  const updateFixedCost = useCallback(async (
    id: string,
    updates: Partial<Pick<CustomFixedCost, 'label' | 'category' | 'value' | 'currency'>>
  ): Promise<boolean> => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('custom_fixed_costs')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setFixedCosts(prev =>
        prev.map(c => c.id === id ? { ...c, ...updates } : c)
      );
      return true;
    } catch (err) {
      console.error('[useCustomCosts] updateFixedCost error:', err);
      setError('Erro ao atualizar custo fixo.');
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const deleteFixedCost = useCallback(async (id: string): Promise<boolean> => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('custom_fixed_costs')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      setFixedCosts(prev => prev.filter(c => c.id !== id));
      return true;
    } catch (err) {
      console.error('[useCustomCosts] deleteFixedCost error:', err);
      setError('Erro ao excluir custo fixo.');
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const incrementFixedCostUsage = useCallback(async (id: string): Promise<void> => {
    setFixedCosts(prev =>
      prev.map(c => c.id === id ? { ...c, usage_count: c.usage_count + 1 } : c)
    );
  }, []);

  // ── CRUD Variable Costs ──

  const addVariableCost = useCallback(async (
    label: string,
    type: 'percentage' | 'brl',
    defaultValue: number,
    emoji?: string,
    perPax: boolean = true
  ): Promise<CustomVariableCost | null> => {
    if (!user) return null;
    
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('custom_variable_costs')
        .insert({
          user_id: user.id,
          label,
          emoji: emoji ?? null,
          type,
          default_value: defaultValue,
          per_pax: perPax,
          is_active: true,
          usage_count: 0,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') return null;
        throw error;
      }

      if (data) {
        setVariableCosts(prev => [data as CustomVariableCost, ...prev]);
        return data as CustomVariableCost;
      }
      return null;
    } catch (err) {
      console.error('[useCustomCosts] addVariableCost error:', err);
      setError('Erro ao adicionar custo variável.');
      return null;
    } finally {
      setSaving(false);
    }
  }, [user]);

  const updateVariableCost = useCallback(async (
    id: string,
    updates: Partial<Pick<CustomVariableCost, 'label' | 'emoji' | 'type' | 'default_value' | 'per_pax'>>
  ): Promise<boolean> => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('custom_variable_costs')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setVariableCosts(prev =>
        prev.map(c => c.id === id ? { ...c, ...updates } : c)
      );
      return true;
    } catch (err) {
      console.error('[useCustomCosts] updateVariableCost error:', err);
      setError('Erro ao atualizar custo variável.');
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const deleteVariableCost = useCallback(async (id: string): Promise<boolean> => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('custom_variable_costs')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      setVariableCosts(prev => prev.filter(c => c.id !== id));
      return true;
    } catch (err) {
      console.error('[useCustomCosts] deleteVariableCost error:', err);
      setError('Erro ao excluir custo variável.');
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const incrementVariableCostUsage = useCallback(async (id: string): Promise<void> => {
    setVariableCosts(prev =>
      prev.map(c => c.id === id ? { ...c, usage_count: c.usage_count + 1 } : c)
    );
  }, []);

  // ── Import/Export ──

  const exportCosts = useCallback((): string => {
    return JSON.stringify({
      fixedCosts,
      variableCosts,
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }, [fixedCosts, variableCosts]);

  const importCosts = useCallback(async (jsonString: string): Promise<{ success: boolean; message: string }> => {
    try {
      const data = JSON.parse(jsonString);
      
      if (!data.fixedCosts || !data.variableCosts) {
        return { success: false, message: 'Formato inválido.' };
      }

      if (data.fixedCosts.length > 0) {
        const fixedToInsert = data.fixedCosts.map((c: CustomFixedCost) => ({
          user_id: user!.id,
          label: c.label,
          category: c.category,
          value: c.value,
          currency: c.currency,
          is_active: true,
          usage_count: 0,
        }));

        const { error: fixedError } = await supabase
          .from('custom_fixed_costs')
          .upsert(fixedToInsert, { onConflict: 'user_id,label,category' });

        if (fixedError) throw fixedError;
      }

      if (data.variableCosts.length > 0) {
        const varToInsert = data.variableCosts.map((c: CustomVariableCost) => ({
          user_id: user!.id,
          label: c.label,
          emoji: c.emoji,
          type: c.type,
          default_value: c.default_value,
          per_pax: c.per_pax,
          is_active: true,
          usage_count: 0,
        }));

        const { error: varError } = await supabase
          .from('custom_variable_costs')
          .upsert(varToInsert, { onConflict: 'user_id,label' });

        if (varError) throw varError;
      }

      await loadCosts();
      return { success: true, message: 'Custos importados com sucesso!' };
    } catch (err) {
      console.error('[useCustomCosts] import error:', err);
      return { success: false, message: 'Erro ao importar custos.' };
    }
  }, [user, loadCosts]);

  const resetToDefaults = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    setSaving(true);
    try {
      await Promise.all([
        supabase.from('custom_fixed_costs').update({ is_active: false }).eq('user_id', user.id),
        supabase.from('custom_variable_costs').update({ is_active: false }).eq('user_id', user.id),
      ]);

      setFixedCosts([]);
      setVariableCosts([]);
      return true;
    } catch (err) {
      console.error('[useCustomCosts] resetToDefaults error:', err);
      setError('Erro ao restaurar padrões.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [user]);

  return {
    fixedCosts,
    variableCosts,
    loading,
    saving,
    error,
    addFixedCost,
    updateFixedCost,
    deleteFixedCost,
    incrementFixedCostUsage,
    addVariableCost,
    updateVariableCost,
    deleteVariableCost,
    incrementVariableCostUsage,
    exportCosts,
    importCosts,
    resetToDefaults,
    reload: loadCosts,
  };
}