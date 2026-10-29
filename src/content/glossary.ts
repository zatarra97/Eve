// Glossario di Eve: i concetti del gioco spiegati a chi non conosce il gergo, con un'analogia.
// Non viene dai file originali: è un'aggiunta di Eve per insegnare il gioco giocando. I termini
// compaiono sottolineati in mail, tutorial e interfaccia; le voci incontrate si sbloccano nella Guida.

export type GlossaryCategory = "Il tuo sistema" | "Account" | "Network" | "Server" | "Protezioni" | "Rischi" | "Programmi"

export interface GlossaryEntry {
	id: string
	/** Nome mostrato nella Guida e nel titolo del riquadro */
	term: string
	category: GlossaryCategory
	/** Forme con cui il termine compare nei testi (maiuscole indifferenti) */
	aliases: string[]
	/** Una o due righe, con un'analogia */
	short: string
	/** Approfondimento per la Guida */
	long?: string
	related?: string[]
}

export const GLOSSARY: GlossaryEntry[] = [
	// --- il tuo sistema ---
	{
		id: "cpu",
		term: "CPU",
		category: "Il tuo sistema",
		aliases: ["CPU", "processore"],
		short: "Il motore del tuo sistema: più MHz ha, più in fretta lavorano i programmi, per esempio quelli che forzano un Login.",
		long: "Si misura in MHz. Ogni programma in esecuzione ne occupa una parte, visibile nel Monitor di Sistema. Una CPU più veloce si compra su un Commerce Server.",
		related: ["commerce"],
	},
	{
		id: "net",
		term: "Scheda di rete",
		category: "Il tuo sistema",
		aliases: ["scheda di rete", "schede di rete"],
		short: "Il componente che ti collega al Network. Stabilisce quanta banda hai a disposizione.",
		long: "La scheda iniziale offre 80 MBps. Una scheda più veloce permette connessioni con più nodi e download più rapidi; si compra su un Commerce Server.",
		related: ["banda", "commerce"],
	},
	{
		id: "banda",
		term: "Banda",
		category: "Il tuo sistema",
		aliases: ["banda", "MBps"],
		short: "La larghezza del tubo che ti collega al Network: ogni nodo, download o attacco ne occupa un pezzo.",
		long: "Si misura in MBps. Una connessione con 1 nodo occupa 20 MBps, con 2 nodi 40, con 3 nodi 80: raddoppia a ogni nodo. Se la banda libera non basta, la connessione non parte.",
		related: ["nodo", "net"],
	},
	{
		id: "flashram",
		term: "Memoria (SSD)",
		category: "Il tuo sistema",
		aliases: ["memoria", "ssd", "flashram", "flash ram"],
		short: "L'SSD del tuo sistema: qui stanno programmi, file scaricati e allegati delle mail.",
		long: "Si misura in MB e il sistema operativo ne occupa già una parte. Quando è piena non puoi scaricare altro: elimina i file che non servono o compra un SSD più grande.",
		related: ["cpu", "net"],
	},
	{
		id: "console",
		term: "Console",
		category: "Il tuo sistema",
		aliases: ["console"],
		short: "La riga di comando di Mother: scrivi un comando e premi Invio. 'help' elenca quelli disponibili.",
		long: "Comandi utili: 'resolve <nome>' per trovare un server e aggiungerlo alla mappa, 'connect <ip>' per collegarti, 'ls' per i file, 'missions' per le missioni in corso.",
		related: ["ip"],
	},

	// --- account ---
	{
		id: "ranking",
		term: "Ranking",
		category: "Account",
		aliases: ["ranking"],
		short: "Il tuo punteggio di esperienza: sale completando missioni e violando nuovi server.",
		long: "Il Ranking stabilisce la tua Classe (Lamer, Scripter, Coder, Hacker…) e quali sottoscrizioni puoi accettare. Se Intrapol ti rintraccia lo perdi in parte.",
		related: ["karma", "intrapol"],
	},
	{
		id: "karma",
		term: "Karma",
		category: "Account",
		aliases: ["karma"],
		short: "La tua reputazione morale nell'Underground: rubare crediti la abbassa.",
		long: "Il Karma non si vede nel Monitor di Sistema, ma conta: se scende troppo la tua Classe diventa Cracker o Master Cracker, la fama di chi lavora per sé e non per la comunità.",
		related: ["ranking", "netbanking"],
	},
	{
		id: "crediti",
		term: "Crediti",
		category: "Account",
		aliases: ["crediti", "Cr."],
		short: "La moneta del Network: si guadagnano con le missioni e si spendono per hardware e programmi.",
		related: ["commerce", "software"],
	},

	// --- network ---
	{
		id: "ip",
		term: "Indirizzo IP",
		category: "Network",
		aliases: ["IP", "indirizzo IP", "indirizzi IP"],
		short: "L'indirizzo di un server nel Network, come il numero civico di una casa. Serve per collegarsi.",
		long: "I server noti compaiono nella Network Map. Per gli altri puoi usare 'resolve <nome>' nella console, oppure 'connect <ip>' se conosci già l'indirizzo.",
		related: ["console", "nodo"],
	},
	{
		id: "nodo",
		term: "Nodo",
		category: "Network",
		aliases: ["nodo", "nodi", "multinodo"],
		short: "Un server di passaggio della tua connessione. Più nodi ci sono, più tempo serve per risalire a te.",
		long: "Nella Network Map ogni server cliccato diventa un nodo; l'ultimo è la destinazione. Ogni nodo in più rallenta il backtrace ma raddoppia la banda occupata.",
		related: ["proxy", "banda", "backtrace"],
	},
	{
		id: "proxy",
		term: "Proxy",
		category: "Network",
		aliases: ["proxy", "proxy server"],
		short: "Un intermediario che passa la tua connessione a un altro server: come una lettera spedita tramite un amico.",
		long: "Un Proxy Server usato come nodo vale doppio: chi ti rintraccia impiega molto più tempo a risalire la catena.",
		related: ["nodo", "backtrace"],
	},
	{
		id: "networkmap",
		term: "Network Map",
		category: "Network",
		aliases: ["network map", "NETCONN"],
		short: "La mappa dei server che conosci. Clicca i server per scegliere i nodi, poi 'Connetti'.",
		related: ["nodo", "ip"],
	},

	// --- server ---
	{
		id: "fileserver",
		term: "File Server",
		category: "Server",
		aliases: ["file server"],
		short: "Un archivio di file: puoi scaricarli, e con i permessi giusti eliminarli o caricarne di nuovi.",
		related: ["fileforce", "login"],
	},
	{
		id: "mailserver",
		term: "Mail Server",
		category: "Server",
		aliases: ["mail server"],
		short: "Un server di posta: contiene le mail dei suoi utenti.",
	},
	{
		id: "newsserver",
		term: "News Server",
		category: "Server",
		aliases: ["news server"],
		short: "Un giornale del Network: le notizie spesso parlano delle tue imprese.",
	},
	{
		id: "chatserver",
		term: "Chat Server",
		category: "Server",
		aliases: ["chat server", "chat"],
		short: "Una stanza di chat pubblica. Nei log restano conversazioni passate piene di informazioni utili.",
	},
	{
		id: "software",
		term: "Software Server",
		category: "Server",
		aliases: ["software server", "warez"],
		short: "Un negozio di programmi: si comprano con i crediti e finiscono nella tua memoria.",
		related: ["crediti", "flashram"],
	},
	{
		id: "commerce",
		term: "Commerce Server",
		category: "Server",
		aliases: ["commerce server"],
		short: "Un negozio di hardware: CPU, schede di rete e SSD più capienti.",
		related: ["cpu", "net", "flashram"],
	},
	{
		id: "subscription",
		term: "Subscription Server",
		category: "Server",
		aliases: ["subscription server", "sottoscrizione", "sottoscrizioni"],
		short: "Una bacheca di lavori: accetti una sottoscrizione, la completi e incassi la ricompensa.",
		related: ["ranking", "crediti"],
	},
	{
		id: "database",
		term: "Database Server",
		category: "Server",
		aliases: ["database server", "database"],
		short: "Un archivio di schede, per esempio il casellario di Intrapol.",
		related: ["intrapol"],
	},
	{
		id: "netbanking",
		term: "Netbanking Server",
		category: "Server",
		aliases: ["netbanking"],
		short: "Una banca del Network. Spostare crediti da un conto altrui abbassa il tuo Karma.",
		related: ["karma", "crediti"],
	},
	{
		id: "webserver",
		term: "Web Server",
		category: "Server",
		aliases: ["web server"],
		short: "Il server che pubblica un sito. È il bersaglio di nukelord.",
		related: ["nukelord"],
	},
	{
		id: "personal",
		term: "Personal Server",
		category: "Server",
		aliases: ["personal server"],
		short: "Il computer di un utente del Network. Collegato a un cluster ti presta la sua banda.",
		related: ["cluster"],
	},

	// --- protezioni ---
	{
		id: "login",
		term: "Login",
		category: "Protezioni",
		aliases: ["login"],
		short: "La porta d'ingresso di un server: servono nome utente e password. Senza, va forzata con un programma apposito.",
		long: "Forzare un login fa partire il backtrace del server e lascia il tuo indirizzo nei log.",
		related: ["backtrace", "log"],
	},
	{
		id: "keyfile",
		term: "Chiave crittografica",
		category: "Protezioni",
		aliases: ["keyfile", "chiave crittografica", "file chiave"],
		short: "Al posto della password il server chiede un file chiave: se lo hai in memoria, entri.",
		related: ["flashram"],
	},
	{
		id: "vrls",
		term: "VRLS",
		category: "Protezioni",
		aliases: ["VRLS", "riconoscimento vocale"],
		short: "Un lucchetto a riconoscimento vocale: serve un campione della voce giusta, che wavehacker sa registrare.",
		related: ["wavehacker"],
	},
	{
		id: "firewall",
		term: "Firewall",
		category: "Protezioni",
		aliases: ["firewall"],
		short: "Un buttafuori che accetta connessioni solo da certi indirizzi: l'ultimo nodo prima del server deve essere quello giusto.",
		related: ["nodo", "ip"],
	},

	// --- rischi ---
	{
		id: "backtrace",
		term: "Backtrace",
		category: "Rischi",
		aliases: ["backtrace", "rintracciare", "rintracciato"],
		short: "Il server che hai attaccato risale la tua connessione nodo per nodo. Se arriva fino a te prima che ti disconnetta, sei preso.",
		long: "Parte quando forzi una protezione. Più nodi (e proxy) usi, più tempo impiega. backmirror mostra quanto manca e lo rallenta.",
		related: ["nodo", "proxy", "backmirror", "intrapol"],
	},
	{
		id: "log",
		term: "Log delle connessioni",
		category: "Rischi",
		aliases: ["log.connections", "log", "tracce"],
		short: "Il registro degli accessi di un server: dopo un accesso forzato contiene il tuo indirizzo. Eliminalo prima di disconnetterti.",
		long: "Se alla fine della sessione le tracce sono ancora nel log, dopo circa un minuto Intrapol ti notifica il reato.",
		related: ["intrapol", "backtrace"],
	},
	{
		id: "intrapol",
		term: "Intrapol",
		category: "Rischi",
		aliases: ["intrapol"],
		short: "La polizia del Network. Se ti rintraccia perdi Ranking (e crediti, se ti prende in diretta).",
		long: "Un server violato e denunciato viene posto sotto sequestro per qualche minuto: non è raggiungibile finché Intrapol non lo ripristina.",
		related: ["backtrace", "log", "ranking"],
	},
	{
		id: "virus",
		term: "Virus",
		category: "Rischi",
		aliases: ["virus"],
		short: "Un programma ostile che può infettare il tuo sistema: ruba banda, CPU o crediti. UAVsys lo rimuove.",
	},

	// --- programmi ---
	{
		id: "rootbreaker",
		term: "rootbreaker",
		category: "Programmi",
		aliases: ["rootbreaker"],
		short: "Forza l'accesso a un server protetto da Login. Più veloce è la tua CPU, prima finisce.",
		long: "Si compra su un Software Server. Appena lo avvii il server inizia il backtrace: lavora in fretta e cancella il log.",
		related: ["login", "cpu", "backtrace"],
	},
	{
		id: "wavehacker",
		term: "wavehacker",
		category: "Programmi",
		aliases: ["wavehacker"],
		short: "Registra una voce da una linea telefonica e la usa per superare un VRLS.",
		related: ["vrls"],
	},
	{
		id: "backmirror",
		term: "backmirror",
		category: "Programmi",
		aliases: ["backmirror"],
		short: "Lo specchietto retrovisore: mostra il backtrace in corso e lo rallenta finché resta aperto.",
		related: ["backtrace"],
	},
	{
		id: "fileforce",
		term: "fileforce",
		category: "Programmi",
		aliases: ["fileforce"],
		short: "Carica un file della tua memoria su un server in cui sei entrato.",
		related: ["fileserver", "flashram"],
	},
	{
		id: "nukelord",
		term: "nukelord",
		category: "Programmi",
		aliases: ["nukelord", "nuke"],
		short: "Sommerge un Web Server di richieste finché non cede. Occupa molta banda.",
		related: ["webserver", "banda"],
	},
	{
		id: "cluster",
		term: "Cluster",
		category: "Programmi",
		aliases: ["cluster"],
		short: "Una rete di Personal Server che lavorano per te: ognuno ti presta la sua banda.",
		related: ["personal", "banda"],
	},
]

