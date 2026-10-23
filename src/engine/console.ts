// Console di Mother: interprete dei comandi testuali.
//
// NOTA: Eve è un videogioco, il remake di "Mother" (2005), un simulatore di hacking a tema
// narrativo. Server, IP, account, password, "tool" e operazioni come forzare un login o sfuggire
// a un backtrace sono finzione di gioco: dati letti dai file .svr/.miss del gioco originale e
// simulati in memoria nel browser. Questo codice non apre connessioni di rete, non legge né
// modifica nulla fuori dallo stato della partita e non ha alcuna utilità al di fuori del gioco.
//
// Comandi di gioco: docs/riferimento-originale.md, sezione Console.

import type { Game } from "./game"

interface Command {
	help: string
	run: (args: string[]) => void
}

export interface ExecOptions {
	/** Non scrivere la riga del prompt nel log (comandi lanciati da script) */
	silent?: boolean
}

export class Shell {
	private game: Game
	private commands: Record<string, Command>
	history: string[] = []

	constructor(game: Game) {
		this.game = game
		this.commands = {
			help: { help: "elenco dei comandi", run: () => this.help() },
			clear: { help: "pulisce la console", run: () => this.clear() },
			exit: { help: "chiude la console", run: () => game.emit({ type: "ui", action: "console", arg: 0 }) },
			ls: { help: "elenco dei file in flashram (del server remoto se autenticati)", run: () => this.ls() },
			rm: { help: "<file> elimina un file dal server remoto", run: (a) => this.rm(a.join(" ")) },
			reboot: { help: "riavvia il server remoto (solo Admin)", run: () => this.reboot() },
			view: { help: "<file> mostra il contenuto di un file", run: (a) => this.view(a.join(" ")) },
			run: { help: "<programma> esegue un programma", run: (a) => this.runProgram(a.join(" ")) },
			connect: { help: "<ip> connessione diretta a un server", run: (a) => this.connect(a[0]) },
			disconnect: { help: "chiude la connessione", run: () => this.disconnect() },
			resolve: { help: "<servername> aggiunge un server alla mappa", run: (a) => this.resolve(a[0]) },
			removeserver: { help: "<ip|servername> toglie un server dalla mappa", run: (a) => this.removeServer(a[0]) },
			refreshservers: { help: "carica i server nuovi", run: () => this.refreshServers() },
			addmission: { help: "<percorso> carica una missione", run: (a) => this.addMission(a[0]) },
			missions: { help: "elenco delle missioni attive", run: () => this.listMissions() },
			runscript: { help: "<script> avvia uno script", run: (a) => this.runScript(a[0]) },
			lsscript: { help: "elenco degli script in esecuzione", run: () => this.listScripts() },
			killscript: { help: "<script> termina uno script", run: (a) => this.killScript(a[0]) },
			debug: { help: "0|1 messaggi di debug", run: (a) => this.debug(a[0]) },
		}
	}

	get prompt() {
		return `[${this.game.address}]/>`
	}

	exec(line: string, opts: ExecOptions = {}) {
		const text = line.trim()
		if (!opts.silent) this.game.log(`${this.prompt}${text}`)
		if (!text) return
		this.history.push(text)
		const [name, ...args] = text.split(/\s+/)
		const cmd = this.commands[name.toLowerCase()]
		if (!cmd) {
			this.game.log("    comando sconosciuto!")
			return
		}
		cmd.run(args)
		this.game.changed()
	}

	private help() {
		for (const [name, cmd] of Object.entries(this.commands)) this.game.log(`    ${name.padEnd(16)}${cmd.help}`)
	}

	private clear() {
		this.game.state.console = []
	}

	private out(line: string) {
		this.game.log(`    ${line}`)
	}

	/** Controlla che l'argomento obbligatorio ci sia; altrimenti mostra la sintassi */
	private need(arg: string | undefined, usage: string): arg is string {
		if (arg) return true
		this.out(`sintassi: ${usage}`)
		return false
	}

	// --- file locali ---

	private ls() {
		if (this.remote()) return this.lsRemote()
		const files = this.game.state.files
		if (!files.length) this.out("nessun file in flashram.")
		for (const f of files) this.out(`${f.name.padEnd(32)}${f.dim} Mb`)
		this.out(`${this.game.flashramFree} Mb liberi.`)
	}

