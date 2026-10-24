import path from "node:path";
import { inspectRoot, type InspectionResult } from "./inspector.ts";

function directoryFromArgs(args: string[]): string {
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Uso: npm run inspect -- --dir <pasta>\nPadrão: PUBLICATIONS_DIR ou ./publicacoes\nEste comando NÃO publica em redes sociais.");
    process.exit(0);
  }
  const idx = args.indexOf("--dir");
  if (idx !== -1 && !args[idx + 1]) throw new Error("Informe uma pasta após --dir");
  const raw = idx !== -1 ? args[idx + 1]! : process.env.PUBLICATIONS_DIR || path.join(process.cwd(), "publicacoes");
  return path.resolve(raw);
}

function show(result: InspectionResult): void {
  const id = path.basename(result.jobDir);
  console.log(`\n[${result.status}] Trabalho ${id}`);
  if (result.reason) {
    console.log(`  Motivo: ${result.reason}`);
    return;
  }
  const m = result.manifest!;
  console.log(`  Regra: ${m.rule_set_code} | Abordagem: ${m.approach} | Traduzir: ${m.translate ? "sim" : "não"}`);
  console.log(`  Pacote: ${m.zip_file}`);
  for (const p of result.outputs!) {
    console.log(`  [${p.platform.toUpperCase()}] id=${p.publicationId} | horário=${p.scheduledAt}`);
    console.log(`    MÍDIA ENCONTRADA: ${p.media.filename} (${p.media.width}x${p.media.height}, ${p.media.bytes} bytes)`);
    console.log(`    SHA-256: ${p.media.sha256}`);
    console.log("    LEGENDA ENCONTRADA:");
    for (const line of p.caption.split("\n")) console.log(`      ${line}`);
  }
}

try {
  const root = directoryFromArgs(process.argv.slice(2));
  console.log(`GTA 6 PIRA | Leitor local V5 | MODO SOMENTE LEITURA\nPasta: ${root}`);
  const results = await inspectRoot(root);
  for (const result of results) show(result);
  const count = (status: InspectionResult["status"]) => results.filter((r) => r.status === status).length;
  console.log(`\nResumo: ${count("OK")} válidos, ${count("PENDING")} aguardando, ${count("ERROR")} com erro (${results.length} trabalho(s)).`);
  if (!results.length) console.log("Nenhum trabalho encontrado. Esperado: AAAA-MM-DD/<image_id>/manifest.json + ready.json + ZIP V5.");
  if (count("ERROR")) process.exitCode = 1;
} catch (error) {
  console.error("Erro ao ler a pasta:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
