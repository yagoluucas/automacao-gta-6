# MVP — Prévia de upload YouTube Shorts (SEM publicação)

Executar a partir da raiz do repositório:

```bash
npm install
npm run typecheck
npm test
npm run dev -- --image-id <UUID_DA_IMAGEM>
```

`npm run dev` abre as três abas, prepara primeiro o Instagram e depois executa o preview do YouTube. `npm run preview:youtube` executa apenas o fluxo do YouTube. Use `npm run inspect` para apenas inspecionar o pacote Feed V5. **Não há confirmação de publicação e nenhum registro do Supabase é alterado**. Cada execução do preview pode iniciar um novo upload, então evite repetir o comando sem necessidade.

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

Abre Chrome com o perfil persistente da aplicação e seleciona a aba do YouTube. Clica em Criar → Enviar vídeo, escolhe o MP4 local, preenche título e descrição, marca “Não é conteúdo para crianças”, avança pelas três etapas e seleciona “Público”. O seletor de Publicar é localizado para revisão, mas **não recebe clique**. A seleção do arquivo pode iniciar upload e criar um rascunho no YouTube; não repita o teste de upload indiscriminadamente.

O YouTube Studio varia por idioma e versão. Caso os seletores não correspondam à interface atual, a execução interrompe e você poderá inspecionar a página manualmente; os seletores precisarão ser ajustados com um print/inspeção real da sua interface.

## Esperas

```dotenv
BOT_NAVIGATION_TIMEOUT_MS=30000
```

Entre as interações do preview há uma pausa variável de 5 a 10 segundos para a interface estabilizar. O Playwright também aguarda os elementos ficarem disponíveis. A pausa não garante evitar mecanismos de detecção.

## Segurança

Sem login automático e sem leitura de `PASSWORD_*`. Sem publicar, sem mudar status de fila e sem retry após upload ambíguo. O perfil local mantém cookies de sessão: nunca envie `.chrome-profile` para o GitHub. A branch preserva a publicação real como etapa futura, sujeita a testes e confirmação.
