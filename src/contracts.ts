export const PLATFORMS = ["instagram", "youtube", "tiktok"] as const;
export type Platform = (typeof PLATFORMS)[number];

export type Publication = {
  id: string;
  platform: Platform;
  scheduled_at: string;
};

export type Manifest = {
  image_id: string;
  rule_set_code: string;
  approach: string;
  translate: boolean;
  zip_file: string;
  publications: Publication[];
};

export function parseManifest(input: unknown): Manifest {
  if (!isObject(input)) throw new Error("manifest.json precisa ser um objeto JSON");
  let manifest: Record<string, unknown> = input;
  if ("zip" in input || "publication_ids" in input || "platforms" in input) {
    const platforms = input.platforms;
    const publicationIds = input.publication_ids;
    if (!Array.isArray(platforms) || !isObject(publicationIds)) {
      throw new Error("platforms e publication_ids inválidos no manifest");
    }
    manifest = {
      ...input,
      zip_file: input.zip,
      translate: input.translation,
      publications: platforms.map((platform) => ({
        id: publicationIds[String(platform)],
        platform,
        scheduled_at: input.scheduled_at,
      })),
    };
  }
  for (const key of ["image_id", "rule_set_code", "approach", "zip_file"] as const) {
    if (typeof manifest[key] !== "string" || !(manifest[key] as string).trim()) {
      throw new Error(`Campo obrigatório inválido em manifest.json: ${key}`);
    }
  }
  if (typeof manifest.translate !== "boolean") throw new Error("translate precisa ser booleano");
  if (!Array.isArray(manifest.publications) || !manifest.publications.length || manifest.publications.length > 3) {
    throw new Error("publications deve conter de 1 a 3 publicações");
  }
  const seen = new Set<Platform>();
  const publications: Publication[] = [];
  for (const raw of manifest.publications) {
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
  if (!/^publifeed_\d{10}\.zip$/.test(manifest.zip_file as string)) {
    throw new Error("zip_file deve seguir publifeed_DDMMYYHHMM.zip");
  }
  return {
    image_id: manifest.image_id as string,
    rule_set_code: manifest.rule_set_code as string,
    approach: manifest.approach as string,
    translate: manifest.translate as boolean,
    zip_file: manifest.zip_file as string,
    publications,
  };
}

export function parseReady(input: unknown): void {
  if (!isObject(input)) throw new Error("ready.json precisa ser um objeto JSON");
  if ("ready" in input && input.ready !== true) throw new Error("ready.json indica que o pacote ainda não está pronto");
}

function isObject(input: unknown): input is Record<string, unknown> {
  return !!input && typeof input === "object" && !Array.isArray(input);
}
