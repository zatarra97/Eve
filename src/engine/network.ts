// Network: server conosciuti, Network Map, nodi, connessione, login e operazioni sui terminali.
//
// NOTA: Eve è un videogioco, il remake di "Mother" (2005), un simulatore di hacking a tema
// narrativo. Server, IP, account, password, "tool" e operazioni come forzare un login o sfuggire
// a un backtrace sono finzione di gioco: dati letti dai file .svr/.miss del gioco originale e
// simulati in memoria nel browser. Questo codice non apre connessioni di rete, non legge né
// modifica nulla fuori dallo stato della partita e non ha alcuna utilità al di fuori del gioco.

import {
	BACKMIRROR_TRACE_SPEED,
	CRIME_NOTIFICATION_S,
	SERVER_REFRESH_S,
	connectionBandwidth,
	crackSeconds,
	crackerSpeed,
	crimePenalty,
	traceSeconds,
	transferSeconds,
	violationRanking,
} from "./balance"
import { normPath } from "./content"
import type { Game } from "./game"
import { loadServer } from "./loaders"
import type { GameFile, ServerState, ServerUser } from "./types"

/** Backtrace del server durante un accesso forzato (secondi di gioco) */
export interface Trace {
	elapsed: number
	total: number
}

/** Attacco in corso all'interfaccia di sicurezza del server connesso */
export interface Breach {
	ip: string
	program: "rootbreaker" | "wavehacker"
	taskId: number
}

export interface Connection {
	/** IP dei nodi in ordine; l'ultimo è il server di destinazione */
	nodes: string[]
	target: string
	status: "dialing" | "connected"
	/** Avanzamento della composizione dell'indirizzo (0..1) */
	dial: number
	/** Utente con cui si è autenticati sul server */
	logged?: string
	/** Accesso ottenuto senza credenziali valide */
	forced: boolean
	/** Backtrace avviato dal server quando si è attaccata l'interfaccia di sicurezza */
	trace?: Trace
}

const DIAL_SECONDS = 2.5
/** Contenuto dei campioni vocali registrati da wavehacker (FileImg = campione, es. "snd_phone_admin:3") */
export const VOICE_SAMPLE = "%WAV%"
/** Modello dei server sotto sequestro Intrapol */
const SEIZED_MODEL = "hackedsys.fak"
/** Terminali su cui fileforce può caricare file: quelli dei RefServerIP delle missioni FileUploading */
const UPLOAD_TERMINALS: ServerState["terminal"][] = ["FileServer", "DatabaseServer"]

export class Network {
	private game: Game
	connection: Connection | null = null
	breach: Breach | null = null
	/** Nodi impostati sulla Network Map prima di connettersi */
	pendingNodes: string[] = []
	/** backmirror aperto: rallenta il backtrace in corso */
	backmirror = false
	readonly localIP = "127.0.0.1"

	/** Apertura/chiusura della finestra di backmirror */
	setBackmirror(open: boolean) {
		this.backmirror = open
	}

	constructor(game: Game) {
		this.game = game
	}

	private get servers() {
		return this.game.state.servers
	}

	// --- caricamento ---

	/** Carica tutti i server del pacchetto contenuti nello stato (nuova partita) */
	loadServers() {
		for (const [path, source] of this.game.content.servers) {
			if (!path.endsWith(".svr")) continue
			try {
				const def = loadServer(source, path)
				if (def.ip) this.servers[def.ip] = structuredClone(def)
			} catch (e) {
				this.game.log(`Errore nel server ${path}: ${(e as Error).message}`)
			}
		}
	}

	/** Aggiunge i server non ancora presenti (comando refreshservers, mod caricate dopo) */
	refreshServers(): number {
		let added = 0
		for (const [path, source] of this.game.content.servers) {
			if (!path.endsWith(".svr")) continue
			try {
				const def = loadServer(source, path)
				if (def.ip && !this.servers[def.ip]) {
					this.servers[def.ip] = structuredClone(def)
					added++
				}
			} catch {
				// i server con errori vengono già segnalati al primo caricamento
			}
		}
		this.game.changed()
		return added
	}

	/** Ripristina un server dalla sua definizione, conservando i file caricati dal giocatore */
	restoreServer(ip: string) {
		const srv = this.servers[ip]
		if (!srv) return
		const source = this.game.content.servers.get(normPath(srv.source))
		if (!source) return
		const def = loadServer(source, srv.source)
		const uploaded = srv.files.filter((f) => !def.files.some((d) => d.name === f.name))
		this.servers[ip] = { ...structuredClone(def), files: [...def.files, ...uploaded], everHacked: srv.everHacked, chatLog: srv.chatLog }
		this.game.changed()
	}

