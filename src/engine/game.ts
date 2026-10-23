// Motore di gioco: tiene lo stato della partita, fa avanzare il tempo e coordina i sottosistemi.
// Non dipende da React: la UI si iscrive con subscribe() e legge lo stato dopo ogni notifica.

import { MAIL_DELAY_S, SYSTEM_FLASHRAM_MB, connectionBandwidth, userClass } from "./balance"
import type { ContentPack } from "./content"
import { Network } from "./network"
import { Missions } from "./missions"
import { Runtime } from "./runtime-api"
import { Scripts } from "./scripts"
import { Shell } from "./console"
import { Chat } from "./chat"
import { Viruses } from "./viruses"
import { createState, type GameState } from "./state"
import type { GameFile, Mail, MailMessage, ScheduledEvent } from "./types"

export type GameEvent =
	| { type: "mail"; mail: Mail }
	| { type: "message"; text: string; title?: string }
	| { type: "sound"; name: string }
	| { type: "connected"; ip: string }
	| { type: "disconnected"; reason?: string }
	| { type: "traced"; ip: string }
	| { type: "console"; line: string }
	| { type: "ui"; action: "msgbox" | "console" | "sysmon" | "netmap"; arg?: string | number }
	/** Apertura di un programma in flashram: id = FileContents (uavsys, momamp…), name = nome del file */
	| { type: "program"; id: string; name: string }

/** Operazione che richiede tempo (download, cracking…), mostrata nel Sysmon */
export interface Task {
	id: number
	kind: "download" | "upload" | "crack" | "nuke" | "call" | "copy"
	label: string
	elapsed: number
	total: number
	/** Banda (MBps) e CPU (MHz) occupate mentre è attiva */
	net: number
	cpu: number
	done?: boolean
	onDone: () => void
	onCancel?: () => void
}

export interface GameOptions {
	/** Generatore casuale (per i test) */
	random?: () => number
}

export class Game {
	readonly content: ContentPack
	state: GameState
	readonly random: () => number
	readonly network: Network
	readonly missions: Missions
	readonly runtime: Runtime
	readonly scripts: Scripts
	readonly viruses: Viruses
	readonly shell: Shell
	readonly chat: Chat
	tasks: Task[] = []
	private nextTaskId = 1
	private listeners = new Set<() => void>()
	private eventListeners = new Set<(e: GameEvent) => void>()
	private version = 0
	private pendingNotify = false

	constructor(content: ContentPack, state: GameState, opts: GameOptions = {}) {
		this.content = content
		this.state = state
		this.random = opts.random ?? Math.random
		this.runtime = new Runtime(this)
		this.network = new Network(this)
		this.missions = new Missions(this)
		this.scripts = new Scripts(this)
		this.viruses = new Viruses(this)
		this.shell = new Shell(this)
		this.chat = new Chat(this)
	}

	/** Nuova partita: carica il Network e le missioni iniziali di def.miss */
	static newGame(content: ContentPack, user: string, password: string, now = Date.now(), opts: GameOptions = {}): Game {
		const game = new Game(content, createState(user, password, now), opts)
		game.network.loadServers()
		game.log(`*** Apertura nuova sessione per ${game.address}. [ ${game.formatDate()} ]`)
		game.missions.runDefinitions()
		game.scripts.runAutoexec()
		game.flush()
		return game
	}

	/** Partita salvata: ripristina lo stato e aggiunge eventuali server nuovi (mod) */
	static load(content: ContentPack, state: GameState, opts: GameOptions = {}): Game {
		const game = new Game(content, state, opts)
		game.network.refreshServers()
		game.network.leaveTracesOnLoad()
		game.log(`*** Apertura nuova sessione per ${game.address}. [ ${game.formatDate()} ]`)
		game.scripts.runAutoexec()
		game.flush()
		return game
	}

	// --- notifiche alla UI ---

	subscribe = (fn: () => void) => {
		this.listeners.add(fn)
		return () => {
			this.listeners.delete(fn)
		}
	}
	getVersion = () => this.version

