# Contrato de publicação web — esqueleto das plataformas

## Objetivo
Definir a interface `SocialPublisher` e as implementações específicas `InstagramPublisher`, `TikTokPublisher` e `YouTubePublisher`. Esta etapa **não instala Playwright, não abre abas e não realiza postagens**.

## Ciclo de vida
| Ordem | Método | Descrição |
|---|---|---|
| 1 | `openTab()` | Abrir uma nova aba na sessão existente do navegador |
| 2 | `openComposer(mediaType)` | Abrir o editor para Feed, Carrossel ou Vídeo |
| 3 | `uploadMedia(files)` | Selecionar arquivos finais já preparados localmente |
| 4 | `setCaption(caption)` | Colocar a legenda específica da rede |
| 5 opcional | `setMusic(options)` | Inserir música e opcionalmente volume de 0 a 100 e início; retornar `unsupported` se a plataforma não permitir |
| 6 | `publish()` | Acionar a confirmação externa (NUNCA num dry run) |
| 7 | `verifyPublication()` | Verificar publicação e devolver confirmação com ID/URL, ou resultado inconclusivo |
| 8 | `closeTab()` | Fechar apenas a aba pertencente ao serviço |

`MusicOptions` modela uma solicitação, não promete suporte a todas as plataformas ou formatos. A decisão de chamar o método é do orquestrador, depois de verificar capacidades concretas. Os métodos de navegação/selectors serão específicos de cada classe; não haverá contrato separado para cada botão ou seletor CSS, pois isso é detalhe de implementação.

## Responsabilidades
- A pasta local é a fonte do conteúdo, não o Supabase.
- O leitor atual e `PreparedPublication` não foram alterados.
- `LocalUploadMedia` descreve caminhos de arquivos finais resolvidos no computador. O fluxo de extração segura do ZIP e a gestão das sessões do navegador ainda serão projetados.
- Os IDs do Supabase permanecem no contrato de publicação preparada, fora das classes web.
- A classe web deve usar o tratador centralizado de erros nas implementações futuras.
- As classes não devem escrever no banco; o orquestrador cuidará de registrar o resultado por meio do backend autorizado.

## Segurança da implantação
Cada método das classes lança `PlatformStepNotImplementedError`, inclusive `publish`. Isso impede que o esqueleto sinalize sucesso sem interação real. Nenhum arquivo de credenciais é criado, nenhuma automação do navegador é inicializada e `npm run dev` permanece inalterado.

Antes de implementar as plataformas, será preciso: definir as capacidades por rede e tipo de mídia; conectar o Playwright ao gerenciador de sessões; resolver arquivos finais e verificar extensões/formatos; e estabelecer a reconciliação de postagens incertas para evitar duplicidade.

## Verificação
```bash
npm install
npm run typecheck
npm test
```
