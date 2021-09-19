# SETA TTS

## Prerequisiti

-   [Node.js](https://nodejs.org/ "Node.js")

## Installazione

Per prima cosa installa la voce Roberto, è presente il file `Voce_Roberto.zip` in `\\srvfile2\Gruppi$\CED\DataBase Sintesi Vocale` con le relative istruzioni.

Questo programma non usa Loquendo, usa la versione CLI di Balabolka chiamata "balcon", un tool per il TTS gratuito.
È già inclusa nel repository all'interno della cartella `bin` quindi non è necessaria un'ulteriore installazione.

Clona il repository con `git clone https://github.com/Bitrey/seta-tts.git` e installa tutte le dependencies con `npm install`.

Per utilizzare il programma come sviluppatore (con hot reload) esegui `npm run dev`, per compilare una build `npm run build`, per compilare una build e farlo partire `npm run cli`.

### Classe `Encoder`

Utilizzata per la codifca dei file audio nel formato desiderato

### Oggetto `logger`

Logger con diversi livelli che salva su file