	// --- ricerca ---

	server(ipOrName: string): ServerState | undefined {
		if (!ipOrName) return undefined
		const direct = this.servers[ipOrName]
		if (direct) return direct
		const lower = ipOrName.toLowerCase()
		return Object.values(this.servers).find((s) => s.name.toLowerCase() === lower || s.ip.toLowerCase() === lower)
	}

	/** Server raggiungibile adesso? */
	isOnline(srv: ServerState) {
		return !srv.removed && !srv.destroyed && !(srv.nukedUntil && srv.nukedUntil > this.game.now)
	}

	knownServers(): ServerState[] {
		return this.game.state.known.map((ip) => this.servers[ip]).filter((s): s is ServerState => !!s && !s.removed)
	}

	// --- Network Map ---

	addKnown(ip: string) {
		const srv = this.server(ip)
		if (!srv || this.game.state.known.includes(srv.ip)) return
		this.game.state.known.push(srv.ip)
		this.game.changed()
	}

	/** resolve <servername>: aggiunge il server alla mappa, salvo Server Hiding */
	resolve(name: string): ServerState | null {
		const srv = this.server(name)
		if (!srv || srv.removed || srv.destroyed || !srv.type) return null
		this.addKnown(srv.ip)
		return srv
	}

	/** Toglie un server dalla mappa (comando removeserver) */
	forget(ipOrName: string): boolean {
		const srv = this.server(ipOrName)
		if (!srv) return false
		const before = this.game.state.known.length
		this.game.state.known = this.game.state.known.filter((ip) => ip !== srv.ip)
		this.game.changed()
		return this.game.state.known.length < before
	}

	/** Rimuove definitivamente un server dal Network (OfflineRemoveServer) */
	removeServer(ip: string) {
		const srv = this.server(ip)
		if (!srv) return
		srv.removed = true
		if (this.connection?.target === srv.ip) this.disconnect("Il server remoto ha chiuso la connessione.")
		this.game.state.known = this.game.state.known.filter((k) => k !== srv.ip)
		this.game.changed()
	}

	// --- nodi e connessione ---

	addNode(ip: string) {
		const srv = this.server(ip)
		if (!srv || this.pendingNodes.includes(srv.ip)) return
		this.pendingNodes.push(srv.ip)
		this.game.emit({ type: "sound", name: "setnode" })
	}

	removeLastNode() {
		this.pendingNodes.pop()
		this.game.changed()
	}

	/** Connetti: usa i nodi impostati sulla mappa */
	connect(): string | null {
		if (this.pendingNodes.length === 0) return "Nessun nodo di connessione impostato."
		return this.open([...this.pendingNodes])
	}

	/** connect <ip> da console: connessione diretta, anche verso server nascosti */
	connectDirect(ip: string): string | null {
		const srv = this.server(ip)
		if (!srv) return "Impossibile raggiungere l'host remoto."
		return this.open([...this.pendingNodes.filter((n) => n !== srv.ip), srv.ip])
	}

	private open(nodes: string[]): string | null {
		if (this.connection) this.disconnect()
		const target = nodes[nodes.length - 1]
		const srv = this.servers[target]
		if (!srv || !this.isOnline(srv)) return "Impossibile raggiungere l'host remoto."
		if (connectionBandwidth(nodes.length) > this.game.netTotal - this.game.netUsed)
			return "Banda insufficiente per impostare la connessione."
		// Firewall: il penultimo nodo deve corrispondere all'indirizzo accettato
		if (srv.firewall && srv.firewallMask !== "*.*.*.*") {
			const previous = nodes.length > 1 ? nodes[nodes.length - 2] : this.localIP
			if (previous !== srv.firewallMask) {
				this.game.log("Connessione rifiutata dal Firewall remoto.")
				return "Connessione rifiutata dal Firewall remoto."
			}
		}
		this.connection = { nodes, target, status: "dialing", dial: 0, forced: false }
		this.pendingNodes = []
		this.game.emit({ type: "sound", name: "access" })
		this.game.changed()
		return null
	}

	disconnect(reason?: string) {
		if (!this.connection) return
		this.abortBreach()
		this.leaveTraces()
		this.connection = null
		this.pendingNodes = []
		this.game.log("Disconnesso dal Network.")
		this.game.emit({ type: "sound", name: "disconnect" })
		this.game.emit({ type: "disconnected", reason })
	}

