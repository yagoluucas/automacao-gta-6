# Prévia do Instagram sem publicação

`npm run preview:instagram` seleciona um trabalho local e executa apenas o Instagram no Chrome do bot. Use `npm run preview:instagram -- --image-id <UUID>` quando houver mais de um trabalho preparado. O comando não exige `YOUTUBE.mp4` nem executa o fluxo do YouTube. O fluxo passa o mouse sobre o painel da extensão INSSIST, abre Post assistant, escolhe Add files, envia a mídia, preenche a legenda e localiza o botão Publish Photo ou Publish Video. **O botão final não recebe clique.** A aba permanece aberta para revisão.

`npm run dev` continua executando Instagram e depois YouTube, no mesmo trabalho selecionado.

O trabalho selecionado deve conter `ready.json`, `manifest.json`, `INSTAGRAM.png`, `INSTAGRAM.jpg`, `INSTAGRAM.jpeg` ou `INSTAGRAM.mp4` e `LEGENDA_INSTAGRAM.txt`. Se o manifesto declarar `media.instagram`, esse arquivo é usado. A extensão precisa estar instalada e a conta precisa estar autenticada no perfil `.chrome-profile`.

Há uma pausa de 5 a 10 segundos após cada interação. Enviar o arquivo para a extensão pode criar um rascunho; repetir `npm run dev` pode iniciar outro upload. Se a prévia do Instagram falhar, o erro aparece no terminal e o YouTube ainda é tentado. `npm run preview:youtube` mantém o fluxo exclusivo do YouTube.
