import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_TOUR_DISMISSED_KEY, DEMO_TOUR_STEP_KEY } from "@/lib/demo";

/**
 * Entrar na demonstração guiada, de um jeito só.
 *
 * A tela de login e o aviso do projeto original oferecem o mesmo botão. Duas
 * cópias do fluxo divergiriam com o tempo — e a que divergisse seria a que
 * esquece de zerar o passo do tour, deixando o visitante cair no meio de um
 * roteiro que ele não começou.
 */
export function useEntrarNaDemonstracao() {
  const [entrando, setEntrando] = useState(false);
  const navigate = useNavigate();

  async function entrar() {
    setEntrando(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });
    if (error) {
      // No template whitelabel o banco nasce vazio: a conta de demonstração só
      // existe onde alguém rodou supabase/seed-demo.sql.
      toast.error("Este ambiente não tem conta de demonstração. Crie a sua conta para começar.");
      setEntrando(false);
      return;
    }
    sessionStorage.setItem(DEMO_TOUR_STEP_KEY, "0");
    sessionStorage.removeItem(DEMO_TOUR_DISMISSED_KEY);
    navigate("/dashboard");
  }

  return { entrar, entrando };
}
