# MVP — Tratador centralizado de erros

## Objetivo

Padronizar erros do leitor local e dos futuros serviços de Instagram, TikTok e YouTube, com códigos estáveis, descrições em português e histórico JSON. Esta fase NÃO executa Playwright, publicação ou escrita no Supabase.

## Classificação e comportamento

| Tipo | Exemplo | Ação |
|---|---|---|
| fatal | `MEDIA_MISSING`, `CAPTION_MISSING`, `SCHEDULE_INVALID` | Encerrar o trabalho sem retry |
| transient | `NETWORK_UNAVAILABLE`, `RATE_LIMITED`, `PLATFORM_UNAVAILABLE` | Até três tentativas no total: imediata, após 5 min, após mais 10 min |
| uncertain | `PUBLICATION_UNCONFIRMED` | Parar, não fazer retry, solicitar revisão (`review_required`) |
| warning | `OPTIONAL_METADATA_MISSING` | Registrar com `captureError` e continuar; não usar `throw` para um aviso simples |

O retry é destinado **somente a passos comprovadamente repetíveis**, como preparação e ações antes da confirmação externa. A mesma função **não** deve englobar um clique em Publicar se uma falha puder ocorrer depois desse clique: o risco é criar publicações duplicadas. O chamador deve emitir `PUBLICATION_UNCONFIRMED` quando o resultado remoto for desconhecido.

## Arquivos

- `src/errors/catalog.ts`: tipos, catálogo e normalização de exceções.
- `src/errors/handler.ts`: exporta apenas `captureError`; criação do registro e gravação JSON ficam privadas.
- `src/errors/types.ts`: tipos compartilhados entre captura, retry e sincronização.
- `src/ids.ts`: validação centralizada dos UUIDs também usada pelo contrato de publicação.
- `src/errors/retry.ts`: `withPublicationRetry`; espera injetável nos testes e callback `onFinal`.
- `src/errors/supabase-sync.ts`: `FailureSyncPayload` e conversão para o contrato de resultado existente. **Não envia requisições.**
- `src/cli.ts`: falhas da inspeção e exceções da CLI geram registros locais; sem mudança da validação atual.

## Exemplo de JSON salvo

```json
{
  "eventId": "11111111-1111-4111-8111-111111111111",
  "occurredAt": "2026-10-30T21:15:00.000Z",
  "imageId": "22222222-2222-4222-8222-222222222222",
  "publicationId": "33333333-3333-4333-8333-333333333333",
  "platform": "instagram",
  "code": "MEDIA_MISSING",
  "kind": "fatal",
  "description": "Arquivo de mídia obrigatório não encontrado.",
  "stage": "inspection",
  "attempt": 1,
  "maxAttempts": 3,
  "action": "abort",
  "nextRetryAt": null,
  "supabaseSync": "pending"
}
```

Sem rastros de pilha, legendas, tokens, cookies, URLs assinadas ou mensagens brutas desconhecidas. IDs não verificados são registrados como `null`.

## Supabase

`public.image_publications` já possui `status`, `attempts`, `error_message` e `updated_at`. A tabela **não** possui `error_at` dedicado; o timestamp exato de cada ocorrência permanece no JSON local. O contrato de integração leva `eventId`, `occurredAt`, IDs e `errorMessage`. O campo `error_message` no banco deverá conter `CODIGO: descrição`.

Somente erro definitivo (fatal ou temporário após três tentativas) poderá gerar `failed`, enquanto resultado ambíguo deverá gerar `review_required`. Erros de inspeção sem `publicationId` validado são logados localmente mas **não podem atualizar um registro arbitrário**.

**Pendente:** implementar endpoint restrito ao bot no backend, sem fornecer acesso de gravação amplo ao usuário do frontend e sem expor chaves privilegiadas. Registrar as tentativas na tabela exige lógica de lease/concorrência, validação de transições e autenticação de máquina; o callback `onFinal` fica reservado para essa integração. Até lá, `supabaseSync=pending` é uma intenção de sincronização e **não prova persistência**.

## Como testar

```bash
npm install
npm run typecheck
npm test
npm run dev
```

Falhas da inspeção são registradas em `logs/errors/*.json`. Diretório `logs/` permanece ignorado pelo Git.

## Limitações intencionais

Este MVP não reprocessa automaticamente uma tentativa após reinício do processo e não executa retentativas de publicações reais. Persistência/reinício da agenda de retries, captura de erros de processo Node não recuperáveis e sincronização controlada do Supabase serão fases específicas. Não chamar `process.on("uncaughtException")` para continuar a execução após estado possivelmente corrompido.