	/** Logout dal server: si torna all'interfaccia di autenticazione */
	logout() {
		if (!this.connection) return
		this.abortBreach()
		this.leaveTraces()
		this.connection.logged = undefined
		this.connection.forced = false
		this.game.changed()
	}

	/** Server di destinazione della connessione attiva */
	get host(): ServerState | undefined {
		return this.connection?.status === "connected" ? this.servers[this.connection.target] : undefined
	}

	/** Serve l'autenticazione prima di vedere il terminale? */
	needsAuth(): boolean {
		const c = this.connection
		const srv = this.host
		return !!c && !!srv && !!srv.protection && c.logged === undefined
	}

	/** Login con credenziali (interfaccia Login) */
	login(username: string, password: string): boolean {
		const c = this.connection
		const srv = this.host
		if (!c || !srv) return false
		const user = srv.users.find((u) => u.username.toLowerCase() === username.toLowerCase() && u.password === password)
		if (!user) {
			this.game.emit({ type: "sound", name: "login_error" })
			return false
		}
		c.logged = user.username
		c.forced = false
		this.game.emit({ type: "sound", name: "access" })
		return true
	}

	/** Interfaccia a chiave cifrata: il file chiave deve essere in flashram */
	loginWithKeyFile(): boolean {
		const c = this.connection
		const srv = this.host
		if (!c || !srv) return false
		const user = srv.users.find((u) => this.game.findLocalFile(u.password) >= 0)
		if (!user) return false
		c.logged = user.username
		this.game.emit({ type: "sound", name: "access" })
		return true
	}

	// --- accesso forzato (rootbreaker, wavehacker) ---

	/** Account con il ranking più alto: è quello che i programmi forzano */
	adminOf(srv: ServerState): ServerUser | undefined {
		return srv.users.reduce<ServerUser | undefined>((best, u) => (!best || u.ranking > best.ranking ? u : best), undefined)
	}

	/** Programma in flashram con questo identificativo: quello indicato per nome, altrimenti la versione migliore */
	private program(id: string, name?: string): GameFile | undefined {
		const files = this.game.state.files.filter((f) => f.contents.toLowerCase() === id)
		return files.find((f) => f.name === name) ?? files.sort((a, b) => crackerSpeed(versionOf(b)) - crackerSpeed(versionOf(a)))[0]
	}

	/** Controlli comuni prima di attaccare l'interfaccia di sicurezza del server connesso */
	private breachTarget(protection: ServerState["protection"]): { srv: ServerState; admin: ServerUser } | string {
		const srv = this.host
		if (!srv || !this.needsAuth() || srv.protection !== protection) return "Nessuna interfaccia compatibile rilevata sul server remoto."
		if (this.breach) return "Operazione già in corso."
		const admin = this.adminOf(srv)
		if (!admin) return "Nessun account presente sul server remoto."
		return { srv, admin }
	}

	/** rootbreaker: cracking dell'interfaccia Login. Il server avvia subito il backtrace. */
	startCrack(programName?: string): string | null {
		const prog = this.program("rootbreaker", programName)
		if (!prog) return "rootbreaker non presente in Flashram."
		const t = this.breachTarget("Login")
		if (typeof t === "string") return t
		const seconds = crackSeconds(t.admin.ranking, t.srv.cpu, this.game.state.hardware.cpu.value, crackerSpeed(versionOf(prog)))
		this.startBreach("rootbreaker", t.srv, t.admin, `Cracking ${t.srv.name}`, seconds)
		return null
	}

	/** wavehacker sul VRLS: invia il campione vocale dell'admin registrato in flashram */
	startVoiceForge(): string | null {
		if (!this.program("wavehacker")) return "wavehacker non presente in Flashram."
		const t = this.breachTarget("VRLS")
		if (typeof t === "string") return t
		const sample = this.voiceSamples().find((f) => String(f.img) === t.admin.password)
		if (!sample) return "Nessun campione vocale compatibile in Flashram."
		// Non c'è niente da decifrare: il tempo è quello dell'invio del campione al server
		const free = Math.max(1, this.game.netFree)
		this.startBreach("wavehacker", t.srv, t.admin, `Sintesi vocale ${t.srv.name}`, transferSeconds(sample.dim, free), Math.min(free, this.game.netFree))
		return null
	}

