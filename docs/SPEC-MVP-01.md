# SPEC-MVP-01 — Inspeção de pacotes Feed V5

## Objetivo

Validar **somente no console** os pacotes locais já gerados pela skill GTA 6 PIRA Feed V5, de maneira determinística e sem executar nenhuma publicação.

## Responsabilidades

- **ChatGPT Work + skill Feed V5**: geram as mídias e legendas, criando o ZIP original `publifeed_DDMMYYHHMM.zip`.
- **Orquestrador Work**: usa os IDs de `public.images` / `public.image_publications` do Supabase para produzir `manifest.json` e cria `ready.json` por último.
- **Leitor Node/TypeScript**: lê as pastas e **confere**, mas não modifica, imagens, textos ou dados do Supabase.
- **Playwright/Chromium**: planejado para versão posterior. Não instalado, não inicializado e não invocado neste MVP.

## Contrato `manifest.json` v1

```json
{
  "schema_version": 1,
  "image_id": "11111111-1111-4111-8111-111111111111",
  "rule_set_code": "noticias",
  "approach": "noticia",
  "translate": false,
  "zip_file": "publifeed_2310261200.zip",
  "publications": [
    { "id": "22222222-2222-4222-8222-222222222222", "platform": "instagram", "scheduled_at": "2026-10-23T15:00:00-03:00" },
    { "id": "33333333-3333-4333-8333-333333333333", "platform": "youtube", "scheduled_at": "2026-10-23T15:00:00-03:00" },
    { "id": "44444444-4444-4444-8444-444444444444", "platform": "tiktok", "scheduled_at": "2026-10-23T15:00:00-03:00" }
  ]
}
```

- `image_id`: nome da pasta do trabalho, correspondente à imagem original em `images.id`.
- `publications`: apenas as redes agendadas de fato em `image_publications` (uma entrada por rede).
- `scheduled_at`: ISO 8601 com fuso; deve representar o mesmo instante em todas as redes da imagem.
- `zip_file`: apenas o nome do ZIP gerado pela V5, sem subdiretórios.
- `ready.json`: objeto JSON com `ready: true`, escrito somente quando os arquivos estiverem completos.
- A publicação programada permanece responsabilidade do Supabase; nenhuma data é inferida do nome ZIP.

## Regras funcionais

| ID | Aceite |
|---|---|
| RF-01 | Procurar `publicacoes/AAAA-MM-DD/<image_id>/` sem seguir links simbólicos durante a descoberta de pastas. |
| RF-02 | Ignorar como pendente qualquer trabalho sem `ready.json`. |
| RF-03 | Validar IDs, plataformas distintas e horário consistente no manifesto. |
| RF-04 | Ler ZIP V5 **sem extrair arquivos em disco**; rejeitar caminhos suspeitos, CRC inválido, entradas duplicadas e tamanhos excessivos. |
| RF-05 | Localizar `<REDE>.png` e `LEGENDA_<REDE>.txt` para cada rede de `publications`. |
| RF-06 | Validar cabeçalhos PNG e dimensões 1080 × 1350. Não se trata de inspeção visual de pixels. |
| RF-07 | Comparar a legenda individual com sua seção em `LEGENDAS.txt`. |
| RF-08 | Verificar as cinco hashtags padrão e o limite YouTube de 100 caracteres. |
| RF-09 | Exibir no console IDs, horários, regra, mídia, SHA-256 e texto integral de cada legenda. |
| RF-10 | Não acessar a rede, não abrir navegador, não publicar e não modificar os arquivos. |

## Controles técnicos

- Node.js 22.16+, TypeScript nativo (Node type stripping), **zero dependências de execução**.
- ZIP de até 60 MB; máximo 40 entradas, até 35 MB por arquivo e 125 MB descomprimidos acumulados.
- `manifest.json` e `ready.json` de até 128 KB; TXT de até 256 KB.
- Rejeição de ZIP64, arquivos criptografados e algoritmos de compressão fora de Stored/Deflate. Compatível com o ZIP comum gerado pelo compositor Python V5.
- Nunca fazer parsing das imagens para inferir legendas. O texto para publicação vem dos arquivos TXT.
- O pacote Feed V5 pode conter saídas para redes não agendadas (caso o Work tenha usado `todos`); o leitor só valida e apresenta as redes do manifesto.

## Fora do escopo

Reconhecer elementos visuais dentro da imagem, OCR, converter YouTube em MP4, agendar automaticamente execução local, monitorar pasta em tempo real, persistir status no Supabase, iniciar Playwright, autenticar ou postar nas redes.

## Teste manual de aceite

1. Criar pacote V5 com o plugin e gravar `manifest.json`, ZIP e `ready.json` no diretório correto.
2. Executar `npm run inspect -- --dir "D:\\programacao\\projetos\\bot-publicacao-gta\\publicacoes"`.
3. Confirmar no console imagem encontrada por plataforma, legenda correta, horário e ID.
4. Remover temporariamente `ready.json`: o leitor deve mostrar PENDING e não tentar consumir o ZIP.
5. Informar legenda divergente ou ZIP inválido: o leitor deve registrar ERROR e retornar código de saída 1.
