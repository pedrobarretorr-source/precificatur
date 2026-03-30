# Access Code Authentication — Beta

**Data:** 2026-03-29
**Status:** Aprovado

## Contexto

O app esta em beta fechado. Em vez de login tradicional (email/senha), o acesso e controlado por **codigos de acesso individuais** criados pelo admin. Cada usuario recebe um codigo unico que serve como chave permanente durante a beta. Apos a beta, os usuarios ja terao conta Supabase criada e poderao migrar para login normal.

## Fluxo de autenticacao

### Primeiro acesso
1. Usuario insere o codigo na tela de acesso
2. Frontend chama RPC `validate_access_code(code)` — funcao Postgres SECURITY DEFINER
3. Funcao retorna `{valid: true, status: 'active', email: null, name: null}`
4. Frontend exibe formulario de registro: Nome + E-mail
5. Frontend chama `supabase.auth.signUp(email, sha256(code))`
6. Trigger `on_auth_user_created` cria `profile`, `organization` e `organization_member` automaticamente
7. Frontend chama RPC `use_access_code(code, name, email, user_id)` — vincula o codigo ao usuario e marca como `used`
8. Usuario entra no app

### Retorno (codigo ja vinculado)
1. Usuario insere o mesmo codigo
2. RPC `validate_access_code(code)` retorna `{valid: true, status: 'used', email: 'x@x.com'}`
3. Frontend chama `supabase.auth.signInWithPassword(email, sha256(code))`
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

- Tabela `access_codes` totalmente bloqueada para todos os usuarios (incluindo autenticados)
- Somente usuarios com `profiles.is_admin = true` tem acesso direto via RLS
- Acesso publico apenas via funcoes SECURITY DEFINER

### Campo `is_admin` em `profiles`

```sql
ALTER TABLE profiles ADD COLUMN is_admin boolean NOT NULL DEFAULT false;
```

### Funcoes Postgres (SECURITY DEFINER)

**`validate_access_code(p_code text)`**
- Retorna: `TABLE(valid bool, status text, email text, name text)`
- Logica: busca o codigo, checa expiracao, retorna dados minimos
- Chamada por usuarios nao autenticados (anon key)

**`use_access_code(p_code text, p_name text, p_email text, p_user_id uuid)`**
- Retorna: `bool`
- Logica: atualiza o registro com `user_id`, `name`, `email`, `status = 'used'`
- Chamada logo apos `signUp` bem-sucedido

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
- `createCode(expiresAt?: Date): Promise<string>` — gera codigo `PREC-XXXX-XXXX`, insere na tabela, retorna o codigo
- `revokeCode(id: string): Promise<void>` — muda status para `revoked`

### UI — Stats

4 cards no topo: Total | Ativos | Usados | Expirados

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

## Arquivos impactados

| Arquivo | Acao |
|---------|------|
| `supabase/migrations/20260329000000_access_codes.sql` | Criar |
| `src/pages/AccessCodePage.tsx` | Criar |
| `src/pages/AdminPage.tsx` | Criar |
| `src/hooks/useAdminCodes.ts` | Criar |
| `src/contexts/AuthContext.tsx` | Adicionar `profile` com `is_admin` ao contexto |
| `src/App.tsx` | Re-habilitar auth gate, usar `AccessCodePage`, adicionar rota admin |
| `src/components/layout/Sidebar.tsx` | Mostrar item Admin condicionalmente |

## Fora de escopo

- OAuth (Google/Facebook) — removido da tela de acesso na beta
- "Esqueci minha senha" — nao se aplica
- Confirmacao de email — desabilitada no Supabase para a beta (login imediato apos signUp)
- Transicao pos-beta para login com senha — futura iteracao
