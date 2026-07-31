import { useEffect, useState } from "react";
import LoginSignupForm from "@/components/auth/LoginSignupForm";
import { capturarConvite } from "@/hooks/useConvite";

export default function Auth() {
  const [convidado, setConvidado] = useState(false);

  // Guarda o token de convite ANTES do login: o fluxo de auth perderia o
  // parâmetro da URL. O aceite acontece no shell autenticado (useAceitarConvite).
  useEffect(() => {
    setConvidado(capturarConvite());
  }, []);

  return (
    <div>
      {convidado && (
        <div className="bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground">
          Você foi convidado para uma equipe no FinanceAI — entre ou crie sua conta para aceitar.
        </div>
      )}
      <LoginSignupForm />
    </div>
  );
}
