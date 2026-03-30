# Access Code Authentication — Beta

**Data:** 2026-03-29
**Status:** Aprovado

## Contexto

O app esta em beta fechado. Em vez de login tradicional (email/senha), o acesso e controlado por **codigos de acesso individuais** criados pelo admin. Cada usuario recebe um codigo unico que serve como chave permanente durante a beta. Apos a beta, os usuarios ja terao conta Supabase criada e poderao migrar para login normal.

## Hashing do codigo

O codigo e usado como senha no Supabase Auth. O hash e gerado no frontend com `crypto.subtle.digest` (Web Crypto API, nativa no browser):

```ts
// src/lib/hashCode.ts
export async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

Esta funcao e chamada tanto no `signUp` quanto no `signInWithPassword`. Nao adicionar bibliotecas externas para hashing.

## Fluxo de autenticacao

### Primeiro acesso
1. Usuario insere o codigo na tela de acesso
2. Frontend chama RPC `validate_access_code(code)` — funcao Postgres SECURITY DEFINER
3. Funcao retorna `{valid: true, status: 'active', email: null, name: null}`
4. Frontend exibe formulario de registro: Nome + E-mail
5. Frontend chama `supabase.auth.signUp({ email, password: await hashCode(code), options: { data: { full_name: name } } })`
6. Trigger `on_auth_user_created` cria `profile`, `organization` e `organization_member` automaticamente (usando `full_name` do `raw_user_meta_data`)
7. Verificar que `data.session` nao e null (confirmacao de email esta desabilitada, entao `signUp` retorna sessao imediatamente). Usar `data.user.id` como `user_id`. Se `data.session` for null, exibir erro generico e nao prosseguir.
8. Frontend chama RPC `use_access_code(code, name, email, data.user.id)` — vincula o codigo ao usuario e marca como `used`. Se retornar `false`, exibir erro generico.
9. Usuario entra no app

### Retorno (codigo ja vinculado)
1. Usuario insere o mesmo codigo
2. RPC `validate_access_code(code)` retorna `{valid: true, status: 'used', email: 'x@x.com'}`
3. Frontend chama `supabase.auth.signInWithPassword({ email, password: await hashCode(code) })`
4. Usuario entra no app diretamente, sem formulario

### Erros
- Codigo nao existe → "Codigo invalido"
- Status `expired` → "Este codigo expirou. Entre em contato com o administrador."
- Status `revoked` → "Codigo invalido"
- Email ja registrado com outro codigo → erro generico (nao revelar)

## Banco de dados

### Tabela `access_codes`

```sql
CREATE TABLE access_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text UNIQUE NOT NULL,
  status      text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'used', 'expired', 'revoked')),
  expires_at  timestamptz,
  user_id     uuid REFERENCES auth.users(id),
  name        text,
  email       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

### RLS

Tabela `access_codes` com RLS habilitado. Apenas admins tem acesso direto; todos os demais acessam somente via funcoes SECURITY DEFINER.

```sql
ALTER TABLE access_codes ENABLE ROW LEVEL SECURITY;

-- Somente admins tem acesso direto a tabela (leitura e escrita)
CREATE POLICY "admin_access_codes" ON public.access_codes
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );
```

Usuarios nao-admin (incluindo anon) so acessam via `validate_access_code` e `use_access_code`.

### Campo `is_admin` em `profiles`

```sql
ALTER TABLE profiles ADD COLUMN is_admin boolean NOT NULL DEFAULT false;
```

### Funcoes Postgres (SECURITY DEFINER)

**`validate_access_code(p_code text)`**
- Retorna: `TABLE(valid bool, status text, email text, name text)`
- Logica:
  1. Busca o codigo na tabela
  2. Se nao encontrado: retorna `(false, null, null, null)`
  3. Se `expires_at IS NOT NULL AND expires_at < now() AND status = 'active'`: atualiza `status = 'expired'` na tabela antes de retornar
  4. Retorna `(true, status, email, name)` com os dados atualizados
- Chamada por usuarios nao autenticados (anon key)

**`use_access_code(p_code text, p_name text, p_email text, p_user_id uuid)`**
- Retorna: `bool`
- Logica:
  1. Guard: verifica `auth.uid() = p_user_id` — se falhar, retorna `false` sem raise
  2. Guard: busca o codigo e verifica `status = 'active'` — se nao for active, retorna `false`
  3. Atualiza o registro: `user_id = p_user_id`, `name = p_name`, `email = p_email`, `status = 'used'`
  4. Retorna `true`
- Chamada logo apos `signUp` bem-sucedido
- Nao armazena o codigo raw como senha em nenhum campo

### Migracao

Nova migracao: `supabase/migrations/20260329000000_access_codes.sql`

