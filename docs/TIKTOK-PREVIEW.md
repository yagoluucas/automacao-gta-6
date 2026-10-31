# Prévia do TikTok sem publicação

`npm run preview:tiktok` executa apenas o fluxo de preparação do TikTok. Use `npm run preview:tiktok -- --image-id <UUID>` quando houver mais de um trabalho preparado. O comando não exige arquivos do YouTube nem do Instagram.

O trabalho local deve conter `ready.json`, `manifest.json`, `LEGENDA_TIKTOK.txt` e uma mídia `TIKTOK.mp4`, `.png`, `.jpg`, `.jpeg` ou `.webp`. Se o manifesto declarar `media.tiktok`, esse nome é usado. O bot escolhe a aba Vídeos ou Fotos conforme a mídia, seleciona o arquivo e preenche a legenda. Para foto, abre Adicionar som; para vídeo, abre Sons. Em ambos os casos, abre uma faixa aleatória dos Favoritos e confirma pelo botão **Use**. Para vídeo, então ajusta o volume para `-27 dB` e clica em Salvar. Se a lista estiver vazia ou o botão não aparecer, a prévia mostra erro. Depois rola até o botão Publicar. **O botão não recebe clique.** A tela permanece aberta para revisão.

`npm run dev` prepara TikTok → YouTube → Instagram no mesmo trabalho. Há uma pausa de 5 a 10 segundos após cada interação de interface. Enviar o arquivo pode criar um rascunho; repetir o comando pode iniciar outro upload.
