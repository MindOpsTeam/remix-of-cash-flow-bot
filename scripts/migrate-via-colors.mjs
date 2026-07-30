#!/usr/bin/env node

/**
 * Converte utilities Tailwind de paletas abertas para os papéis semânticos
 * permitidos pelo Viver de IA DS. É idempotente: depois da primeira execução,
 * não há mais tokens que casem com o padrão.
 */

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url));
const extensions = new Set([".ts", ".tsx", ".css"]);
const semanticFamily = {
  amber: "warning",
  yellow: "warning",
  orange: "warning",
  red: "destructive",
  rose: "destructive",
  emerald: "success",
  green: "success",
  blue: "primary",
  indigo: "primary",
  violet: "primary",
  purple: "primary",
  cyan: "primary",
  sky: "primary",
  teal: "primary",
};

const utilityPattern =
  /\b(bg|text|border)-(amber|yellow|orange|red|rose|emerald|green|blue|indigo|violet|purple|cyan|sky|teal)-\d+(?:\/(\d+))?\b/g;

async function listFiles(dir) {
  const entries = await readdir(dir);
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry);
      return (await stat(path)).isDirectory() ? listFiles(path) : [path];
    }),
  );
  return nested.flat();
}

const files = (await listFiles(sourceRoot)).filter((file) => extensions.has(extname(file)));
let changedFiles = 0;
let changedUtilities = 0;
let changedIcons = 0;

for (const file of files) {
  const before = await readFile(file, "utf8");
  let after = before.replace(utilityPattern, (_match, kind, family, opacity) => {
    changedUtilities += 1;
    const semantic = semanticFamily[family];
    if (kind === "bg") return `bg-${semantic}/[0.08]`;
    if (kind === "border") return `border-${semantic}/30`;
    return `text-${semantic}${opacity ? `/${opacity}` : ""}`;
  });

  after = after.replace(/\bSparkles\b/g, () => {
    changedIcons += 1;
    return "Compass";
  });

  if (after !== before) {
    await writeFile(file, after);
    changedFiles += 1;
  }
}

console.log(
  JSON.stringify(
    {
      changedFiles,
      changedUtilities,
      changedIcons,
      policy: "navy/accent · success real · coral destrutivo · sem paleta decorativa",
    },
    null,
    2,
  ),
);
