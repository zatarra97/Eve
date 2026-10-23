// Network: server conosciuti, Network Map, nodi, connessione, login e operazioni sui terminali.
//
// NOTA: Eve è un videogioco, il remake di "Mother" (2005), un simulatore di hacking a tema
// narrativo. Server, IP, account, password, "tool" e operazioni come forzare un login o sfuggire
// a un backtrace sono finzione di gioco: dati letti dai file .svr/.miss del gioco originale e
// simulati in memoria nel browser. Questo codice non apre connessioni di rete, non legge né
// modifica nulla fuori dallo stato della partita e non ha alcuna utilità al di fuori del gioco.
//
// TODO: accesso forzato alle interfacce di sicurezza (tool dei server), backtrace durante la
// sessione e notifica dei reati non sono ancora implementati: i metodi relativi sono segnaposto.

import { SERVER_REFRESH_S, connectionBandwidth } from "./balance"
import { normPath } from "./content"
import type { Game } from "./game"
import { loadServer } from "./loaders"
import type { GameFile, ServerState } from "./types"

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
}

const DIAL_SECONDS = 2.5

export class Network {
	private game: Game
	connection: Connection | null = null
	/** Nodi impostati sulla Network Map prima di connettersi */
	pendingNodes: string[] = []
	readonly localIP = "127.0.0.1"

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
		this.connection = null
		this.pendingNodes = []
		this.game.log("Disconnesso dal Network.")
		this.game.emit({ type: "sound", name: "disconnect" })
		this.game.emit({ type: "disconnected", reason })
	}

	/** Logout dal server: si torna all'interfaccia di autenticazione */
	logout() {
		if (!this.connection) return
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

	// TODO: accesso forzato alle interfacce di sicurezza e backtrace della sessione.
	/** Segnaposto: notifica di un reato da parte di Intrapol */
	notifyCrime(_ip: string, _caughtLive: boolean) {}

	// --- file remoti ---

	/** File del server visibili all'utente autenticato (pubblici se il server non è protetto) */
	visibleFilesOf(srv: ServerState): GameFile[] {
		const user = this.connection?.target === srv.ip ? this.connection.logged : undefined
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
		// Server sotto sequestro che tornano online
		for (const srv of Object.values(this.servers)) {
			if (srv.seizedUntil && srv.seizedUntil <= this.game.now) {
				srv.seizedUntil = undefined
				this.game.schedule(0, "refreshServer", { ip: srv.ip })
			}
		}
	}
}

export { SERVER_REFRESH_S }
