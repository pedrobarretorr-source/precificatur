import { useState, useEffect, useRef, useCallback } from 'react';
import type { Route, RouteType, Currency } from '@/types';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbRow = Record<string, any>;

function toDbRow(
  route: Partial<Route> & { id: string },
  orgId: string,
  userId: string,
): DbRow {
  return {
    id: route.id,
    organization_id: orgId,
    created_by: userId,
    name: route.name || 'Sem nome',
    destination: route.region ?? '',
    route_type: route.type ?? 'outro',
    currency: route.currency ?? 'BRL',
    exchange_rate: 1.0,
    duration_days: Math.max(1, route.days?.length ?? 1),
    fixed_costs: route.fixedCosts ?? [],
    variable_costs: route.variableCosts ?? [],
    days: route.days ?? [],
    updated_at: new Date().toISOString(),
    metadata: {
      client: route.client ?? '',
      date: route.date ?? '',
      contact: route.contact ?? '',
      notes: route.notes ?? '',
      isMultiDay: route.isMultiDay ?? false,
      estimatedPrice: route.estimatedPrice ?? 0,
      simulationPax: route.simulationPax ?? 0,
      isExplorationMode: route.isExplorationMode ?? false,
      maxPax: route.maxPax ?? 30,
    },
  };
}

function fromDbRow(row: DbRow): Route {
  const meta: DbRow = row.metadata ?? {};
  return {
    id: row.id as string,
    name: (row.name as string) || '',
    region: (row.destination as string) || '',
    type: (row.route_type as RouteType) || 'outro',
    currency: (row.currency as Currency) || 'BRL',
    fixedCosts: (row.fixed_costs as Route['fixedCosts']) || [],
    variableCosts: (row.variable_costs as Route['variableCosts']) || [],
    days: (row.days as Route['days']) || [],
    updatedAt: (row.updated_at as string) || '',
    createdAt: (row.created_at as string) || '',
    client: (meta.client as string) || '',
    date: (meta.date as string) || '',
    contact: (meta.contact as string) || '',
    notes: (meta.notes as string) || '',
    isMultiDay: (meta.isMultiDay as boolean) || false,
    estimatedPrice: (meta.estimatedPrice as number) || 0,
    simulationPax: (meta.simulationPax as number) || 0,
    isExplorationMode: (meta.isExplorationMode as boolean) ?? false,
    maxPax: (meta.maxPax as number) ?? 30,
  };
}

export function useRoutes() {
  const { user } = useAuth();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const orgIdRef = useRef<string | null>(null);

  const loadRoutes = useCallback(async (orgId: string) => {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('routes')
      .select('*')
      .eq('organization_id', orgId)
      .order('updated_at', { ascending: false });

    if (fetchError) {
      setError('Erro ao carregar roteiros.');
    } else {
      setRoutes((data ?? []).map((row) => fromDbRow(row as DbRow)));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;

    async function init() {
      const { data: memberData, error: memberError } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user!.id)
        .single();

      console.log('[useRoutes] init result:', { memberData, memberError, userId: user!.id });

      if (memberError || !memberData?.organization_id) {
        const detail = memberError
          ? `código ${memberError.code}: ${memberError.message}`
          : 'nenhuma organização vinculada ao usuário';
        console.error('[useRoutes] init falhou:', detail);
        setError(`Organização não encontrada (${detail}). Rode o SQL de backfill e recarregue.`);
        setLoading(false);
        return;
      }

      orgIdRef.current = memberData.organization_id as string;
      await loadRoutes(memberData.organization_id as string);
    }

    init();
  }, [user, loadRoutes]);

  const saveRoute = useCallback(
    async (route: Partial<Route> & { id: string }): Promise<string | null> => {
      const orgId = orgIdRef.current;
      if (!orgId || !user) {
        const msg = 'Organização não encontrada. Execute o SQL de configuração no Supabase e recarregue a página.';
        console.error('[useRoutes] saveRoute: orgId ou user ausente', { orgId, userId: user?.id });
        setError(msg);
        return msg;
      }

      setSaving(true);
      const { data, error: upsertError } = await supabase
        .from('routes')
        .upsert(toDbRow(route, orgId, user.id), { onConflict: 'id' })
        .select()
        .single();

      if (upsertError) {
        const msg = `Erro ao salvar: ${upsertError.message}`;
        console.error('[useRoutes] saveRoute: erro no upsert', upsertError);
        setError(msg);
        setSaving(false);
        return msg;
      }

      if (data) {
        const saved = fromDbRow(data as DbRow);
        setRoutes((prev) => {
          const idx = prev.findIndex((r) => r.id === saved.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = saved;
            return next;
          }
          return [saved, ...prev];
        });
      }
      setSaving(false);
      return null;
    },
    [user],
  );

  const deleteRoute = useCallback(
    async (id: string) => {
      setRoutes((prev) => prev.filter((r) => r.id !== id));

      const { error: deleteError } = await supabase
        .from('routes')
        .delete()
        .eq('id', id);

      if (deleteError) {
        setError('Erro ao excluir roteiro.');
        if (orgIdRef.current) await loadRoutes(orgIdRef.current);
      }
    },
    [loadRoutes],
  );

  return { routes, loading, saving, error, saveRoute, deleteRoute } as const;
}
