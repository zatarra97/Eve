# Riferimento: Mother 1.02 (originale)

Osservazioni fatte avviando `Mother.exe` (v1.0 + upgrade 1.02) il 23/10/2026, più quanto si ricava da
`Manuale.html`, `Modding HOW-TO.html` e `Scripting HOW-TO.html`. Gli screenshot stanno fuori dal repo
(scratchpad di sessione) e non sono necessari per lavorare: qui c'è tutto quello che servono.

## Schermo e coordinate

- Risoluzione di gioco **1024×768**, sempre a schermo intero (impostazione interna all'exe GM6).
- Font: monospace bitmap piccolo (≈11px) per testi di sistema; un font "tecnico" largo (stile Eurostile)
  per titoli e testi dei terminali. Palette: blu scuro/nero, bordi azzurri `#3a8fe0`-ish, testo
  bianco/azzurro, evidenziazione verde per la banda in uso alta.
- Sfondo: `wallpaper_N.jpg` (4 varianti), a tutto schermo.

## Avvio

1. Schermata BIOS (testo monospace su nero, logo "AM Enerspec"):
   ```
   Advanced Megabios v7.21.348 - Enerspec Certified Solution
   Copyright (C) 2009-2012 Advanced Megabios Corporation
   WM13PACR6293 V9.1 220612
   Advanced Megabios Plug and Play BIOS Extension v2.02a
   Copyright (C) 2009, Advanced Megabios Corp.
       Rilevamento CPU      ... Warbit Ecostar 1000 [ 1015 Mhz ]
       Rilevamento Flashram ... 47-Logic Ulisse 1 Gyga [ 1024 MByte ]
       Rilevamento Rete     ...
   ```
   (l'hardware riportato è quello dell'account / quello di default).
2. Schermata di login: in alto a sinistra `// connesso a localhost` (azzurro, piccolo), sotto il testo
   grande "Benvenuto in Mother, / Sei pregato di autenticarti con le tue credenziali. Nel caso in cui tu ne
   sia sprovvisto, puoi registrare un nuovo account." Box centrale **LOGIN RICHIESTO** con
   `Username:` e `Password:` + pulsante `Login...`. In basso a sinistra pulsante di spegnimento, in basso
   a destra pulsanti info (`i`) e impostazioni.
3. Credenziali inesistenti → dialog "Le credenziali specificate non esistono, vuoi registrare questi dati
   come un questo utente?" [Annulla] [Conferma].
4. Primo accesso → dialog "Giocare a Mother per la prima volta potrebbe risultare piuttosto difficile…
   Vuoi che venga eseguito il tutorial introduttivo sull'interfaccia utente di Mother?"
   [Esegui Tutorial] [Salta Tutorial].

Dialog di sistema: box blu con bordo azzurro e angoli smussati, testo bianco in alto, pulsanti in basso a
destra con forma a "linguetta".

## Desktop

- **Sysmon** in alto a destra (x≈772–1022): intestazione `Mother OS vers. 1.02` + data/ora
  (`Giovedì, 22/10/2012 00:27:13` — anno di gioco **2012**, giorno/mese/ora reali).
  - Compresso: tre barre `Utilizzo CPU 0%`, `Utilizzo Banda 0%`, `Spazio Occupato 12%` (la barra si
    riempie col colore della percentuale; verde quando la banda è alta) + pulsante ▼.
  - Espanso: ogni riquadro mostra anche modello e `Usati X/Y Mhz|MBps|Mb`, e compare
    `== Info Utente ==` con `Account : eve@mother`, `Ranking : 100`, `Classe : Lamer`, `Crediti : 60`.
- **Pulsante Applicazioni** "M" in basso a sinistra. Menu a voci impilate verso l'alto:
  - prima i programmi in flashram (es. `tut_hack-1.0`), poi separatore `=====`,
  - `Apri Network Map`, `Apri Console`, separatore,
  - offline: `Logout <utente>`; online: `Logout Server` e `Disconnetti`.
- **Icone mail** in basso a destra, una per messaggio, aggiunte verso sinistra (la più recente a
  sinistra). L'icona del messaggio aperto diventa rossa. Cliccarla di nuovo chiude il visualizzatore.
- Il **visualizzatore mail** si apre in alto a destra al posto del Sysmon: `Da: …`, `Oggetto: …`, corpo
  con scrollbar, pulsanti [Rispondi] [Elimina].
  - Rispondi: `Per: …`, `RE: <oggetto>`, `Allegato:`; il corpo si compila **da solo** con
    `ReplyMailText` della missione (effetto macchina da scrivere). Pulsanti [Allega File...] [Invia...].
  - Le risposte arrivano dopo un ritardo di alcuni secondi (≈10–30 s).
  - Gli allegati ricevuti vengono salvati automaticamente in flashram.

## Account iniziale

| Voce | Valore |
|---|---|
| CPU | Warbit Ecostar 1000 — 1000 MHz |
| Rete | Mill Comm Etherlord 8M — 80 MBps |
| Flashram | 47-Logic Ulisse 1 Gyga — 1024 MB, **120 MB già occupati** (12%) |
| Ranking | 100 (Lamer) |
| Crediti | 60 |
| Indirizzo | `<utente>@mother` |

## Network Map (NETCONN)

- Pannello a tutta larghezza `x 0–1024, y 50–434` con `earth_map.jpg` (1280×640) **stirato**:
  `schermoX = MapX × 0.8`, `schermoY = 50 + MapY × 0.6`.
- Server noti = icone bianche "a vortice" animate; **localhost** = quadratino bianco fisso in posizione
  fittizia (≈ x 731, y 75).
- Hover su un server → popup azzurro con `servername`, `[IP]`, `ServerType`.
- Click su un server = aggiunge un **nodo**; viene tracciata una linea da localhost al primo nodo e tra
  nodi successivi. Pulsanti: [Chiudi] (sinistra), [Annulla Nodo] [Connetti] (destra).
- Connetti: la mappa si chiude, in alto a sinistra compare `// chiamata remota...` e l'IP digitato
  carattere per carattere (`// 547.2.8.7…`), poi `// connesso a <servername>`.
- **Banda**: 1 nodo = 20 MBps (25% di 80), 2 nodi = 40 MBps. Il tutorial dice che cresce
  "esponenzialmente" col numero di nodi → modello `20 × 2^(n-1)`.

## Terminale (esempio Commerce Server)

- In alto a sinistra il `WelcomeText` in grande (es. "Jimmy's Hardware Commerce Server / Benvenuto nel
  canale online di vendita hardware No.1 al mondo.").
- Lista con scrollbar (x 8–760, y 60–362), voci con icona a rombo:
  `Cpu: Warbit Ecostar 1000 [1000 Mhz] Costo: 150 Crediti`,
  `Scheda di Rete: … [80 Mbps] Costo: …`, `Flashram: … [1024 Mb] Costo: …`.
- Pulsante azione sotto la lista a destra (`Acquista...`).

## Console

- Pannello in basso a sinistra (x 0–540, y 588–718) con scrollbar.
- Prima riga: `*** Apertura nuova sessione per eve@mother. [ Giovedì, 22/10/2012 00:27:08 ]`.
- Registra gli eventi di rete: `Connesso al server remoto!`, `Disconnesso dal Network.`.
- Prompt: `[eve@mother]/>` con cursore `_`. Comando ignoto → `comando sconosciuto!`.
- L'elenco di `help` non è stato catturato (l'input sintetico non funziona con GM6). Comandi noti dalla
  documentazione: `connect <ip>`, `resolve <servername>`, `refreshservers`, `addmission <percorso>`,
  `debug 0|1`, `runscript`, `lsscript`, `killscript`, `removeserver`, `ls`, `run <programma>`, `exit`,
  `help`. Dal manuale: telefoni chiamabili "tramite una particolare procedura via console".

## Tutorial base (testi, in ordine)

1. "Benvenuto! Questo tutorial ha lo scopo di descriverti l'interfaccia utente di Mother e tutte le
   relative componenti. Clicca su 'Continua' per proseguire..."
2. Pulsante Applicazioni → cliccarlo; spiegazione del menu; richiuderlo.
3. Monitor di Sistema → espanderlo; spiegazione di Account, Ranking, Classe, Crediti.
4. Network Map → aprirla; icone bianche; hover; localhost fittizio; impostare un nodo; Connetti; il
   Terminal Server; disconnettersi dal menu.
5. Connessione multinodo: due nodi, consumo di banda, avviso di non saturarla.
6. Posta: icone in basso a destra, aprire la mail, chiuderla; arriva la mail di 1ronCh4ng
   (`tut0`), rispondere senza allegati, inviare; arriva "Ecco l'aiuto..." con `tut_hack-1.0` in flashram.
7. Chiusura: "Il tutorial base di Mother si conclude qui… collegati ad un chat server e cerca le
   informazioni che desideri all'interno dei log pubblici. Clicca su 'Chiudi' per terminare".

Il tutorial è un overlay in basso al centro (x 312–712, y 666–766) con [Continua] / [Chiudi] e testo a
macchina da scrivere; alcuni passi non hanno pulsante e attendono l'azione richiesta.

## Valori di configurazione noti (`failsafe.cfg`)

`CrimeNotificationSteps=2000`, `RefreshingServerSteps=6000` (step GM6 a 30 fps ≈ 67 s e 200 s):
probabili intervalli di notifica dei reati (rintracciamento) e di ripristino dei server violati.
Altre opzioni: `OpenNewMail`, `ShowMailPreview`, `RememberPassword`, `DontCreateAutosave`,
`SaveConsoleBuffer`, `WallpaperIndex`, `DisableBGMusic`, `AbortOnDisconnect`.
