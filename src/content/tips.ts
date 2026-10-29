// Consigli di 1ronCh4ng: arrivano una sola volta, nel momento in cui il giocatore incontra per la
// prima volta un meccanismo del gioco. Due o tre righe, con i termini del glossario.

export const MENTOR = "1ronCh4ng"

export const TIPS = {
	multinode:
		"Bel lavoro con i nodi! Ogni nodo in più allunga la strada a chi vuole rintracciarti, ma raddoppia la banda occupata: tienila d'occhio nel Monitor di Sistema.",
	bandwidth:
		"Non hai abbastanza banda per quella connessione: 1 nodo occupa 20 MBps, 2 nodi 40, 3 nodi 80. Togli un nodo, chiudi i download o compra una scheda di rete più veloce.",
	firewall:
		"Quel server ha un firewall: accetta connessioni solo da un indirizzo preciso, scritto nel messaggio di errore. Mettilo come ultimo nodo prima della destinazione.",
	login:
		"Questo server chiede un Login. Senza credenziali serve un programma che lo forzi (in chat se ne parla), ma il server avvierà subito il backtrace: collegati passando da qualche nodo.",
	backtrace:
		"Il server ha avviato il backtrace: sta risalendo i tuoi nodi. Fai in fretta e disconnettiti prima che arrivi a te. backmirror ti mostra quanto manca.",
	forced:
		"Sei dentro! Il tuo indirizzo ora è nel log.connections del server: eliminalo prima di disconnetterti, o Intrapol ti notificherà il reato.",
	crime:
		"Intrapol ti ha rintracciato. La prossima volta usa più nodi (meglio un proxy) e cancella log.connections prima di uscire.",
	flashram:
		"La tua memoria è piena. Con 'ls' nella console vedi i file e con 'rm <file>' elimini quelli inutili; oppure compra un SSD più grande.",
	netbanking:
		"Un Netbanking: da qui puoi spostare crediti da un conto. Attento: rubare crediti abbassa il Karma, e oltre il limite del conto il server ti rintraccia.",
	class: "Sei salito di classe: ora sei {class}! Con più Ranking ti arriveranno lavori migliori su karma.underground.",
} as const

export type TipId = keyof typeof TIPS
