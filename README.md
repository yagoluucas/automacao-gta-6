# GTA 6 PIRA — Automação local (MVP 01)

Este repositório oferece inspeção local de pacotes Feed V5 e prévia de upload no Instagram e no YouTube. O preview pode enviar mídias e criar rascunhos, mas não clica em Publicar nem atualiza o Supabase.

## MVP 02 — Abrir Chrome e preparar Instagram e YouTube

O comando `npm run dev` abre **uma janela nova do Google Chrome**, maximizada (sem F11), com três abas (Instagram, TikTok e YouTube). Primeiro prepara a mídia e a legenda do Instagram no Post assistant da extensão INSSIST, sem clicar em Publish Photo/Video; deixa essa aba aberta e depois prepara o upload do YouTube, também sem publicar. A aba do YouTube fica em foco ao final. Não executa login nem preenche credenciais. Use `npm run preview:instagram` ou `npm run preview:youtube` para testar uma rede por vez; `npm run inspect` executa somente o leitor, sem navegador.

Requisitos: Google Chrome instalado localmente e `npm install` para instalar `playwright-core` (não é necessário executar `playwright install`, pois o canal `chrome` usa o Chrome já instalado).

Exemplo de `.env.local`:

```dotenv
PUBLICATIONS_DIR=../publicacoes
LINK_INSTAGRAM=https://www.instagram.com/
LINK_TIKTOK=https://www.tiktok.com/pt-BR/
LINK_YOUTUBE=https://www.youtube.com/
```

**Atenção:** os links precisam ser URLs puras, sem `[...](...)` da formatação Markdown. `USER_INSTAGRAM`, `PASSWORD_INSTAGRAM` e equivalentes, mesmo que estejam no `.env.local`, **não são lidos nesta fase**. Nunca registre credenciais ou arquivos de sessão no Git.


Se o terminal avisar `.env.local not found`, isso é apenas um aviso: o Node pode continuar usando `.env` ou os valores padrão. O preview exige uma pasta `PUBLICATIONS_DIR` existente com um `YOUTUBE.mp4` preparado; se não encontrar o vídeo, termina antes de abrir o Chrome.

O navegador usa o perfil próprio `.chrome-profile/`, ignorado pelo Git; ele não assume o controle do seu Chrome pessoal. Faça login manualmente se a rede solicitar. No Windows, se esse perfil já estiver aberto, `npm run dev` encerra somente o Chrome que usa exatamente esse perfil e abre outra janela com o mesmo login e as extensões instaladas. Uma janela aberta diretamente pelo PowerShell sem depuração remota não pode ser assumida pelo Playwright. Evite iniciar dois bots simultaneamente usando o mesmo perfil, pois a nova execução fecha a janela anterior e pode interromper um rascunho em andamento. O Chrome é iniciado com o modo de aplicativos em segundo plano desativado para liberar o perfil após fechar a janela. Se aparecer `CHROME_PROFILE_IN_USE`, encerre manualmente o Chrome do bot que ainda esteja em execução; não apague a pasta do perfil, pois ela guarda a sessão. O programa continua aberto até você fechar a janela do Chrome. A maximização é solicitada via `--start-maximized` e pode depender do sistema operacional/gerenciador de janelas.

`npm run dev` executa Instagram e depois YouTube com pausas de 5 a 10 segundos entre interações; consulte [docs/INSTAGRAM-PREVIEW.md](docs/INSTAGRAM-PREVIEW.md) e [docs/YOUTUBE-SHORTS-PREVIEW.md](docs/YOUTUBE-SHORTS-PREVIEW.md) para o formato das mídias locais. Cada execução pode iniciar novos uploads. Se a preparação do Instagram falhar, o erro é exibido e o fluxo do YouTube ainda é tentado. Para mostrar apenas o resumo do leitor, use `npm run inspect`. Caso uma página não carregue, o erro é listado por rede. Se o Chrome não estiver instalado, o processo falhará de forma explícita.

## Requisitos

- Windows com **Node.js 22.16+** (suporte nativo à execução de TypeScript por remoção de tipos).
- O preview do YouTube exige `YOUTUBE.mp4` e `LEGENDA_YOUTUBE.txt` na pasta do trabalho. O Instagram também exige sua mídia `INSTAGRAM.png`, `.jpg`, `.jpeg` ou `.mp4`, `LEGENDA_INSTAGRAM.txt` e a extensão INSSIST instalada no perfil do bot. A inspeção Feed V5 lê os pacotes ZIP na pasta `publicacoes`.
- A execução do modo navegador utiliza a dependência `playwright-core` e uma instalação local do Google Chrome. Não faz download automático do Chromium.

## Executar

Instale as dependências de desenvolvimento:

```bash
npm install
```

