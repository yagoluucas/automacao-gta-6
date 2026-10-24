export const PLATFORMS = ["instagram", "youtube", "tiktok"] as const;
export type Platform = (typeof PLATFORMS)[number];

export type Publication = {
  id: string;
  platform: Platform;
  scheduled_at: string;
};

export type Manifest = {
  schema_version: 1;
  image_id: string;
  rule_set_code: string;
  approach: string;
  translate: boolean;
  zip_file: string;
  publications: Publication[];
};

export function parseManifest(input: unknown): Manifest {
  if (!isObject(input)) throw new Error("manifest.json precisa ser um objeto JSON");
  if (input.schema_version !== 1) throw new Error("schema_version do manifest precisa ser 1");
  for (const key of ["image_id", "rule_set_code", "approach", "zip_file"] as const) {
    if (typeof input[key] !== "string" || !(input[key] as string).trim()) {
      throw new Error(`Campo obrigatório inválido em manifest.json: ${key}`);
    }
  }
  if (typeof input.translate !== "boolean") throw new Error("translate precisa ser booleano");
  if (!Array.isArray(input.publications) || !input.publications.length || input.publications.length > 3) {
    throw new Error("publications deve conter de 1 a 3 publicações");
  }
  const seen = new Set<Platform>();
  const publications: Publication[] = [];
  for (const raw of input.publications) {
    if (!isObject(raw) || typeof raw.id !== "string" || !raw.id.trim()) {
      throw new Error("Cada publicação precisa de um id não vazio");
    }
    if (!PLATFORMS.includes(raw.platform as Platform)) throw new Error("Plataforma inválida no manifest");
    const platform = raw.platform as Platform;
    if (seen.has(platform)) throw new Error(`Plataforma repetida: ${platform}`);
    seen.add(platform);
    if (typeof raw.scheduled_at !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(raw.scheduled_at) || !/[zZ]|[+-]\d{2}:\d{2}$/.test(raw.scheduled_at) || Number.isNaN(Date.parse(raw.scheduled_at))) {
      throw new Error(`scheduled_at inválido para ${platform}; use ISO 8601 com fuso`);
    }
    publications.push({ id: raw.id, platform, scheduled_at: raw.scheduled_at });
  }
  const scheduled = publications.map((p) => Date.parse(p.scheduled_at));
  if (new Set(scheduled).size !== 1) {
    throw new Error("As plataformas da mesma imagem precisam ter o mesmo horário agendado");
  }
  if (!/^publifeed_\d{10}\.zip$/.test(input.zip_file as string)) {
    throw new Error("zip_file deve seguir publifeed_DDMMYYHHMM.zip");
  }
  return input as Manifest;
}

export function parseReady(input: unknown): void {
  if (!isObject(input)) throw new Error("ready.json precisa ser um objeto JSON");
  if ("ready" in input && input.ready !== true) throw new Error("ready.json indica que o pacote ainda não está pronto");
}

function isObject(input: unknown): input is Record<string, unknown> {
  return !!input && typeof input === "object" && !Array.isArray(input);
}
