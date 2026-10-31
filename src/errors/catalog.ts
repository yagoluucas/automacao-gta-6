/** Catálogo fechado de códigos e mensagens em português. Nenhuma exceção bruta entra nos logs. */
export const ERROR_CATALOG = {
  MEDIA_MISSING: { kind: "fatal", description: "Arquivo de mídia obrigatório não encontrado." },
  CAPTION_MISSING: { kind: "fatal", description: "Legenda obrigatória não encontrada ou vazia." },
  SCHEDULE_INVALID: { kind: "fatal", description: "Horário de publicação ausente ou inválido." },
  MANIFEST_INVALID: { kind: "fatal", description: "Manifesto ausente, inconsistente ou inválido." },
  MEDIA_INVALID: { kind: "fatal", description: "Arquivo de mídia inválido, corrompido ou incompatível." },
  CAPTION_INVALID: { kind: "fatal", description: "Legenda incompatível com as regras do pacote ou da rede social." },
  PLATFORM_REJECTED: { kind: "fatal", description: "A plataforma recusou definitivamente o conteúdo." },
  NETWORK_UNAVAILABLE: { kind: "transient", description: "Não foi possível estabelecer conexão com a rede." },
  PLATFORM_UNAVAILABLE: { kind: "transient", description: "A plataforma está temporariamente indisponível." },
  RATE_LIMITED: { kind: "transient", description: "Limite temporário da plataforma atingido." },
  SESSION_EXPIRED: { kind: "fatal", description: "Sessão expirada ou autorização necessária: intervenção manual." },
  PUBLICATION_UNCONFIRMED: { kind: "uncertain", description: "A postagem pode ter ocorrido, mas não houve confirmação segura." },
  UNEXPECTED_ERROR: { kind: "uncertain", description: "Falha inesperada; o resultado da operação precisa ser verificado." },
  OPTIONAL_METADATA_MISSING: { kind: "warning", description: "Informação opcional ausente; operação pode continuar." },
  STATUS_SYNC_FAILED: { kind: "warning", description: "Falha ao sincronizar o resultado com o Supabase; atualização pendente." },
  PUBLICATIONS_DIR_MISSING: { kind: "warning", description: "Diretório local de publicações não encontrado; inspeção ignorada até que esteja disponível." },
  PUBLICATIONS_DIR_NOT_DIRECTORY: { kind: "fatal", description: "O caminho configurado para publicações não é uma pasta." },
  PUBLICATIONS_DIR_ACCESS_DENIED: { kind: "fatal", description: "Sem permissão para acessar o diretório local de publicações." },
} as const;

export type ErrorCode = keyof typeof ERROR_CATALOG;
export type ErrorKind = (typeof ERROR_CATALOG)[ErrorCode]["kind"];
export type ErrorStage = "inspection" | "preparation" | "publication" | "verification" | "database" | "runtime";

export class AppError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode) {
    super(ERROR_CATALOG[code].description);
    this.name = "AppError";
    this.code = code;
  }
}

/** Reconhece erros do leitor atual sem modificar as validações de Feed V5. */
export function normalizeError(error: unknown): ErrorCode {
  if (error instanceof AppError) return error.code;
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const value = raw.toLowerCase();
  if (/scheduled_at|horário agendado|data de publicação/.test(value)) return "SCHEDULE_INVALID";
  if (/faltou .*\.png|mídia.*ausente|mídia não encontrada|imagem não encontrada/.test(value)) return "MEDIA_MISSING";
  if (/faltou .*legenda_|legenda.*vazia|legenda.*não encontrad|legendas\.txt não encontrad/.test(value)) return "CAPTION_MISSING";
  if (/legenda.*diverge|hashtags|legenda.*excede|texto.*não.*permitido/.test(value)) return "CAPTION_INVALID";
  if (/zip|crc|png|dimensões inesperadas|mídia.*inválid|mídia.*corrompid/.test(value)) return "MEDIA_INVALID";
  if (/manifest|image_id|platform|plataforma repetida|publications|ready\.json.*inválido/.test(value)) return "MANIFEST_INVALID";
  if (/enotfound|econnreset|enetunreach|ehostunreach|eai_again|econnrefused|network unavailable|fetch failed|internet|sem conexão/i.test(value)) return "NETWORK_UNAVAILABLE";
  if (/etimedout|und_err_connect_timeout|503|temporariamente indisponível/.test(value)) return "PLATFORM_UNAVAILABLE";
  if (/429|rate.?limit/.test(value)) return "RATE_LIMITED";
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (["ENOTFOUND", "ECONNRESET", "ENETUNREACH", "EHOSTUNREACH", "EAI_AGAIN", "ECONNREFUSED"].includes(code)) return "NETWORK_UNAVAILABLE";
  if (["ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT"].includes(code)) return "PLATFORM_UNAVAILABLE";
  return "UNEXPECTED_ERROR";
}