	onEvent(fn: (e: GameEvent) => void) {
		this.eventListeners.add(fn)
		return () => {
			this.eventListeners.delete(fn)
		}
	}

	emit(e: GameEvent) {
		for (const fn of this.eventListeners) fn(e)
		this.changed()
	}

	/** Segna lo stato come modificato; la notifica parte a fine operazione (flush) o al prossimo tick */
	changed() {
		this.pendingNotify = true
	}

	flush() {
		if (!this.pendingNotify) return
		this.pendingNotify = false
		this.version++
		for (const fn of this.listeners) fn()
	}

	/** Esegue un'azione del giocatore e notifica la UI */
	act<T>(fn: () => T): T {
		try {
			return fn()
		} finally {
			this.changed()
			this.flush()
		}
	}

	// --- tempo ---

	get now() {
		return this.state.clock
	}

	/** Avanza il tempo di gioco di dt millisecondi */
	tick(dt: number) {
		const step = Math.min(dt, 1000)
		this.state.clock += step
		this.runEvents()
		this.updateTasks(step)
		this.network.tick(step)
		this.missions.tick()
		this.scripts.tick(step)
		this.viruses.tick(step)
		this.changed()
		this.flush()
	}

	/** Fa avanzare il tempo a passi (per i test) */
	advance(ms: number, step = 250) {
		for (let t = 0; t < ms; t += step) this.tick(Math.min(step, ms - t))
	}

	schedule(delaySeconds: number, kind: ScheduledEvent["kind"], payload: Record<string, unknown>) {
		this.state.events.push({ at: this.now + delaySeconds * 1000, kind, payload })
		this.state.events.sort((a, b) => a.at - b.at)
	}

	private runEvents() {
		while (this.state.events.length && this.state.events[0].at <= this.now) {
			const e = this.state.events.shift()!
			switch (e.kind) {
				case "mail": {
					const p = e.payload as { mail: MailMessage; attachment?: GameFile }
					this.receiveMail(p.mail, p.attachment)
					break
				}
				case "missionEnd":
					this.missions.afterEnd(e.payload.path as string)
					break
				case "crime":
					this.network.notifyCrime(e.payload.ip as string, false, e.payload.at as number | undefined)
					break
				case "refreshServer":
					this.network.restoreServer(e.payload.ip as string)
					break
				case "message":
					this.emit({ type: "message", text: e.payload.text as string, title: e.payload.title as string | undefined })
					break
			}
		}
	}

	randomDelay([min, max]: [number, number] = MAIL_DELAY_S) {
		return min + this.random() * (max - min)
	}

	// --- operazioni a tempo ---

	startTask(t: Omit<Task, "id" | "elapsed">): Task {
		const task: Task = { ...t, id: this.nextTaskId++, elapsed: 0 }
		this.tasks.push(task)
		this.changed()
		return task
	}

	cancelTask(id: number) {
		const t = this.tasks.find((x) => x.id === id)
		if (!t) return
		this.tasks = this.tasks.filter((x) => x !== t)
		t.onCancel?.()
		this.changed()
	}

	private updateTasks(dt: number) {
		for (const t of [...this.tasks]) {
			t.elapsed += dt / 1000
			if (t.elapsed >= t.total && !t.done) {
				t.done = true
				this.tasks = this.tasks.filter((x) => x !== t)
				t.onDone()
			}
		}
	}

	// --- risorse del sistema locale ---

	get address() {
		return `${this.state.user}@mother`
	}

	get userClass() {
		return userClass(this.state.ranking, this.state.karma, this.state.admin)
	}

	/** MB occupati in flashram (sistema operativo + file) */
	get flashramUsed() {
		return SYSTEM_FLASHRAM_MB + this.state.files.reduce((s, f) => s + f.dim, 0)
	}

	get flashramFree() {
		return this.state.hardware.flashram.value - this.flashramUsed
	}

	/** Banda occupata: connessione, operazioni in corso, virus */
	get netUsed() {
		const conn = this.network.connection ? connectionBandwidth(this.network.connection.nodes.length) : 0
		const tasks = this.tasks.reduce((s, t) => s + t.net, 0)
		return Math.min(this.netTotal, conn + tasks + this.viruses.netLoad())
	}

