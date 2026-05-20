## Objetivo

Substituir o visual da página `/` (Auth) por um componente animado de login/signup com painel deslizante (estilo "sliding panel"), mantendo 100% da funcionalidade atual: signup com Supabase, login com Supabase, toasts, redirect para `/dashboard`, validações.

## Observação sobre o código colado

O snippet enviado veio com o JSX e o bloco `<style jsx>` quebrados (tags removidas pelo parser do chat). Vou reconstruir fielmente o componente a partir do CSS/estrutura visível — mesma animação, mesmas classes, mesmo layout 850×550 com `toggle-box` deslizante.

## Arquivos

### 1. `src/components/auth/LoginSignupForm.tsx` (novo)

Componente apresentacional + lógico:

- Estado local: `isActive` (toggle login/registro), `email`, `password`, `name` (apenas no registro), `loading`.
- Handlers `handleLogin` e `handleSignup` chamando `supabase.auth.signInWithPassword` / `supabase.auth.signUp` — mesma lógica que está hoje em `src/pages/Auth.tsx` (mesmas mensagens via `sonner`, mesmo `emailRedirectTo`, mesmo `navigate("/dashboard")`).
- Estrutura JSX fiel ao snippet:
  - `.container` (com classe condicional `active`)
  - `.form-box.login` → form de login (email, password, "Forgot Password?", botão Login, ícones sociais decorativos)
  - `.form-box.register` → form de cadastro (name, email, password, botão Register, ícones sociais decorativos)
  - `.toggle-box` com `.toggle-panel.toggle-left` ("Hello, Welcome!" + botão Register) e `.toggle-panel.toggle-right` ("Welcome Back!" + botão Login)
- Ícones do `lucide-react` (`User`, `Lock`, `Mail`) substituindo os `<i>` do snippet original, posicionados absolutamente no input (mesmo CSS).
- Ícones sociais (`Github`, `Facebook`, `Linkedin` + Google) ficam **decorativos** (sem handler). Não vou implementar OAuth — não foi pedido e fugiria do "mesmo funcionamento".
- CSS injetado via `<style>{`...`}</style>` dentro do componente, exatamente como no snippet (cores `#7494ec`, fundo `#eee` nos inputs, fonte Poppins via `@import`, responsivo em 650px e 400px).
- Texto traduzido para PT-BR para casar com o resto do app ("Entrar", "Cadastro", "Esqueceu a senha?", "Olá, bem-vindo!", "Não tem conta?", etc.).

### 2. `src/pages/Auth.tsx` (substituir conteúdo)

Trocar todo o JSX atual por:

```tsx
import LoginSignupForm from "@/components/auth/LoginSignupForm";

export default function Auth() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#c9d6ff] bg-gradient-to-r from-[#e2e2e2] to-[#c9d6ff]">
      <LoginSignupForm />
    </div>
  );
}
```

(fundo gradient que é o padrão desse tipo de template; pode ser ajustado depois)

## O que NÃO vou fazer

- Não vou alterar `useAuth`, rotas, `PublicRoute`, ou redirect logic.
- Não vou tocar em `index.css` nem `tailwind.config.ts` — todo o estilo do componente é escopado via `<style>` inline (como pedido no snippet original).
- Não vou implementar login social (decorativo apenas).
- Não vou criar testes (mudança puramente visual sem nova lógica).

## Pontos de atenção

- O design system do projeto usa tokens HSL e fonte Inter. Esse novo componente quebra propositalmente esse padrão (Poppins, cores hardcoded `#7494ec`) porque é o ponto da animação. Fica isolado em `src/components/auth/` e não vaza para o resto do app. Se quiser depois adaptar pros tokens do design system, é trivial.
- A página `/` não tem mais logo nem "FinanceAI" — quer que eu mantenha o logo do app acima/dentro do container, ou o visual fica puro como no template?

Responde só essa última pergunta (logo sim/não) que eu já implemento.