## Tela de acesso (`AccessCodePage`)

Substitui `AuthPage`. Componente em `src/pages/AccessCodePage.tsx`.

### Estado interno
- `step: 'code' | 'register'`
- `code: string`
- `name: string`, `email: string`
- `loading: boolean`
- `error: string | null`

### UI — Etapa 1 (code)
- Logo centralizado
- Campo "Codigo de acesso" (input grande, placeholder "PREC-XXXX-XXXX")
- Botao "Entrar"
- Mensagem de erro inline

### UI — Etapa 2 (register) — so aparece em primeiro acesso
- Texto: "Bem-vindo! Complete seu cadastro para continuar."
- Campo "Nome completo"
- Campo "E-mail"
- Botao "Confirmar e entrar"

### Integracao com App.tsx
- Remover comentario do auth bypass
- Se `!user && !loading` → renderizar `<AccessCodePage />`

## Pagina Admin (`AdminPage`)

Componente em `src/pages/AdminPage.tsx`.

### Acesso
- Rota logica dentro do app (`activePage === 'admin'`)
- Item "Admin" na sidebar visivel somente se `profile.is_admin === true`
- Se usuario tentar acessar sem `is_admin`, redireciona para dashboard

### Hook `useAdminCodes`

`src/hooks/useAdminCodes.ts`

- `codes: AccessCode[]` — lista completa
- `loading: boolean`
- `createCode(expiresAt?: Date): Promise<string>` — gera codigo `PREC-XXXX-XXXX` com caracteres `[A-Z2-9]` (excluindo 0, O, 1, I para evitar ambiguidade), insere na tabela, retorna o codigo. Em caso de conflito UNIQUE, tenta uma segunda vez; se falhar novamente, lanca erro.
- `revokeCode(id: string): Promise<void>` — muda status para `revoked` (valido para qualquer status atual)

### UI — Stats

4 cards no topo: Total | Ativos | Usados | Expirados

Os contadores usam o campo `status` diretamente (nao recalculam a partir de `expires_at`, pois `validate_access_code` ja atualiza `status` para `'expired'` quando necessario).

### UI — Lista de codigos

Tabela/lista com colunas:
- Codigo (texto + botao copiar)
- Status (badge: verde=Ativo, azul=Usado, vermelho=Expirado/Revogado)
- Expiracao (data formatada ou "Sem expiracao")
- Usuario (nome + email ou "—")
- Acao: botao "Revogar" (somente para status `active` ou `used`)

### UI — Criar codigo

Botao "Novo codigo" abre painel inline (nao modal):
- Date picker "Expiracao" (opcional)
- Botao "Gerar codigo"
- Apos gerar: exibe o codigo com botao copiar destacado

## AuthContext

`src/contexts/AuthContext.tsx` — adicionar `profile` ao contexto.

### Tipo
```ts
type Profile = { is_admin: boolean } | null;
```

### Fetch
Apos `onAuthStateChange` disparar com sessao ativa, buscar o perfil:
```ts
const { data } = await supabase
  .from('profiles')
  .select('is_admin')
  .eq('id', session.user.id)
  .single();
setProfile(data ?? null);
```

### Estado de loading
O `loading` do `AuthContext` so deve ser `false` quando ambos `user` e `profile` tiverem sido resolvidos (ou forem null). Isso evita flash de conteudo enquanto `is_admin` ainda nao foi carregado.

Quando `onAuthStateChange` disparar com `session = null` (sign-out), chamar `setProfile(null)` imediatamente, antes de qualquer fetch, para evitar que estado admin obsoleto persista entre sessoes.

## Arquivos impactados

| Arquivo | Acao |
|---------|------|
| `supabase/migrations/20260329000000_access_codes.sql` | Criar |
| `src/lib/hashCode.ts` | Criar |
| `src/pages/AccessCodePage.tsx` | Criar |
| `src/pages/AdminPage.tsx` | Criar |
| `src/hooks/useAdminCodes.ts` | Criar |
| `src/contexts/AuthContext.tsx` | Adicionar `profile: Profile` ao contexto e ao provider |
| `src/App.tsx` | Re-habilitar auth gate, usar `AccessCodePage`, adicionar rota admin |
| `src/components/layout/Sidebar.tsx` | Mostrar item Admin condicionalmente |

## Fora de escopo

- OAuth (Google/Facebook) — removido da tela de acesso na beta
- "Esqueci minha senha" — nao se aplica
- Confirmacao de email — desabilitada no Supabase para a beta (login imediato apos signUp)
- Transicao pos-beta para login com senha — futura iteracao
- Criacao de codigos em lote (bulk) — uma por vez via admin panel