	/** Banda totale: scheda di rete più quella messa a disposizione dal cluster */
	get netTotal() {
		return this.state.hardware.net.value + this.network.clusterBandwidth()
	}

	get netFree() {
		return Math.max(0, this.netTotal - this.netUsed)
	}

	get cpuUsed() {
		return Math.min(this.state.hardware.cpu.value, this.tasks.reduce((s, t) => s + t.cpu, 0) + this.viruses.cpuLoad())
	}

	findLocalFile(name: string): number {
		return this.state.files.findIndex((f) => f.name.toLowerCase() === name.toLowerCase())
	}

	hasProgram(id: string): GameFile | undefined {
		return this.state.files.find((f) => typeof f.contents === "string" && f.contents.toLowerCase() === id.toLowerCase())
	}

	/** Aggiunge un file in flashram; false se non c'è spazio */
	addLocalFile(file: GameFile): boolean {
		if (file.dim > this.flashramFree) return false
		const existing = this.findLocalFile(file.name)
		if (existing >= 0) this.state.files[existing] = { ...file }
		else this.state.files.push({ ...file })
		this.changed()
		return true
	}

	/** Elimina un file dalla flashram; i file %SYSTEM% solo se forzato (script delle missioni) */
	deleteLocalFile(index: number, force = false): boolean {
		const f = this.state.files[index]
		if (!f || (f.contents === "%SYSTEM%" && !force)) return false
		this.state.files.splice(index, 1)
		this.changed()
		return true
	}

	// --- posta ---

	/** Consegna una mail; l'eventuale allegato finisce subito in flashram */
	receiveMail(msg: MailMessage, attachment?: GameFile): Mail {
		const mail: Mail = {
			...msg,
			id: this.state.nextMailId++,
			read: false,
			date: this.now,
			attachment,
		}
		if (attachment) this.addLocalFile(attachment)
		this.state.mails.push(mail)
		this.emit({ type: "sound", name: "incoming" })
		this.emit({ type: "mail", mail })
		return mail
	}

	/** Programma una mail con il ritardo di consegna */
	sendMailLater(msg: MailMessage, delaySeconds = this.randomDelay(), attachment?: GameFile) {
		this.schedule(delaySeconds, "mail", { mail: msg, attachment })
	}

	markRead(id: number) {
		const m = this.state.mails.find((x) => x.id === id)
		if (m && !m.read) {
			m.read = true
			this.changed()
		}
	}

	deleteMail(id: number) {
		this.state.mails = this.state.mails.filter((m) => m.id !== id)
		this.changed()
	}

	/** Testo che il client compila da solo rispondendo a una mail (ReplyMailText della missione) */
	replyText(mailId: number): string {
		const mail = this.state.mails.find((m) => m.id === mailId)
		return mail ? this.missions.replyTextFor(mail) : ""
	}

	/** Risponde a una mail, con un allegato opzionale preso dalla flashram */
	reply(mailId: number, attachmentName?: string): void {
		const mail = this.state.mails.find((m) => m.id === mailId)
		if (!mail) return
		const attachment = attachmentName ? this.state.files[this.findLocalFile(attachmentName)] : undefined
		this.missions.onReply(mail, attachment)
	}

	// --- console ---

	log(line: string) {
		this.state.console.push(line)
		if (this.state.console.length > 500) this.state.console.splice(0, this.state.console.length - 500)
		this.emit({ type: "console", line })
	}

	debug(line: string) {
		if (this.state.debug) this.log(`[debug] ${line}`)
	}

	message(text: string, title?: string) {
		this.emit({ type: "message", text, title })
	}

	/**
	 * Data nel formato del Sysmon ("Giovedì, 22/10/2026 00:27:13"). L'originale fissava l'anno a 2012;
	 * qui si usa la data reale dell'orologio di gioco.
	 */
	formatDate(ms = this.now) {
		const d = new Date(ms)
		const days = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"]
		const p = (n: number) => String(n).padStart(2, "0")
		return `${days[d.getDay()]}, ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
	}
}
