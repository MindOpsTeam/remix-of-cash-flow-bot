#!/usr/bin/env node
/**
 * Vigia do projeto original: avisa quando alguém edita por prompt no Lovable.
 *
 * Não há como IMPEDIR a edição — quem tem acesso de editor manda no agente do
 * Lovable, e ele não roda hook nosso. O que dá para fazer é descobrir em
 * minutos, em vez de por acaso semanas depois. Foi assim que um módulo inteiro
 * de terceiro (STAY, hospedagem) passou três dias dentro do template.
 *
 * O SINAL: toda edição pelo agente do Lovable vira commit de
 * `gpt-engineer-app[bot]` no repositório sincronizado. Isso é observável só com
 * o `gh`, sem precisar de credencial da API do Lovable — que não existe para
 * este projeto. Commit assinado por gente é meu e nunca alarma.
 *
 * Alarma em TODO commit do bot, inclusive nos de sincronização ("Lovable
 * update", "Work in progress"), e diz qual é qual. Filtrar por mensagem
 * economizaria um aviso por push meu e deixaria passar o vândalo que por acaso
 * produzisse a mesma mensagem: ruído de leitura de cinco segundos é mais barato
 * que silêncio sobre uma edição real.
 *
 * Uso:  node scripts/vigia-original.mjs [--seco]
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "MindOpsTeam/remix-of-cash-flow-bot";
const BOT = "gpt-engineer-app[bot]";
/** Mensagens que o próprio gitsync gera ao espelhar um push meu. */
const RUIDO_DE_SYNC = new Set(["Lovable update", "Work in progress"]);

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const ARQUIVO_ESTADO = join(raiz, ".hermes", "state", "vigia-original.json");
const seco = process.argv.includes("--seco");

function sh(cmd, args) {
  return execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
}

function lerEstado() {
  try {
    return JSON.parse(readFileSync(ARQUIVO_ESTADO, "utf8"));
  } catch {
    return { ultimoVisto: null, ultimoBom: null };
  }
}

function gravarEstado(estado) {
  mkdirSync(dirname(ARQUIVO_ESTADO), { recursive: true });
  writeFileSync(ARQUIVO_ESTADO, JSON.stringify(estado, null, 2) + "\n");
}

function avisar(titulo, corpo) {
  // Notificação primeiro: é o que chega na hora. O TODO é o que sobrevive a
  // fechar o notification center sem ler.
  try {
    const esc = (t) => t.replace(/["\\]/g, "\\$&");
    sh("osascript", ["-e", `display notification "${esc(corpo)}" with title "${esc(titulo)}" sound name "Basso"`]);
  } catch { /* sem GUI (cron, ssh): o TODO abaixo continua valendo */ }
}

function registrarTodo(texto) {
  try {
    sh("bash", ["-lc", `todo ${JSON.stringify(texto + " #via")}`]);
  } catch { /* o TODO é reforço, não pode derrubar o vigia */ }
}

const commits = JSON.parse(
  sh("gh", ["api", `repos/${REPO}/commits?sha=main&per_page=30`,
            "--jq", "[.[] | {sha: .sha[0:7], autor: .commit.author.name, msg: (.commit.message|split(\"\\n\")[0]), data: .commit.author.date}]"]),
);

const estado = lerEstado();
const ultimoBom = commits.find((c) => c.autor !== BOT) ?? null;

// Tudo que entrou depois do que já vimos. Sem marca d'água (primeira execução),
// não alarma o histórico inteiro: só registra onde estamos e fica de sentinela.
const idx = estado.ultimoVisto ? commits.findIndex((c) => c.sha === estado.ultimoVisto) : -1;
const novos = estado.ultimoVisto === null ? [] : commits.slice(0, idx === -1 ? commits.length : idx);
const doBot = novos.filter((c) => c.autor === BOT);

if (doBot.length > 0) {
  const suspeitos = doBot.filter((c) => !RUIDO_DE_SYNC.has(c.msg));
  const grave = suspeitos.length > 0;
  const lista = doBot.map((c) => `${c.sha} "${c.msg}"`).join(" · ");
  const titulo = grave
    ? `⚠️ Editaram o projeto ORIGINAL (${suspeitos.length})`
    : `Lovable sincronizou (${doBot.length})`;
  const corpo = `${lista}${ultimoBom ? ` — último bom: ${ultimoBom.sha}` : ""}`;

  console.log(`${titulo}\n${corpo}`);
  if (!seco) {
    avisar(titulo, corpo);
    if (grave) {
      registrarTodo(
        `FinanceAI original: edicao por prompt de terceiro (${lista}). Conferir e reverter para ${ultimoBom?.sha ?? "o ultimo commit meu"}`,
      );
    }
  }
} else {
  console.log(`sem novidade (último visto: ${estado.ultimoVisto ?? "—"})`);
}

if (!seco) {
  gravarEstado({
    ultimoVisto: commits[0]?.sha ?? estado.ultimoVisto,
    ultimoBom: ultimoBom?.sha ?? estado.ultimoBom,
    conferidoEm: new Date().toISOString(),
  });
}
