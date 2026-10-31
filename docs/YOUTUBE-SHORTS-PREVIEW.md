# MVP — Prévia de upload YouTube Shorts (SEM publicação)

Executar a partir da raiz do repositório:

```bash
npm install
npm run typecheck
npm test
npm run preview:youtube -- --image-id <UUID_DA_IMAGEM>
```

`npm run dev` continua abrindo as três redes e inspecionando Feed V5. Apenas `preview:youtube` aciona este fluxo de teste; **não há confirmação de publicação e nenhum registro do Supabase é alterado**.

## Contrato local do vídeo (provisório, separado do pacote Feed V5)

```text
../publicacoes/
  AAAA-MM-DD/
    <image_id>/
      manifest.json
      ready.json
      YOUTUBE.mp4
      LEGENDA_YOUTUBE.txt
```

O manifesto deve conter `image_id`, `scheduled_at` em ISO 8601 com fuso e `publication_ids.youtube` (UUID válido), ou `publications[]` com `id`, `platform: "youtube"` e `scheduled_at`. Não exige `schema_version` nem ZIP de feed. O vídeo deve ser MP4 e a primeira linha da legenda será utilizada como título (até 100 caracteres). O bot NÃO converte outros formatos, NÃO verifica duração/proporção do vídeo e NÃO garante classificação como Short; valide essas informações antes de usar o teste.

## Comportamento

Abre Chrome com o perfil persistente da aplicação, acessa `studio.youtube.com`, tenta localizar o comando Criar/Enviar vídeos, seleciona o MP4 pelo campo de arquivo e preenche título e descrição. **Não clica em Próximo, Salvar ou Publicar**. A seleção pode iniciar upload e criar rascunhos privados no YouTube; não repita o teste de upload indiscriminadamente.

O YouTube Studio varia por idioma e versão. Caso os seletores não correspondam à interface atual, a execução interrompe e você poderá inspecionar a página manualmente; os seletores precisarão ser ajustados com um print/inspeção real da sua interface.

## Esperas

```dotenv
BOT_NAVIGATION_TIMEOUT_MS=30000
BOT_UI_SETTLE_MS=2000
```

Esses parâmetros permitem a interface estabilizar e completar carregamentos; não simulam comportamento humano nem garantem evitar mecanismos de detecção. O Playwright também aguarda os elementos ficarem disponíveis antes de interagir.

## Segurança

Sem login automático e sem leitura de `PASSWORD_*`. Sem publicar, sem mudar status de fila e sem retry após upload ambíguo. O perfil local mantém cookies de sessão: nunca envie `.chrome-profile` para o GitHub. A branch preserva a publicação real como etapa futura, sujeita a testes e confirmação.
