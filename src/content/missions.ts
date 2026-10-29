// Testi delle missioni riscritti da Eve per il primo tratto di gioco. I file originali (public/game)
// restano intatti: questi testi si sovrappongono a quelli caricati, campo per campo.
//
// Regole: al massimo una sessantina di parole per mail; prima chi scrive e cosa vuole, poi cosa
// fare (programma e server), poi una o due frasi di storia. {user} è il nome del giocatore.

import type { MailMessage } from "../engine/types"

/** Mail riscritta: il corpo sostituisce quello originale nella stessa posizione; mittente e oggetto restano quelli originali se non indicati */
export type MailText = Partial<MailMessage> & { body: string }

export interface MissionText {
	begin?: MailText[]
	end?: MailText[]
	replyMailText?: string
	/** Consiglio pratico mostrato nel Diario sotto l'obiettivo */
	hint?: string
	/**
	 * Le mail di inizio arrivano solo quando questa missione è completata; fino ad allora la missione
	 * non compare nel Diario. Serve a non presentare tutto insieme al primo avvio.
	 */
	after?: string
	/** Sfida segreta: non compare mai nel Diario, il giocatore la scopre da solo */
	secret?: boolean
}

/** Chiave: percorso normalizzato della missione (come MissionDef.path) */
export const MISSION_TEXT: Record<string, MissionText> = {
	// Al primo avvio arriva solo la mail di 1ronCh4ng (tut0), quella che il tutorial fa aprire: il
	// benvenuto ripeteva i server già nella Network Map, la chat Underground arriva dopo la risposta.
	"def/000.miss": { begin: [] },
	"def/tut0.miss": {
		begin: [
			{
				body:
					"Hey {user}, benvenuto nella comunità!\n\n" +
					"Per cominciare fatti vedere sulla chat ivoice.mothernet e dai un'occhiata a sutra.underground: sono già nella tua Network Map.\n\n" +
					"Se ti serve una mano rispondi a questa mail. Una sola regola: niente allegati, a meno che non te li chieda io.\n\n" +
					"1ronCh4ng",
			},
		],
		hint: "Apri la mail, premi 'Rispondi' e poi 'Invia', senza allegati.",
	},
	"def/tut1.miss": {
		begin: [
			{
				body:
					"Ecco un aiutino: ti ho allegato tut_hack-1.0.\n\n" +
					"Gli allegati finiscono da soli nella tua memoria, e i programmi compaiono nel menu del Pulsante Applicazioni, in basso a sinistra. Aprilo e leggilo con calma.\n\n" +
					"1ronCh4ng",
			},
		],
	},
	"uground/a00.miss": {
		begin: [
			{
				from: "staff@underground",
				subject: "La chat della comunità",
				body:
					"Ciao {user}, la comunità Underground si ritrova sulla chat ivoice.mothernet.\n\n" +
					"Collegati dalla Network Map: è il modo migliore per farti conoscere, e nei log pubblici trovi le voci che girano nel Network.\n\n" +
					"Lo staff Underground",
			},
		],
		hint: "Apri la Network Map, clicca su ivoice.mothernet e poi su 'Connetti'.",
		after: "def/tut0.miss",
	},
	"xmiss/nmcha-01.miss": { secret: true },
	"uground/a01.miss": {
		begin: [
			{
				body:
					"Ciao {user}, ti ho visto in chat: mi serve aiuto, subito.\n\n" +
					"Intrapol tiene un dossier su di me: il file data.unsecure-8541569 sul server crimediv.intrapol (ora è nella tua Network Map). Cancellalo.\n\n" +
					"Il server ha un Login: forzalo con rootbreaker. Per non farti rintracciare passa da questi proxy:\n" +
					"232.451.593.12 (proxy.devtest)\n" +
					"212.192.168.3 (shadow.bellavista)\n\n" +
					"s0ftm4rk",
			},
		],
		end: [
			{
				body:
					"Mi hai salvato, {user}! Non lo dimenticherò.\n\n" +
					"Ti avevo promesso qualche account: collegati a eurodigibank.eurogroup e prova questi.\n" +
					"JJkarl / icntrst\n" +
					"MarkBx / krish\n" +
					"Kelly / LOVE\n\n" +
					"s0ftm4rk",
			},
		],
		hint: "rootbreaker costa 39 Cr. su warez.underground. Prima di disconnetterti elimina log.connections dal server, o Intrapol risalirà a te.",
	},
	"uground/a02.miss": {
		begin: [
			{
				body:
					"Caro {user}, grazie per aver aiutato s0ftm4rk: la comunità gli darà un'altra possibilità.\n\n" +
					"Ti abbiamo aperto karma.underground, la bacheca dei lavori della comunità. Accetta qualche sottoscrizione e porta il tuo Ranking a 250 punti.\n\n" +
					"Le regole della comunità sono su sutra.underground.\n\n" +
					"D1l3mm4 e lo staff Underground",
			},
		],
		hint: "Le sottoscrizioni di karma.underground danno Ranking e crediti. Anche entrare per la prima volta in un server protetto fa salire il Ranking.",
	},
	"uground/a03.miss": {
		begin: [
			{
				body:
					"Il tuo Ranking cresce, {user}: complimenti!\n\n" +
					"Un favore: il mio amico Paolo Stagna non risponde da giorni e ho saputo che ha avuto guai al lavoro. Se trovi sue notizie nel Network, rispondimi e raccontami cosa hai scoperto.\n\n" +
					"1ronCh4ng",
			},
		],
		replyMailText:
			"Ho trovato notizie del tuo amico, e non sono belle: Intrapol lo ha schedato. Pare abbia combinato un guaio sul server dell'azienda per cui lavorava e ora è agli arresti domiciliari.\n" +
			"Se posso aiutarti ancora, fammi sapere.",
		hint: "Cerca il nome di Paolo Stagna sui News Server o nel database di crimediv.intrapol, poi rispondi alla mail.",
	},
	"uground/a04.miss": {
		begin: [
			{
				body:
					"{user}, ho parlato con Paolo: lo hanno licenziato ingiustamente e lui, per protesta, ha violato il server dell'azienda.\n\n" +
					"Sul File Server file.wellmark c'è un file, dat.sell-20111213, che lo dimostra. Scaricalo e caricalo con fileforce su crimediv.intrapol: così Paolo se la cava con una multa.\n\n" +
					"1ronCh4ng",
			},
		],
		end: [
			{ body: "Lavoro eccellente, {user}! Ora voglio proprio vedere come se la cava il presidente della Wellmark.\n\n1ronCh4ng" },
			{
				body:
					"Ciao {user}, sono Paolo Stagna: 1ronCh4ng mi ha dato il tuo indirizzo.\n\n" +
					"Grazie a te Intrapol mi ha ridotto la pena a una multa di 2000 Cr., che pagherò con il risarcimento della Wellmark. Ti devo un favore.\n\n" +
					"Paolo",
			},
		],
		hint: "file.wellmark non è in mappa: scrivi 'resolve file.wellmark' nella console. fileforce costa 69 Cr. su warez.underground.",
	},
	"uground/a05.miss": {
		begin: [
			{
				from: "1ronCh4ng@mother",
				subject: "Fatti un nome",
				body:
					"{user}, per i lavori più interessanti ti serve più esperienza.\n\n" +
					"Porta il tuo Ranking a 370 punti: accetta sottoscrizioni su karma.underground o entra in server che non hai mai visitato. Quando ci sei, ti presento qualcuno.\n\n" +
					"1ronCh4ng",
			},
		],
		hint: "Le sottoscrizioni di karma.underground sono il modo più rapido per salire di Ranking.",
	},
	"uground/a06.miss": {
		begin: [
			{
				body:
					"Ciao {user}, sono RoM4N, un amico di 1ronCh4ng.\n\n" +
					"Ci serve che il Web Server web4.telemark (l'ho messo nella tua Network Map) vada giù per qualche minuto: mentre si riavvia noi prendiamo dei file. Usa nukelord, poi rispondimi.\n\n" +
					"Ti pago 60 Cr.\n\n" +
					"RoM4N",
			},
		],
		end: [{ body: "Fatto, {user}: i file sono nostri. Eccoti i 60 Cr. promessi, e i saluti di 1ronCh4ng.\n\nRoM4N" }],
		hint: "nukelord costa 19 Cr. su warez.underground e occupa molta banda. web4.telemark ha un firewall: se rifiuta la connessione, il messaggio ti dice da quale server passare.",
	},
	"xmiss/nmcha-02.miss": {
		begin: [
			{
				body:
					"Bravo... e perché avresti cancellato il mio file?\n\n" +
					"Visto quanto ci ho messo a trovarti, non mi sembri un granché. Fatti gli affari tuoi.\n\n" +
					"P.S. Quello che vedi sullo schermo è opera mia. Consideralo un avvertimento.\n\n" +
					"n3v3r_MIND",
			},
		],
		hint: "Il tuo sistema ha un virus: UAVsys è gratuito su warez.underground. Scaricalo e avvialo per ripulire il sistema.",
	},
}