const BY_ID = new Map(GLOSSARY.map((e) => [e.id, e]))

export function glossaryEntry(id: string): GlossaryEntry | undefined {
	return BY_ID.get(id)
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** Tutti gli alias, dal più lungo (così "proxy server" vince su "proxy") */
const ALIASES = GLOSSARY.flatMap((e) => e.aliases.map((a) => ({ alias: a.toLowerCase(), id: e.id }))).sort((a, b) => b.alias.length - a.alias.length)
const ALIAS_ID = new Map(ALIASES.map((a) => [a.alias, a.id]))
// Parole intere: niente lettere, cifre o punti attaccati (così "log" non scatta in "blog" né in "log.clientconn1")
const PATTERN = new RegExp(`(?<![\\p{L}\\p{N}_.])(${ALIASES.map((a) => escape(a.alias)).join("|")})(?![\\p{L}\\p{N}_]|\\.[\\p{L}\\p{N}])`, "giu")

export interface TermMatch {
	id: string
	start: number
	end: number
}

/** Termini del glossario presenti nel testo, in ordine */
export function findTerms(text: string): TermMatch[] {
	const out: TermMatch[] = []
	for (const m of text.matchAll(PATTERN)) {
		const id = ALIAS_ID.get(m[0].toLowerCase())
		if (id) out.push({ id, start: m.index, end: m.index + m[0].length })
	}
	return out
}
