import { supabase } from "@/integrations/supabase/client";

/**
 * RPCs do modo template (`plataforma_bloqueada`, `sou_dono_da_plataforma`).
 *
 * Elas nascem numa migration nova, então ainda não constam nos tipos gerados do
 * Supabase — o cast fica isolado aqui em vez de espalhar `any` pelos hooks.
 * Quando os tipos forem regenerados, basta apagar este arquivo e chamar direto.
 */
type RpcSemTipo = (nome: string) => Promise<{ data: unknown; error: unknown }>;

async function rpcBooleana(nome: string): Promise<boolean> {
  try {
    const { data } = await (supabase.rpc as unknown as RpcSemTipo)(nome);
    return data === true;
  } catch {
    // Base antiga (sem a migration) responde como "não travado / não sou dono":
    // falhar para o lado seguro nunca bloqueia o usuário.
    return false;
  }
}

/** Estamos no banco original do template (escrita bloqueada)? */
export const plataformaBloqueada = () => rpcBooleana("plataforma_bloqueada");

/** Sou o primeiro usuário cadastrado, o dono da instalação? */
export const souDonoDaPlataforma = () => rpcBooleana("sou_dono_da_plataforma");
