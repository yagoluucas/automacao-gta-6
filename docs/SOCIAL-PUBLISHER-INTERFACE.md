# SocialPublisher — contrato mínimo e capacidades opcionais

## Objetivo
As três classes (`InstagramPublisher`, `TikTokPublisher`, `YouTubePublisher`) implementam a interface comum `SocialPublisher`. Nesta etapa, todos os métodos criados lançam `PlatformStepNotImplementedError`: **não há Playwright, navegação nem publicação real**.

## Métodos obrigatórios
- `prepare(input: PublicationPreparation)`: preparar um trabalho já validado localmente, incluindo seus arquivos finais, mídia e legenda.
- `publish()`: confirmação externa de postagem. Não executar em dry run e não repetir após resultado incerto.
- `verifyPublication()`: confirmar postagem por evidência, ou retornar resultado inconclusivo.

## Capacidades opcionais
- `openTab?()`: abrir uma nova aba.
- `openComposer?(mediaType)`: localizar e abrir o compositor.
- `uploadMedia?(files)`: selecionar os arquivos locais preparados.
- `setCaption?(caption)`: preencher a legenda.
- `setMusic?(options)`: solicitar música, faixa inicial e volume quando a interface permitir.
- `closeTab?()`: encerrar apenas a aba do serviço.

Não é necessário implementar métodos opcionais. O código que os utilizar deverá verificar primeiro se o método existe. A ausência de `setMusic` não impede a publicação; se a música for um requisito indispensável da publicação, a camada de orquestração deverá rejeitar a tarefa antes de iniciar a postagem.

**Instagram Web:** `InstagramPublisher` não implementa `setMusic`. Nenhuma extensão paga ou artifício alternativo será acrescentado. O método continua opcional e não estará disponível nessa classe.

**TikTok / YouTube:** os esqueletos atuais declaram `setMusic` apenas como ponto de implementação futura, sem garantir que a interface web/conta/formato suporta o recurso. Antes de publicar, verificar capacidades efetivas e remover o método onde não fizer sentido.

## Responsabilidades e limitações
O pacote local preparado e seus IDs provenientes do Supabase continuam sendo a entrada. As classes web não consultam o banco nem são responsáveis pelo estado da fila, retentativas ou sincronização. O serviço web lidará somente com interações da plataforma. O leitor e `npm run dev` não foram alterados.

## Verificação
```bash
npm install
npm run typecheck
npm test
```
