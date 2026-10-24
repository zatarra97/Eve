# Eve

Remake web di **Mother** (2005-2007), il simulatore di hacking / interactive fiction di
Massimo "v4ldemar" Pinzaglia (Valdemar Indie Software). Il motore interpreta direttamente i file
originali del gioco (`.svr`, `.miss`, `.script`, in sintassi GML), quindi anche le mod funzionano
così come sono.

## Avvio

```sh
npm install
npm run dev
```

I contenuti originali sono già in `public/game/`. Per rigenerarli da un'installazione di Mother
(la cartella che contiene `Mother.exe`; le successive sovrascrivono le precedenti):

```sh
npm run import -- <cartella Mother 1.0> [<cartella upgrade 1.02>]
```

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm run dev` | server di sviluppo |
| `npm run build` | typecheck e build in `build/` |
| `npm test` | test (interprete GML su tutti i file originali, scenari di gioco) |
| `npm run lint` | oxlint |

## Struttura

- `src/engine/` — motore senza React: interprete GML (`gml/`), caricamento contenuti, stato di
  partita, rete, missioni, script, virus, salvataggi
- `src/Pages/`, `src/Components/` — interfaccia (palco alto 768 px come l'originale, largo quanto la finestra)
- `scripts/import-original.ts` — importa i contenuti del gioco originale
- `docs/riferimento-originale.md` — interfaccia e meccaniche osservate nell'originale

## Stato

Giocabili: avvio, login e account, desktop, Sysmon, posta con risposte delle missioni, Network Map
e connessioni, console con i comandi di gioco, terminali dei server (file, news, mail, negozi,
sottoscrizioni, database, chat, netbanking), programmi MomPad, UAVsys, MomAMP, tut_hack, rootbreaker,
wavehacker, backmirror, fileforce, nukelord e netpatch6231, backtrace e sequestro dei server, distruzione dei server
(riavvio senza file di sistema, nuke dei Web Server), cluster di Personal Server (stato nel Sysmon),
impostazioni, salvataggi (F5/F9).

Da fare: tutorial guidato sullo schermo,
caricamento delle mod dall'interfaccia, icone vettoriali della schermata di login.

## Licenza

Contenuti originali di v4ldemar sotto licenza CC BY-NC-SA 3.0: vedi [ATTRIBUTION.md](ATTRIBUTION.md).