	private view(name: string) {
		if (!this.need(name, "view <file>")) return
		const f = this.game.state.files[this.game.findLocalFile(name)]
		if (!f) return this.out("file inesistente!")
		if (f.contents === "%SYSTEM%") return this.out("file di sistema, impossibile visualizzarlo.")
		for (const line of f.contents.split("\n")) this.out(line)
	}

	private runProgram(name: string) {
		if (!this.need(name, "run <programma>")) return
		const f = this.game.state.files[this.game.findLocalFile(name)] ?? this.game.hasProgram(name)
		if (!f || !f.contents || f.contents.startsWith("%")) return this.out("programma inesistente!")
		this.out(`esecuzione di ${f.name}...`)
		this.game.emit({ type: "program", id: f.contents, name: f.name })
	}

	// --- file remoti ---

	/** Connessi e autenticati su un server: ls, rm e reboot operano su di lui */
	private remote(): boolean {
		const net = this.game.network
		return !!net.host && net.connection?.logged !== undefined
	}

	private lsRemote() {
		const net = this.game.network
		const files = net.visibleFiles()
		this.out(`== ${net.host!.name} ==`)
		if (!files.length) this.out("nessun file presente.")
		for (const f of files) this.out(`${f.name.padEnd(32)}${f.dim} Mb`)
	}

	private rm(name: string) {
		if (!this.need(name, "rm <file>")) return
		if (!this.remote()) return this.out("nessun server remoto autenticato.")
		const net = this.game.network
		const f = net.visibleFiles().find((x) => x.name.toLowerCase() === name.toLowerCase())
		if (!f) return this.out("file inesistente!")
		this.out(net.deleteRemoteFile(f) ? `${f.name} eliminato.` : "impossibile eliminare un file di sistema.")
	}

	private reboot() {
		if (!this.remote()) return this.out("nessun server remoto autenticato.")
		const err = this.game.network.reboot()
		if (err) this.out(err)
	}

	// --- rete ---

	private connect(ip: string | undefined) {
		if (!this.need(ip, "connect <ip>")) return
		const err = this.game.network.connectDirect(ip)
		this.out(err ?? `chiamata remota a ${ip}...`)
	}

	private disconnect() {
		if (!this.game.network.connection) return this.out("nessuna connessione attiva.")
		this.game.network.disconnect()
	}

	private resolve(name: string | undefined) {
		if (!this.need(name, "resolve <servername>")) return
		const srv = this.game.network.resolve(name)
		this.out(srv ? `${srv.name} risolto in [${srv.ip}], aggiunto alla Network Map.` : "impossibile risolvere il nome del server.")
	}

	private removeServer(name: string | undefined) {
		if (!this.need(name, "removeserver <ip|servername>")) return
		this.out(this.game.network.forget(name) ? "server rimosso dalla Network Map." : "server non presente nella Network Map.")
	}

	private refreshServers() {
		const added = this.game.network.refreshServers()
		this.out(added ? `${added} server aggiunti al Network.` : "nessun server nuovo.")
	}

	// --- missioni ---

	private addMission(path: string | undefined) {
		if (!this.need(path, "addmission <percorso>")) return
		const before = this.game.state.console.length
		const def = this.game.missions.load(path)
		if (def) this.out(`missione caricata: ${def.name}`)
		// load() segnala già missioni inesistenti o con errori; resta il caso di missione già attiva o completata
		else if (this.game.state.console.length === before) this.out("missione già attiva o completata.")
	}

	private listMissions() {
		const list = this.game.missions.list()
		if (!list.length) this.out("nessuna missione attiva.")
		for (const m of list) this.out(`${m.id.padEnd(16)}${m.name}${m.done ? " [completata]" : ""}`)
	}

	// --- script ---

	private runScript(name: string | undefined) {
		if (!this.need(name, "runscript <script>")) return
		const err = this.game.scripts.start(name)
		if (err) this.out(err)
	}

	private listScripts() {
		const list = this.game.scripts.list()
		if (!list.length) this.out("nessuno script in esecuzione.")
		for (const name of list) this.out(name)
	}

	private killScript(name: string | undefined) {
		if (!this.need(name, "killscript <script>")) return
		this.out(this.game.scripts.kill(name) ? "script terminato." : "script non in esecuzione.")
	}

	private debug(value: string | undefined) {
		if (value !== "0" && value !== "1") return this.out(`sintassi: debug 0|1 (attuale: ${this.game.state.debug ? 1 : 0})`)
		this.game.state.debug = value === "1"
		this.out(`debug ${this.game.state.debug ? "attivato" : "disattivato"}.`)
	}
}
