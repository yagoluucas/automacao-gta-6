# Contratos locais do bot — MVP de publicação (fase 1)

## Fonte de verdade operacional

O bot consome exclusivamente `PUBLICATIONS_DIR/AAAA-MM-DD/<image_id>/` com `manifest.json`, `ready.json` e ZIP contendo mídia e legenda finais. **Não consulta o Supabase para escolher mídia ou legenda.** O GPT Work prepara os arquivos localmente e transporta os IDs previamente atribuídos pelo Supabase.

- `image_id` = `public.images.id` (UUID existente).
- `publications[].id` = `public.image_publications.id` (UUID existente).
- `publications[].platform` = uma das três redes definidas no banco.
- `publications[].scheduled_at` = horário agendado conhecido na preparação.

**Não gerar UUID novo para uma publicação já cadastrada no banco.** `target_network=todos` origina três linhas de publicação distintas e três IDs.

## Contratos implementados

- `src/contracts.ts`: `Manifest` v1, `Publication`, `parseManifest`, `parseReady`. Preservados sem alteração.
- `src/inspector.ts`: `InspectionResult` e `PlatformSummary`. Preservados sem alteração.
- `src/publication-contracts.ts`: `MediaType`, `PublicationAsset`, `PreparedPublication`, `PublicationOutcome`, `PublicationStatusPatch`, adaptador `preparedFromInspection` e validadores/mapeadores.
- `PublicationOutcome` **não é uma nova entidade persistida**: representa a evidência de uma tentativa e seu resultado. Campos são traduzidos aos nomes existentes de `image_publications` pelo `toStatusPatch`.

`PreparedPublication` só é produzida após inspeção `OK`. O adaptador atual suporta exclusivamente Feed V5 e exige IDs UUID válidos, mídia PNG e legenda validada. A compatibilidade com `video` e `carousel` será implementada em outro contrato/versionamento de pacote, sem fingir que são Feed.

## Regras sobre confirmação

1. Somente `published`, `failed` e `review_required` são resultados finalizados; `simulated` é estado **local**, jamais atualização do Supabase.
2. `published` exige data real (`publishedAt`) e ID ou URL externa como evidência. Apenas um clique no botão não garante publicação.
3. Timeout após tentativa de publicar deve gerar `review_required`, para verificação antes de qualquer reenvio.
4. Antes de atualizar uma linha, `assertOutcomeMatchesPublication` compara `imageId`, `publicationId` e `platform`.
5. `toStatusPatch` apenas prepara os campos. Não executa operações de banco e não publica.
6. A API futura deve verificar autoridade, estado atual, versão/lease de processamento e impedir atualização indevida ou duplicada. A validação local não substitui validação no servidor.
7. `failed` e `review_required` mantêm campos de sucesso existentes intocados até a política de reconciliação ser estabelecida.

## Integração com Supabase: pendência de segurança

O esquema já dispõe de `status`, `published_at`, `external_post_id`, `external_post_url`, `error_message`, `attempts` e `lease_until`. A constraint existente exige `published_at` quando `status='published'`. A atualização não exige criar novas colunas.

O papel `authenticated` pode selecionar/inserir, mas não atualizar `public.image_publications`. **Não liberar UPDATE genérico ao frontend.** Um endpoint autenticado especificamente para o bot deverá executar transições controladas, sem expor chave `service_role` ao navegador. A autenticação de máquina, gestão de leases, idempotência e concessão de privilégios serão projetadas e testadas antes da primeira alteração no banco.

Nenhum segredo de Supabase deve ser escrito no ZIP, manifesto, log ou repositório.

## Fora do escopo da fase 1

Sem Playwright, autenticação em redes sociais, envio de mídia, clique de publicação, atualização real do Supabase ou alterações na CLI. Os testes existentes do leitor devem continuar funcionando.
