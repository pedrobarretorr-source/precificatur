import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface AccessCode {
  id: string;
  code: string;
  status: 'active' | 'used' | 'expired' | 'revoked';
  expires_at: string | null;
  user_id: string | null;
  name: string | null;
  email: string | null;
  created_at: string;
}

// Visually unambiguous characters: no 0/O, no 1/I
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  const rand = (n: number) =>
    Array.from({ length: n }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
  return `PREC-${rand(4)}-${rand(4)}`;
}

export function useAdminCodes() {
  const [codes, setCodes] = useState<AccessCode[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCodes = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('access_codes')
      .select('*')
      .order('created_at', { ascending: false });
    setCodes((data as AccessCode[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCodes();
  }, [loadCodes]);

  async function createCode(expiresAt?: Date): Promise<string> {
    let code = generateCode();

    const { error } = await supabase
      .from('access_codes')
      .insert({ code, expires_at: expiresAt?.toISOString() ?? null });

    if (error?.code === '23505') {
      // UNIQUE conflict — try once more
      code = generateCode();
      const { error: error2 } = await supabase
        .from('access_codes')
        .insert({ code, expires_at: expiresAt?.toISOString() ?? null });
      if (error2) throw new Error('Falha ao gerar código único. Tente novamente.');
    } else if (error) {
      throw new Error('Erro ao criar código.');
    }

    await loadCodes();
    return code;
  }

  async function revokeCode(id: string): Promise<void> {
    await supabase
      .from('access_codes')
      .update({ status: 'revoked' })
      .eq('id', id);
    await loadCodes();
  }

  return { codes, loading, createCode, revokeCode };
}
