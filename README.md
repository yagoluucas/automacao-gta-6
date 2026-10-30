# GTA 6 PIRA — Automação local (MVP 01)

Este repositório começa com **somente leitura e logs no console**. Nenhum login, postagem, controle do navegador, interação com Supabase ou agendamento do processo local é executado nesta fase.

## Requisitos

- Windows com **Node.js 22.16+** (suporte nativo à execução de TypeScript por remoção de tipos).
- Os pacotes ZIP produzidos pelo **plugin GTA 6 PIRA Feed V5** devem estar na pasta `publicacoes`.
- Sem dependências npm em tempo de execução, nem necessidade de Python ou Chromium nesta fase. O VS Code/TypeScript usa dependências de desenvolvimento para checagem estática.

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

Substitua o caminho pelo diretório real do seu computador. Também é possível usar `PUBLICATIONS_DIR=./publicacoes` (caminho relativo à raiz do projeto). Consulte `.env.example` para um exemplo sem dados privados.

Depois execute:

```bash
npm run dev
```

O script lê automaticamente os arquivos opcionais `.env` e `.env.local`, nessa ordem, usando o suporte nativo do Node.js. **Não precisa instalar `dotenv`**. O arquivo `.env.local` não é enviado ao Git.

A prioridade da configuração é: **`--dir` > variável `PUBLICATIONS_DIR` já definida no terminal > `.env.local` > `.env` > `./publicacoes`**. Se os dois arquivos de ambiente não existirem, o comando continua funcionando com o diretório padrão.

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

Os arquivos exemplo estão em `examples/`. O plugin Feed V5 entrega `LEGENDAS.txt`, `LEGENDA_INSTAGRAM.txt`, `LEGENDA_YOUTUBE.txt`, `LEGENDA_TIKTOK.txt` e PNGs individuais dentro de seu ZIP. Só as redes informadas em `manifest.publications` são consideradas agendadas. ZIPs com arquivos adicionais da V5 são aceitos, mas **não criam autorização de postagem em outras redes**.

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
