// Tipi dei contenuti di gioco (definizioni caricate dai file originali) e dello stato di partita.

export type Prim = number | string

export const TERMINALS = [
	"FileServer",
	"MailServer",
	"NewsServer",
	"ChatServer",
	"SoftwareServer",
	"CommerceServer",
	"SubscriptionServer",
	"DatabaseServer",
	"NetbankingServer",
	"Phone",
	"Cluster",
] as const
export type TerminalKind = (typeof TERMINALS)[number]

export type ProtectionKind = "Login" | "KeyFile" | "VRLS"

export interface ServerUser {
	username: string
	/** Login: password; KeyFile: nome del file chiave; VRLS: campione vocale ("snd_phone_admin:N") */
	password: string
	userClass: string
	ranking: number
	credits: number
}

/**
 * Risorsa su un server o in flashram. Il significato dei campi dipende dal terminale
 * (vedi Modding HOW-TO §2.4): per un Software Server img = costo e owner = descrizione, ecc.
 */
export interface GameFile {
	name: string
	dim: number
	img: Prim
	contents: string
	owner: Prim
}

export interface ServerDef {
	ip: string
	name: string
	/** Descrizione del tipo; vuota = Server Hiding (non risolvibile) */
	type: string
	welcome: string
	mapX: number
	mapY: number
	terminal: TerminalKind | null
	protection: ProtectionKind | null
	firewall: boolean
	firewallMask: string
	hacked: boolean
	background: Prim
	cpu: number
	net: number
	cantBeHacked: boolean
	cantBeNuked: boolean
	cantBeDestroyed: boolean
	allowRandomMission: boolean
	missGenFaction: string
	users: ServerUser[]
	files: GameFile[]
	/** File sorgente (percorso nel pacchetto contenuti) */
	source: string
}

export interface MailMessage {
	from: string
	subject: string
	body: string
}

export interface NewsItem {
	server: string
	title: string
	body: string
}

export type MissionType =
	| ""
	| "SendMailTo"
	| "FileDeleting"
	| "FileUploading"
	| "LocalFileExists"
	| "GetRanking"
	| "ChatPartecipation"
	| "ServerDestruction"
	| "ClusterCreation"
	| "ClusterDestruction"

export interface MissionDef {
	/** Percorso normalizzato del file (es. "uground/a00.miss") */
	path: string
	id: string
	name: string
	type: MissionType
	begin: MailMessage[]
	targetMailFrom: string
	targetMailSubject: string
	targetMailAttachment: string
	noMailNeeded: boolean
	refServerIP: string
	refRemoteFileToDelete: string
	refRemoteFileUploaded: string
	targetChatServerIP: string
	rankingToGet: number
	localFileName: string
	clusterExeName: string
	clusterMaxClients: number
	credits: number
	extraRanking: number
	nextMission: string
	serverIPToRemove: string
	replyMailText: string
	end: MailMessage[]
	endNews: NewsItem[]
}

// --- stato di partita (serializzabile) ---

export interface HardwarePart {
	name: string
	desc: string
	/** MHz per la CPU, MBps per la rete, MB per la flashram */
	value: number
}

export interface Mail extends MailMessage {
	id: number
	/** Allegato ricevuto (già salvato in flashram all'arrivo) */
	attachment?: GameFile
	read: boolean
	/** Ora di gioco (ms dall'epoca) */
	date: number
	/** true per le mail inviate dal giocatore */
	sent?: boolean
	/** Missione di cui è la mail di inizio (percorso): la mail mostra il suo obiettivo */
	mission?: string
}

export interface ActiveMission {
	def: MissionDef
	/** Missione completata, in attesa delle mail di fine */
	done?: boolean
	/** Sottoscrizione accettata da un Subscription Server */
	subscription?: boolean
	startedAt: number
	/** Missione casuale (MissGen): ritirata a questo timestamp se non è stata completata */
	expiresAt?: number
	/** Mail di inizio trattenute finché non si completa questa missione (MissionText.after) */
	waitingFor?: string
}

/** Stato a runtime di un server, sovrapposto alla definizione */
export interface ServerState extends ServerDef {
	/** Disconnesso temporaneamente da un nuke (timestamp di ritorno) */
	nukedUntil?: number
	/** Sistema operativo distrutto: non risponde più */
	destroyed?: boolean
	/** Server rimosso dal Network da una missione o dal giocatore */
	removed?: boolean
	/** Sotto sequestro Intrapol fino a questo timestamp */
	seizedUntil?: number
	/** Tracce lasciate dal giocatore (indirizzo nei log) e quando */
	traces?: { at: number; ranking: number }
	/** Righe aggiunte ai log della chat */
	chatLog?: string[]
	/** Il giocatore ha forzato almeno una volta l'accesso (per il ranking di default) */
	everHacked?: boolean
}

export interface ScheduledEvent {
	at: number
	kind: "mail" | "missionEnd" | "crime" | "refreshServer" | "message"
	payload: Record<string, unknown>
}
