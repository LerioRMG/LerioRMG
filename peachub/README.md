# PEACHUB — Magazine + Peach Clips

Dominio previsto: https://thepeachub.com · Telegram: https://t.me/thepeachub

## Stato
Questa è una base frontend statica, non un CMS di produzione.

La homepage segue l'ordine editoriale rilevato su HubbersWorld: apertura, Creator consigliate, News, Compilation, Consigli, Approfondimenti, Recupera anche. Gli articoli e i profili sono contenuti dimostrativi, non notizie vere.

### Peach Clips — feed verticale funzionante
Aprire `clips.html` dal sito (oppure cliccare «Peach Clips» nel menu). Funziona con:
- scorrimento verticale con snap a tutto schermo;
- riproduzione automatica del video visibile, quando consentita dal browser;
- pausa/riprendi, audio on/off, pulsante prossimo video;
- tastiera su desktop (frecce e spazio);
- progress bar e condivisione link;
- nome, caption e link social/creator;
- pausa dei video fuori schermo;
- preview locale con file del telefono, senza alcun caricamento remoto.

La pagina legge il file `clips.json`. Inizialmente contiene `[]` quindi non mostra contenuti inventati. Per pubblicare una clip pubblica, caricare un MP4 autorizzato su `/var/www/peachub/media/clips/video1.mp4`, poi compilare `clips.json` con dati del tipo:

```json
[
  {
    "id": "video1",
    "src": "/media/clips/video1.mp4",
    "creator": "NomeArtistico",
    "caption": "Descrizione della clip",
    "profile": "https://thepeachub.com/#/creators",
    "instagram": "https://instagram.com/PROFILO",
    "telegram": "https://t.me/PROFILO",
    "onlyfans": "https://onlyfans.com/PROFILO",
    "approved": true,
    "explicit": false
  }
]
```

Sostituire i link di esempio con URL verificati, e utilizzare `approved:true` esclusivamente dopo conferma documentata dei diritti e della maggiore età di ogni persona presente. I video espliciti **non** devono essere pubblicati nello storage pubblico o in questo manifest.

Il player accetta solo URL dello stesso sito in HTTP (se in locale) o HTTPS, e URL HTTPS esterni, ma la presenza di un URL nel manifest non costituisce una verifica dei diritti. Preferire MP4 H.264/AAC per compatibilità iPhone.

### Limiti
- Non esiste ancora un upload video persistente dal browser o un pannello editoriale; il file picker di Peach Clips è soltanto per la prova sul dispositivo.
- I file reali devono essere aggiunti all'hosting e referenziati in `clips.json`.
- Mancano CMS, database, login admin, analytics reali e profili creator effettivi.
- Privacy e termini sono segnaposto, non pubblicare testi legali fittizi.
- L'area 18+ è disattivata e non deve ospitare materiale esplicito senza age verification conforme e controlli legali.

### Aggiornare PEACHUB sulla VPS
Se la prima installazione ha copiato solo la cartella `peachub` in `/var/www/peachub` senza clonare `.git`:

```bash
tmp=$(mktemp -d) && git clone --depth 1 --branch peachub-magazine-preview https://github.com/LerioRMG/LerioRMG.git "$tmp/repo" && sudo cp -a "$tmp/repo/peachub/." /var/www/peachub/ && rm -rf "$tmp" && echo "PEACHUB aggiornato"
```

Questo aggiorna soltanto i file nella directory PEACHUB, non esegue un reload Nginx e non modifica altri siti. Se `clips.json` è stato personalizzato direttamente sulla VPS, farne una copia prima di aggiornare: il comando lo sovrascrive con la versione GitHub.

## Nota repository
Questo codice è sul ramo `peachub-magazine-preview` di `LerioRMG/LerioRMG` perché non era disponibile la creazione di un nuovo repository con il connettore. Non tocca i rami di produzione degli altri progetti.
