## Adicionar aviso de uso consciente na tela de login

### Arquivo alterado

**`src/components/auth/LoginSignupForm.tsx`**

1. Importar `AlertTriangle` de `lucide-react`.
2. Adicionar bloco `<div className="lsf-disclaimer">` dentro do `.lsf-wrapper`, logo após o `.lsf-container`.
3. Adicionar CSS escopado no `<style>` existente (mesmo padrão do resto do componente — Poppins, cores hardcoded, fora do design system).

### Conteúdo do aviso (PT-BR)

Título: **Uso consciente e responsabilidade**

Texto:
> Esta plataforma processa dados financeiros sensíveis. Recomendamos fortemente o acompanhamento por **auditorias de segurança regulares** e a adoção de boas práticas de proteção de credenciais e acessos.
>
> A **Viver de IA** não se responsabiliza por eventuais falhas, perdas ou incidentes ocorridos em produção. A manutenção, o monitoramento e o nível de qualidade de segurança da plataforma são de **responsabilidade exclusiva do cliente**.

### Estilo

- `max-width: 850px`, alinhado ao container
- Fundo `rgba(255,255,255,.75)` com `backdrop-filter: blur(8px)`
- Borda esquerda `4px solid #f59e0b` (âmbar, sinaliza aviso)
- `border-radius: 12px`, padding `16px 20px`, `margin-top: 20px`
- Layout flex: ícone âmbar à esquerda + coluna título/corpo
- Texto `13px`, cor `#444`, título `600` em `#1f2937`
- Responsivo: em ≤650px reduz padding e largura segue o wrapper

### Fora de escopo

- Sem checkbox "Li e aceito".
- Sem alterações em `Auth.tsx`, rotas ou lógica de auth.
- Sem nova rota de Termos/Política (posso adicionar depois se quiser).