	private startBreach(program: Breach["program"], srv: ServerState, admin: ServerUser, label: string, seconds: number, net = 0) {
		const g = this.game
		const task = g.startTask({
			kind: "crack",
			label,
			total: seconds,
			net,
			cpu: Math.round(g.state.hardware.cpu.value * 0.5),
			onDone: () => {
				this.breach = null
				if (this.host === srv) this.forceAccess(srv, admin)
			},
		})
		this.breach = { ip: srv.ip, program, taskId: task.id }
		this.startTrace(srv, admin)
		g.log(`${program}: attacco all'interfaccia di ${srv.name} avviato.`)
	}

	/** Interrompe l'attacco in corso (il backtrace già avviato continua) */
	abortBreach() {
		const b = this.breach
		if (!b) return
		this.breach = null
		this.game.cancelTask(b.taskId)
	}

	/** Accesso ottenuto come admin: ranking alla prima violazione e tracce nei log del server */
	private forceAccess(srv: ServerState, admin: ServerUser) {
		const c = this.connection!
		const g = this.game
		c.logged = admin.username
		c.forced = true
		if (!srv.everHacked) {
			srv.everHacked = true
			g.state.ranking += violationRanking(admin.ranking)
		}
		srv.traces = { at: g.now, ranking: admin.ranking }
		g.log(`Accesso forzato a ${srv.name} come ${admin.username}.`)
		g.emit({ type: "sound", name: "access" })
		g.missions.check()
	}

	/** Campioni vocali registrati in flashram */
	voiceSamples(): GameFile[] {
		return this.game.state.files.filter((f) => f.contents === VOICE_SAMPLE)
	}

	/** Campione della voce sulla linea telefonica connessa (file rec.audio dei server Phone) */
	phoneSample(): GameFile | undefined {
		const srv = this.host
		return srv?.terminal === "Phone" ? srv.files.find((f) => String(f.img).startsWith("snd_phone_admin")) : undefined
	}

	/** wavehacker su una linea telefonica: registra la voce in un campione in flashram */
	recordVoice(): string | null {
		const g = this.game
		if (!this.program("wavehacker")) return "wavehacker non presente in Flashram."
		const srv = this.host
		const sample = this.phoneSample()
		if (!srv || !sample) return "Nessuna linea telefonica attiva."
		if (this.breach || g.tasks.some((t) => t.kind === "call")) return "Operazione già in corso."
		if (sample.dim > g.flashramFree) return "Spazio insufficiente sulla Flashram."
		const free = Math.max(1, g.netFree)
		// "snd_phone_admin:3" → sounds/phone_admin_3.wav
		g.emit({ type: "sound", name: String(sample.img).replace(/^snd_/, "").replace(":", "_") })
		g.startTask({
			kind: "call",
			label: `Registrazione ${srv.name}`,
			total: transferSeconds(sample.dim, free),
			net: Math.min(free, g.netFree),
			cpu: 0,
			onDone: () => {
				const name = `voce-${srv.name}.wav`
				g.addLocalFile({ name, dim: sample.dim, img: sample.img, contents: VOICE_SAMPLE, owner: g.state.user })
				g.log(`wavehacker: campione vocale salvato in '${name}'.`)
			},
		})
		return null
	}

	// --- backtrace e reati ---

	/** Il server attaccato inizia a rintracciare la connessione (una volta per sessione) */
	private startTrace(srv: ServerState, admin: ServerUser) {
		const c = this.connection
		if (!c || c.trace) return
		// I Proxy Server tra i nodi contano doppio
		const hops = c.nodes.reduce((n, ip) => n + (this.servers[ip]?.type === "Proxy Server" ? 2 : 1), 0)
		c.trace = { elapsed: 0, total: traceSeconds(srv.net, admin.ranking, hops, this.game.state.cluster.length) }
	}

	/**
	 * Fine della sessione (disconnessione o logout): se nei log del server restano le tracce
	 * dell'accesso forzato, Intrapol notificherà il reato CRIME_NOTIFICATION_S più tardi.
	 * Finché si resta connessi conta solo il backtrace in tempo reale.
	 */
	private leaveTraces() {
		const srv = this.servers[this.connection?.target ?? ""]
		if (!srv?.traces || srv.removed) return
		this.game.schedule(CRIME_NOTIFICATION_S, "crime", { ip: srv.ip, at: srv.traces.at })
	}

