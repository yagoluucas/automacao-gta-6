# GTA 6 PIRA — Automação local (MVP 01)

Este repositório começa com **somente leitura e logs no console**. Nenhum login, postagem, controle do navegador, interação com Supabase ou agendamento do processo local é executado nesta fase.

## Requisitos

- Windows com **Node.js 22.16+** (suporte nativo à execução de TypeScript por remoção de tipos).
- Os pacotes ZIP produzidos pelo **plugin GTA 6 PIRA Feed V5** devem estar na pasta `publicacoes`.
- Não há dependências npm, necessidade de instalar Python ou iniciar Chromium para este passo.

## Executar

Dentro da pasta do repositório:

```bash
npm run inspect
```

Isso procura, por padrão, em `./publicacoes` (por exemplo, `D:\programacao\projetos\bot-publicacao-gta\publicacoes` quando o repositório estiver em `D:\programacao\projetos\bot-publicacao-gta`). Para apontar outro diretório:

```bash
npm run inspect -- --dir "D:\programacao\projetos\bot-publicacao-gta\publicacoes"
```

Ou defina a variável `PUBLICATIONS_DIR` no ambiente. **Não há leitura do Supabase nesta etapa**; toda a entrada é local.

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

## Testes

```bash
npm test
```

Os testes criam pacotes ZIP de exemplo em uma pasta temporária e não dependem de arquivos privados, contas ou rede.

## Próximas etapas (fora do MVP 01)

1. Validar contrato de entrega do Work (`manifest.json` + `ready.json` + ZIP V5).
2. Preparar fila e monitoramento local, respeitando a janela 09h–21h.
3. Adicionar Playwright + Chromium com contas autenticadas, sem postagem no primeiro teste de navegação.
4. Publicação sequencial e auditoria por plataforma, com controle de tentativas, confirmação e tolerância de 30 minutos.
