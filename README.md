# GTA 6 PIRA — Automação local (MVP 01)

Este repositório começa com **somente leitura e logs no console**. Nenhum login, postagem, controle do navegador, interação com Supabase ou agendamento do processo local é executado nesta fase.

## MVP 02 — Abrir Google Chrome antes da inspeção

O comando `npm run dev` abre **uma janela nova do Google Chrome**, maximizada (sem F11), com três abas (Instagram, TikTok e YouTube), antes de ler a pasta de publicações. Não executa login, não preenche credenciais e não publica. Use `npm run inspect` para executar somente o leitor, sem navegador.

Requisitos: Google Chrome instalado localmente e `npm install` para instalar `playwright-core` (não é necessário executar `playwright install`, pois o canal `chrome` usa o Chrome já instalado).

Exemplo de `.env.local`:

```dotenv
PUBLICATIONS_DIR=../publicacoes
LINK_INSTAGRAM=https://www.instagram.com/
LINK_TIKTOK=https://www.tiktok.com/pt-BR/
LINK_YOUTUBE=https://www.youtube.com/
```

**Atenção:** os links precisam ser URLs puras, sem `[...](...)` da formatação Markdown. `USER_INSTAGRAM`, `PASSWORD_INSTAGRAM` e equivalentes, mesmo que estejam no `.env.local`, **não são lidos nesta fase**. Nunca registre credenciais ou arquivos de sessão no Git.


Se o terminal avisar `.env.local not found`, isso é apenas um aviso: o Node pode continuar usando `.env` ou os valores padrão. Se a pasta `PUBLICATIONS_DIR` não existir, a inspeção será ignorada com aviso claro, e o Chrome continuará aberto; nenhuma pasta será criada automaticamente. Crie a pasta ou ajuste o caminho real em `.env.local` para habilitar a inspeção. Erros de acesso a diretórios existentes continuam sendo reportados.

O navegador usa o perfil próprio `.chrome-profile/`, ignorado pelo Git; ele não assume o controle do seu Chrome pessoal. Faça login manualmente se a rede solicitar. Evite iniciar dois bots simultaneamente usando o mesmo perfil. O programa continua aberto até você fechar a janela do Chrome. A maximização é solicitada via `--start-maximized` e pode depender do sistema operacional/gerenciador de janelas.

`npm run dev` continua executando o leitor e mostrando o resumo no console após iniciar as abas. Caso uma página não carregue, o erro é listado por rede, mas as outras abas continuam acessíveis. Se o Chrome não estiver instalado, o processo falhará de forma explícita.

## Requisitos

- Windows com **Node.js 22.16+** (suporte nativo à execução de TypeScript por remoção de tipos).
- Os pacotes ZIP produzidos pelo **plugin GTA 6 PIRA Feed V5** devem estar na pasta `publicacoes`.
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

`npm run inspect` usa o ambiente já definido no terminal, mas não carrega os arquivos `.env` e `.env.local` automaticamente. **Ambos os comandos apenas inspecionam pacotes locais; não publicam nas redes sociais e não consultam o Supabase.**

## O que será mostrado no console

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