	/**
	 * Partita caricata: la sessione precedente (es. pagina ricaricata) vale come una disconnessione.
	 * Programma la notifica del reato per ogni server con tracce ancora nei log e nessuna notifica in coda.
	 */
	leaveTracesOnLoad() {
		const queued = this.game.state.events.filter((e) => e.kind === "crime")
		for (const srv of Object.values(this.servers)) {
			if (!srv.traces || srv.removed) continue
			const at = srv.traces.at
			if (queued.some((e) => e.payload.ip === srv.ip && e.payload.at === at)) continue
			this.game.schedule(CRIME_NOTIFICATION_S, "crime", { ip: srv.ip, at })
		}
	}

	/**
	 * Intrapol notifica un reato: in diretta quando il backtrace si completa, altrimenti
	 * CRIME_NOTIFICATION_S dopo la fine della sessione se le tracce sono ancora nei log del server.
	 * tracesAt identifica le tracce per cui la notifica differita è stata programmata.
	 */
	notifyCrime(ip: string, caughtLive: boolean, tracesAt?: number) {
		const g = this.game
		const srv = this.server(ip)
		if (!srv) return
		const traces = srv.traces
		// Tracce cancellate, già notificate o sostituite da un accesso forzato più recente: niente reato
		if (!caughtLive && (!traces || traces.at !== tracesAt)) return
		const penalty = crimePenalty(traces?.ranking ?? this.adminOf(srv)?.ranking ?? 0, caughtLive)
		g.state.ranking = Math.max(0, g.state.ranking - penalty.ranking)
		g.state.credits = Math.max(0, g.state.credits - penalty.credits)
		srv.traces = undefined
		// Il sequestro scatta solo se il sistema è stato effettivamente violato, e mai sui server
		// CantBeHacked: per il Modding HOW-TO §2.7 non vengono bloccati temporaneamente dopo un hacking
		const seized = !!traces && !srv.cantBeHacked
		if (seized) this.seize(srv)
		if (this.connection?.target === srv.ip) this.disconnect()
		const loss = `Ranking -${penalty.ranking}${penalty.credits ? `, Crediti -${penalty.credits}` : ""}.`
		const text = caughtLive
			? `Backtrace completato: Intrapol ha rintracciato il tuo indirizzo durante l'accesso a ${srv.name}. ${loss}`
			: `Intrapol ti ha notificato un reato: violazione del sistema ${srv.name}. ${loss}`
		g.log(text)
		g.emit({ type: "sound", name: "alert" })
		g.emit({ type: "traced", ip: srv.ip })
		g.message(seized ? `${text}\nIl server è stato posto sotto sequestro.` : text, "Intrapol")
	}

	/** Sequestro Intrapol: il server mostra il modello hackedsys.fak finché restoreServer non lo ripristina */
	private seize(srv: ServerState) {
		const source = this.game.content.servers.get(SEIZED_MODEL)
		const model = source ? loadServer(source, SEIZED_MODEL) : undefined
		// Nome, IP, posizione e file restano quelli del server (restoreServer conserva i file caricati)
		Object.assign(srv, {
			welcome: model?.welcome ?? "Server sotto sequestro.",
			background: model?.background ?? -1,
			terminal: null,
			protection: null,
			firewall: false,
			firewallMask: "*.*.*.*",
			users: [],
			cantBeHacked: true,
			cantBeNuked: true,
			cantBeDestroyed: true,
			seizedUntil: this.game.now + SERVER_REFRESH_S * 1000,
		} satisfies Partial<ServerState>)
		this.game.changed()
	}

	// --- file remoti ---

	/** File del server visibili all'utente autenticato (pubblici se il server non è protetto) */
	visibleFilesOf(srv: ServerState): GameFile[] {
		const user = this.connection?.target === srv.ip ? this.connection.logged : undefined
		if (srv.seizedUntil) return []
		if (!srv.protection) return srv.files
		return srv.files.filter((f) => String(f.owner).toLowerCase() === (user ?? "").toLowerCase())
	}

	visibleFiles(): GameFile[] {
		const srv = this.host
		return srv ? this.visibleFilesOf(srv) : []
	}

	putFile(srv: ServerState, file: GameFile) {
		const i = srv.files.findIndex((f) => f.name === file.name && f.owner === file.owner)
		if (i >= 0) srv.files[i] = { ...file }
		else srv.files.push({ ...file })
		this.game.missions.check()
		this.game.changed()
	}

	deleteRemoteFile(file: GameFile, force = false): boolean {
		const srv = this.host
		if (!srv) return false
		if (file.contents === "%SYSTEM%" && !force) return false
		srv.files = srv.files.filter((f) => f !== file)
		// Cancellare i log delle connessioni elimina le tracce dell'accesso forzato
		if (srv.traces && file.name.toLowerCase().startsWith("log.")) srv.traces = undefined
		this.game.missions.check()
		this.game.changed()
		return true
	}