### Execução rápida com `.env.local`

Crie um arquivo `.env.local` na raiz deste repositório, indicando **onde estão salvas as publicações**:

```dotenv
PUBLICATIONS_DIR="D:\\programacao\\projetos\\bot-publicacao-gta\\publicacoes"
```

Substitua o caminho pelo diretório real do seu computador. Também é possível usar `PUBLICATIONS_DIR=../publicacoes` (caminho relativo à raiz do projeto). Consulte `.env.example` para um exemplo sem dados privados.

Depois execute:

```bash
npm run dev
npm run preview:instagram
npm run preview:youtube
```

O script lê automaticamente os arquivos opcionais `.env` e `.env.local`, nessa ordem, usando o suporte nativo do Node.js. **Não precisa instalar `dotenv`**. O arquivo `.env.local` não é enviado ao Git.

A prioridade da configuração é: **`--dir` > variável `PUBLICATIONS_DIR` já definida no terminal > `.env.local` > `.env` > `../publicacoes`**. Se os dois arquivos de ambiente não existirem, o comando continua funcionando com o diretório padrão.

Para selecionar outra pasta apenas em uma execução:

```bash
npm run dev -- --dir "D:\\outra-pasta\\publicacoes"
```

O comando legado continua disponível:

```bash
npm run inspect
npm run inspect -- --dir "D:\\programacao\\projetos\\bot-publicacao-gta\\publicacoes"
```

`npm run inspect` usa o ambiente já definido no terminal, mas não carrega os arquivos `.env` e `.env.local` automaticamente. `npm run dev` prepara o Instagram e depois o YouTube sem clicar nos botões finais de publicação. `npm run preview:instagram` exige apenas a mídia e a legenda do Instagram no trabalho selecionado; use `-- --image-id <UUID>` quando houver vários trabalhos preparados. Nenhum desses comandos atualiza o Supabase.

## O que o leitor `npm run inspect` mostra no console

Para cada pasta com `ready.json`:

- Identificação da imagem, regra, abordagem editorial e tradução.
- Redes agendadas e os respectivos horários e IDs.
- Nome de cada `INSTAGRAM.png`, `YOUTUBE.png`, `TIKTOK.png` esperado; assinatura PNG, tamanho, dimensões e SHA-256.
- **Legenda integral da publicação** extraída de `LEGENDA_<REDE>.txt` e conferida com `LEGENDAS.txt`.
- Erros de arquivo ausente, manifesto inválido, ZIP corrompido, texto divergente ou horário conflitante.

**A leitura de texto é feita pelos arquivos TXT preparados pelo plugin, e não por OCR da imagem.** O leitor verifica a assinatura e o cabeçalho dos PNGs e a integridade CRC do ZIP, mas não faz auditoria visual completa dos pixels.

## Pasta esperada

```text
publicacoes/
  2026-10-23/
    11111111-1111-4111-8111-111111111111/
      manifest.json
      ready.json
      publifeed_2310261200.zip
```

O plugin Feed V5 entrega `LEGENDAS.txt`, `LEGENDA_INSTAGRAM.txt`, `LEGENDA_YOUTUBE.txt`, `LEGENDA_TIKTOK.txt` e PNGs individuais dentro de seu ZIP. Só as redes informadas em `manifest.platforms` são consideradas agendadas. ZIPs com arquivos adicionais da V5 são aceitos, mas **não criam autorização de postagem em outras redes**.

`ready.json` deve ser gravado por último pelo processo de preparação. Pode conter `{ "ready": true }`. O indicador não substitui a verificação completa feita pelo leitor.

## Contrato do manifesto

Veja [docs/SPEC-MVP-01.md](docs/SPEC-MVP-01.md). É obrigatório fornecer `manifest.json`, que liga as mídias do ZIP aos registros da fila. O ZIP da skill sozinho não contém os IDs e horários do Supabase.

## Testes e checagem de tipos

```bash
npm run typecheck
npm test
```

Se o VS Code continuar com o diagnóstico `Cannot find name 'Buffer'`, confirme que executou `npm install` na raiz do repositório e reinicie o servidor TypeScript do VS Code (`TypeScript: Restart TS Server`).

Os testes criam pacotes ZIP de exemplo em uma pasta temporária e não dependem de arquivos privados, contas ou rede.

## Próximas etapas (fora do MVP 01)

1. Validar contrato de entrega do Work (`manifest.json` + `ready.json` + ZIP V5).
2. Preparar fila e monitoramento local, respeitando a janela 09h–21h.
3. Adicionar Playwright + Chromium com contas autenticadas, sem postagem no primeiro teste de navegação.
4. Publicação sequencial e auditoria por plataforma, com controle de tentativas, confirmação e tolerância de 30 minutos.
