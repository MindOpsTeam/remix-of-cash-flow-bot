
# Mover Login para a rota /

## Objetivo
A rota `/` passara a exibir o formulario de login/cadastro. Apos login, o usuario sera redirecionado para `/dashboard`.

## Alteracoes

### 1. `src/App.tsx`
- Trocar a rota `/` para exibir `Auth` como PublicRoute (redireciona para `/dashboard` se ja logado)
- Mover o Dashboard para a rota `/dashboard` como ProtectedRoute
- Atualizar redirecionamento do PublicRoute: de `"/"` para `"/dashboard"`
- Atualizar redirecionamento do ProtectedRoute (fallback): de `"/auth"` para `"/"`

### 2. `src/pages/Auth.tsx`
- Apos login com sucesso, `navigate("/")` muda para `navigate("/dashboard")`

### 3. `src/components/AppSidebar.tsx` (se houver link para `/`)
- Atualizar link do dashboard de `/` para `/dashboard`

### 4. Demais referencias
- Qualquer link ou `navigate("/")` no projeto que aponte para o dashboard precisara apontar para `/dashboard`
- A rota `/auth` sera removida (o login agora vive em `/`)

## Resumo de rotas
```text
/            -> Auth (PublicRoute) - redireciona para /dashboard se logado
/dashboard   -> Dashboard (ProtectedRoute) - redireciona para / se nao logado
/transactions, /dre, etc -> sem mudanca (ProtectedRoute, redireciona para /)
```
