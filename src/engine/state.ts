// Stato di partita di un account: tutto ciò che va salvato. È JSON puro.

import { START_CREDITS, START_HARDWARE, START_RANKING } from "./balance"
import type { ActiveMission, GameFile, HardwarePart, Mail, ScheduledEvent, ServerState } from "./types"

export const SAVE_VERSION = 1

/**
 * Impostazioni salvate con la partita. Solo `wallpaper` è per account (lo cambiano anche gli
 * script, System.WallpaperIndex); le altre opzioni ora sono generali del browser, in
 * src/store/settings.ts, e questi campi restano solo per compatibilità con i salvataggi.
 */
export interface GameSettings {
	openNewMail: boolean
	mailPreview: boolean
	music: boolean
	wallpaper: number
	autosave: boolean
}

export interface GameState {
	version: number
	user: string
	password: string
	/** Ora di gioco in ms (epoca Unix); avanza solo mentre si gioca */
	clock: number
	ranking: number
	credits: number
	/** Morale verso l'Underground: azioni da cracker lo abbassano */
	karma: number
	/** Ha lavorato per corporazioni/Intrapol */
	admin: boolean
	hardware: { cpu: HardwarePart; net: HardwarePart; flashram: HardwarePart }
	/** File in flashram (programmi, dati, allegati) */
	files: GameFile[]
	mails: Mail[]
	nextMailId: number
	/** IP dei server visibili nella Network Map */
	known: string[]
	/** Stato di tutti i server del Network, per IP */
	servers: Record<string, ServerState>
	missions: ActiveMission[]
	completed: string[]
	events: ScheduledEvent[]
	/** Virus attivi sul sistema del giocatore */
	viruses: string[]
	console: string[]
	/** Testo di MomPad */
	notepad: string
	settings: GameSettings
	tutorialDone: boolean
	/** Server di chat a cui il giocatore si è collegato almeno una volta */
	visitedChats: string[]
	/** Nodi del cluster (IP dei Personal Server con la backdoor) */
	cluster: string[]
	debug: boolean
	/** File "sul disco" per le funzioni file_text_* degli script (cartella users/<nome>) */
	vfs: Record<string, string>
}

export function createState(user: string, password: string, now: number): GameState {
	return {
		version: SAVE_VERSION,
		user,
		password,
		clock: now,
		ranking: START_RANKING,
		credits: START_CREDITS,
		karma: 0,
		admin: false,
		hardware: structuredClone(START_HARDWARE),
		files: [],
		mails: [],
		nextMailId: 1,
		known: [],
		servers: {},
		missions: [],
		completed: [],
		events: [],
		viruses: [],
		console: [],
		notepad: "",
		settings: { openNewMail: false, mailPreview: false, music: true, wallpaper: 1, autosave: true },
		tutorialDone: false,
		visitedChats: [],
		cluster: [],
		debug: false,
		vfs: {},
	}
}