	/** Scarica un file del server in flashram, con il tempo dato dalla banda libera */
	download(file: GameFile, cost = 0): string | null {
		const g = this.game
		if (file.dim > g.flashramFree) return "Spazio insufficiente sulla Flashram."
		if (cost > g.state.credits) return "Crediti insufficienti."
		const free = Math.max(1, g.netFree)
		g.startTask({
			kind: "download",
			label: `Download ${file.name}`,
			total: Math.max(0.5, (file.dim * 8) / free),
			net: Math.min(free, g.netFree),
			cpu: 0,
			onDone: () => {
				if (cost) g.state.credits -= cost
				g.addLocalFile({ ...file, owner: g.state.user })
				g.log(`File '${file.name}' scaricato.`)
				g.missions.check()
			},
		})
		return null
	}

	/** Server connesso su cui fileforce può caricare file adesso (File Server o Database Server, autenticati) */
	uploadTarget(): ServerState | undefined {
		const srv = this.host
		return srv && UPLOAD_TERMINALS.includes(srv.terminal) && !srv.seizedUntil && !this.needsAuth() ? srv : undefined
	}

	/** fileforce: carica un file della flashram sul server connesso, con proprietario l'utente autenticato */
	upload(file: GameFile): string | null {
		const g = this.game
		if (!g.hasProgram("fileforce")) return "fileforce non presente in Flashram."
		const srv = this.uploadTarget()
		const user = this.connection?.logged
		if (!srv) return "Nessun File Server o Database Server disponibile per il caricamento."
		const free = Math.max(1, g.netFree)
		g.startTask({
			kind: "upload",
			label: `Upload ${file.name}`,
			total: transferSeconds(file.dim, free),
			net: Math.min(free, g.netFree),
			cpu: 0,
			onDone: () => {
				// Il trasferimento si perde se nel frattempo la sessione sul server è cambiata
				if (this.host !== srv || this.connection?.logged !== user) {
					g.log(`Upload di '${file.name}' interrotto: connessione con ${srv.name} persa.`)
					return
				}
				this.putFile(srv, { ...file, owner: user ?? "" })
				g.log(`File '${file.name}' caricato su ${srv.name}.`)
			},
		})
		return null
	}

	// --- chat e news ---

	addChatLine(ip: string, line: string) {
		const srv = this.server(ip)
		if (!srv) return
		;(srv.chatLog ??= []).push(line)
		this.game.changed()
	}

	addNews(serverName: string, title: string, body: string) {
		const srv = this.server(serverName)
		if (!srv) return
		srv.files.unshift({ name: title, dim: 1, img: -1, contents: body.replace(/\r\n?/g, "\n"), owner: "" })
		this.game.changed()
	}

	// --- cluster ---

	/** Banda messa a disposizione dai server del cluster */
	clusterBandwidth(): number {
		return this.game.state.cluster.reduce((sum, ip) => sum + (this.servers[ip]?.net ?? 0), 0)
	}

	// --- tempo ---

	tick(dt: number) {
		const c = this.connection
		if (c && c.status === "dialing") {
			c.dial += dt / 1000 / DIAL_SECONDS
			if (c.dial >= 1) {
				c.status = "connected"
				const srv = this.servers[c.target]
				if (srv?.terminal === "ChatServer" && !this.game.state.visitedChats.includes(srv.ip)) this.game.state.visitedChats.push(srv.ip)
				this.game.log("Connesso al server remoto!")
				this.game.emit({ type: "connected", ip: c.target })
				this.game.missions.check()
			}
		}
		// Backtrace: se si completa con la connessione ancora aperta si viene presi in diretta
		if (c?.trace && c.status === "connected") {
			c.trace.elapsed += (dt / 1000) * (this.backmirror ? BACKMIRROR_TRACE_SPEED : 1)
			if (c.trace.elapsed >= c.trace.total) this.notifyCrime(c.target, true)
		}
		// Server sotto sequestro che tornano online
		for (const srv of Object.values(this.servers)) {
			if (srv.seizedUntil && srv.seizedUntil <= this.game.now) {
				srv.seizedUntil = undefined
				this.game.schedule(0, "refreshServer", { ip: srv.ip })
			}
		}
	}
}

/** Versione di un programma dal nome del file ("rootbreaker-2.2" → "2.2") */
function versionOf(file: GameFile): string {
	return file.name.split("-").pop() ?? ""
}

export { SERVER_REFRESH_S }
