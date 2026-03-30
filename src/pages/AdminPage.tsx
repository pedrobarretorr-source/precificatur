import { useState } from 'react';
import { Shield, Copy, Check, Ban, Plus, Loader2, Calendar } from 'lucide-react';
import { useAdminCodes, type AccessCode } from '@/hooks/useAdminCodes';
import { cn } from '@/lib/utils';

const STATUS_BADGE: Record<AccessCode['status'], string> = {
  active:  'bg-emerald-100 text-emerald-700 border-emerald-200',
  used:    'bg-brand-blue/10 text-brand-blue border-brand-blue/20',
  expired: 'bg-red-100 text-red-600 border-red-200',
  revoked: 'bg-surface-200 text-surface-500 border-surface-300',
};

const STATUS_LABEL: Record<AccessCode['status'], string> = {
  active:  'Ativo',
  used:    'Usado',
  expired: 'Expirado',
  revoked: 'Revogado',
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-lg text-surface-400 hover:text-brand-navy hover:bg-surface-100 transition-all"
      title="Copiar"
    >
      {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
    </button>
  );
}

export function AdminPage() {
  const { codes, loading, createCode, revokeCode } = useAdminCodes();
  const [showCreate, setShowCreate] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [creating, setCreating] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const total   = codes.length;
  const active  = codes.filter(c => c.status === 'active').length;
  const used    = codes.filter(c => c.status === 'used').length;
  const expired = codes.filter(c => c.status === 'expired').length;

  async function handleCreate() {
    setCreating(true);
    setCreateError(null);
    setNewCode(null);
    try {
      const code = await createCode(expiresAt ? new Date(expiresAt) : undefined);
      setNewCode(code);
      setExpiresAt('');
    } catch (e) {
      setCreateError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center">
          <Shield size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-brand-navy">Admin</h1>
          <p className="text-sm text-surface-500">Gerencie os códigos de acesso beta</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',    value: total,   color: 'text-brand-navy' },
          { label: 'Ativos',   value: active,  color: 'text-emerald-600' },
          { label: 'Usados',   value: used,    color: 'text-brand-blue' },
          { label: 'Expirados',value: expired, color: 'text-red-500' },
        ].map(stat => (
          <div key={stat.label} className="card text-center py-4">
            <p className={cn('text-3xl font-extrabold', stat.color)}>{stat.value}</p>
            <p className="text-xs text-surface-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Create code */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-brand-navy">Códigos de acesso</h3>
          <button
            onClick={() => { setShowCreate(!showCreate); setNewCode(null); setCreateError(null); }}
            className="btn-primary btn-sm flex items-center gap-1.5"
          >
            <Plus size={16} /> Novo código
          </button>
        </div>

        {/* Create panel */}
        {showCreate && (
          <div className="mb-4 p-4 rounded-xl bg-surface-50 border border-surface-200 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="input-label flex items-center gap-1.5">
                  <Calendar size={12} /> Expiração (opcional)
                </label>
                <input
                  type="date"
                  className="input text-sm"
                  value={expiresAt}
                  onChange={e => setExpiresAt(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="btn-primary btn-sm"
              >
                {creating ? <Loader2 size={16} className="animate-spin" /> : 'Gerar código'}
              </button>
            </div>

            {createError && (
              <p className="text-xs text-red-500">{createError}</p>
            )}

            {newCode && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="font-mono font-bold text-emerald-700 tracking-widest flex-1">{newCode}</span>
                <CopyButton text={newCode} />
              </div>
            )}
          </div>
        )}

        {/* Code list */}
        {loading ? (
          <div className="flex items-center justify-center py-8 text-surface-400">
            <Loader2 size={20} className="animate-spin mr-2" /> Carregando...
          </div>
        ) : codes.length === 0 ? (
          <p className="text-center text-sm text-surface-400 py-8">
            Nenhum código criado ainda.
          </p>
        ) : (
          <div className="space-y-2">
            {codes.map(c => (
              <div
                key={c.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 border border-surface-100 flex-wrap"
              >
                {/* Code */}
                <div className="flex items-center gap-1 min-w-[140px]">
                  <span className="font-mono font-bold text-sm text-brand-navy tracking-wider">{c.code}</span>
                  <CopyButton text={c.code} />
                </div>

                {/* Status badge */}
                <span className={cn(
                  'text-[11px] font-bold px-2 py-0.5 rounded-full border',
                  STATUS_BADGE[c.status]
                )}>
                  {STATUS_LABEL[c.status]}
                </span>

                {/* Expiry */}
                <span className="text-xs text-surface-500 flex-1">
                  {c.expires_at
                    ? new Date(c.expires_at).toLocaleDateString('pt-BR')
                    : 'Sem expiração'}
                </span>

                {/* User */}
                <span className="text-xs text-surface-600 max-w-[200px] truncate">
                  {c.name ? `${c.name} · ${c.email}` : '—'}
                </span>

                {/* Revoke */}
                {(c.status === 'active' || c.status === 'used') && (
                  <button
                    onClick={() => revokeCode(c.id)}
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700
                               px-2 py-1 rounded-lg hover:bg-red-50 transition-all border border-red-200 flex-shrink-0"
                  >
                    <Ban size={12} /> Revogar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
