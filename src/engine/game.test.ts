import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"
import { BACKMIRROR_TRACE_SPEED, CRIME_NOTIFICATION_S, SERVER_REFRESH_S, crackSeconds, crimePenalty, traceSeconds, violationRanking } from "./balance"
import { addToPack, emptyPack, type ContentPack } from "./content"
import { Game } from "./game"

const GAME = join(process.cwd(), "public/game")

function walk(dir: string): string[] {
	return readdirSync(dir).flatMap((n) => {
		const p = join(dir, n)
		return statSync(p).isDirectory() ? walk(p) : [p]
	})
}

// Pacchetto contenuti letto dal disco, come lo carica fetchPack nel browser
function diskPack(): ContentPack {
	const pack = emptyPack()
	for (const f of walk(GAME)) {
		if (!/\.(svr|fak|miss|script|text)$/.test(f)) continue
		addToPack(pack, relative(GAME, f).split("\\").join("/"), readFileSync(f, "utf8"))
	}
	return pack
}

const NOW = new Date("2026-10-22T12:00:00").getTime()

describe("partita", () => {
	it("nuova partita: server, mappa e mail iniziali", () => {
		const game = Game.newGame(diskPack(), "eve", "eve", NOW, { random: () => 0.5 })
		expect(Object.keys(game.state.servers)).toHaveLength(57)
		expect(game.state.known).toContain("547.2.8.791")
		expect(game.address).toBe("eve@mother")
		expect(game.userClass).toBe("Lamer")
		expect(game.flashramUsed).toBe(120)

		game.advance(60_000)
		const subjects = game.state.mails.map((m) => m.subject)
		expect(subjects).toContain("Un benvenuto da tutta la community!")
	})

	it("tutorial: risposta a 1ronCh4ng e tut_hack in flashram", () => {
		const game = Game.newGame(diskPack(), "eve", "eve", NOW, { random: () => 0.5 })
		game.missions.load("def/tut0.miss")
		game.advance(30_000)
		const mail = game.state.mails.find((m) => m.subject === "Piccoli Lamer crescono!!")
		expect(mail).toBeDefined()
		expect(mail!.body).toContain("Hey eve!")
		expect(game.replyText(mail!.id)).toContain("Ci conosciamo??")

		game.reply(mail!.id)
		game.advance(60_000)
		expect(game.state.completed).toContain("def/tut0.miss")
		expect(game.findLocalFile("tut_hack-1.0")).toBeGreaterThanOrEqual(0)
		expect(game.state.mails.some((m) => m.subject === "Ecco l'aiuto...")).toBe(true)
	})

	it("risposta con allegato non richiesto: ignorata", () => {
		const game = Game.newGame(diskPack(), "eve", "eve", NOW, { random: () => 0.5 })
		game.missions.load("def/tut0.miss")
		game.addLocalFile({ name: "nota", dim: 1, img: -1, contents: "x", owner: "eve" })
		game.advance(30_000)
		const mail = game.state.mails.find((m) => m.subject === "Piccoli Lamer crescono!!")!
		game.reply(mail.id, "nota")
		game.advance(60_000)
		expect(game.state.completed).not.toContain("def/tut0.miss")
	})

	it("connessione al Commerce Server con la banda attesa", () => {
		const game = Game.newGame(diskPack(), "eve", "eve", NOW, { random: () => 0.5 })
		game.network.addNode("547.2.8.791")
		expect(game.network.connect()).toBeNull()
		game.advance(5_000)
		expect(game.network.host?.name).toBe("jimmyhardware.mothernet")
		expect(game.netUsed).toBe(20)
		game.network.disconnect()
		expect(game.netUsed).toBe(0)
	})

	it("script: Delay, ciclo ed ExitScript", () => {
		const game = Game.newGame(diskPack(), "eve", "eve", NOW)
		expect(game.scripts.start("wallchanger")).toBeNull()
		expect(game.state.settings.wallpaper).toBe(2)
		game.advance(10_500)
		expect(game.state.settings.wallpaper).toBe(3)
		expect(game.scripts.start("hello.script")).toBeNull()
		expect(game.scripts.list()).toEqual(["wallchanger.script"])
		expect(game.scripts.kill("wallchanger")).toBe(true)
	})

	describe("console", () => {
		const setup = () => Game.newGame(diskPack(), "eve", "eve", NOW, { random: () => 0.5 })
		// Righe scritte nel log da un comando
		const exec = (game: Game, line: string) => {
			const before = game.state.console.length
			game.shell.exec(line)
			return game.state.console.slice(before + 1).join("\n")
		}

		it("comando sconosciuto e help con i comandi di gioco", () => {
			const game = setup()
			expect(exec(game, "pippo")).toContain("comando sconosciuto!")
			const help = exec(game, "help")
			for (const name of ["ls", "view", "run", "connect", "resolve", "missions", "runscript", "debug"]) expect(help).toMatch(new RegExp(`^ {4}${name} `, "m"))
		})

		it("ls, view e run sui file in flashram", () => {
			const game = setup()
			expect(exec(game, "ls")).toContain("nessun file in flashram.")
			game.addLocalFile({ name: "nota segreta", dim: 2, img: -1, contents: "riga uno\nriga due", owner: "eve" })
			const ls = exec(game, "ls")
			expect(ls).toContain("nota segreta")
			expect(ls).toContain(`${game.flashramFree} Mb liberi.`)
			expect(exec(game, "view nota segreta")).toBe("    riga uno\n    riga due")
			expect(exec(game, "view nulla")).toContain("file inesistente!")
			expect(exec(game, "view")).toContain("sintassi: view <file>")
			expect(exec(game, "run nulla")).toContain("programma inesistente!")
		})

		it("run apre il programma per nome del file o per identificativo", () => {
			const game = setup()
			game.addLocalFile({ name: "momamp-2.91", dim: 4, img: -1, contents: "momamp", owner: "eve" })
			const opened: string[] = []
			game.onEvent((e) => e.type === "program" && opened.push(`${e.id}:${e.name}`))
			expect(exec(game, "run momamp-2.91")).toContain("esecuzione di momamp-2.91...")
			exec(game, "run MOMAMP")
			exec(game, "run nulla")
			expect(opened).toEqual(["momamp:momamp-2.91", "momamp:momamp-2.91"])
		})

		it("connect, disconnect, resolve e removeserver", () => {
			const game = setup()
			expect(exec(game, "connect")).toContain("sintassi")
			expect(exec(game, "connect 1.2.3.4")).toContain("Impossibile raggiungere l'host remoto.")
			exec(game, "connect 547.2.8.791")
			game.advance(5_000)
			expect(game.network.host?.name).toBe("jimmyhardware.mothernet")
			exec(game, "disconnect")
			expect(game.network.connection).toBeNull()
			expect(exec(game, "disconnect")).toContain("nessuna connessione attiva.")

			const hidden = Object.values(game.state.servers).find((s) => !game.state.known.includes(s.ip) && s.type)!
			expect(exec(game, `resolve ${hidden.name}`)).toContain(`[${hidden.ip}]`)
			expect(game.state.known).toContain(hidden.ip)
			expect(exec(game, "resolve inesistente.mothernet")).toContain("impossibile risolvere")
			expect(exec(game, `removeserver ${hidden.ip}`)).toContain("rimosso")
			expect(game.state.known).not.toContain(hidden.ip)
			expect(exec(game, `removeserver ${hidden.ip}`)).toContain("non presente")
			expect(exec(game, "refreshservers")).toContain("nessun server nuovo.")
		})

		it("addmission e missions", () => {
			const game = setup()
			expect(exec(game, "addmission def/tut0.miss")).toContain("missione caricata")
			expect(exec(game, "addmission def/tut0.miss")).toContain("già attiva o completata")
			// Stesso file senza estensione o con '\' e maiuscole: non deve caricarsi due volte
			expect(exec(game, "addmission def/tut0")).toContain("già attiva o completata")
			expect(exec(game, "addmission DEF\\TUT0")).toContain("già attiva o completata")
			expect(game.missions.active.filter((m) => m.def.path === "def/tut0.miss")).toHaveLength(1)
			expect(exec(game, "addmission def/nulla.miss")).toContain("Missione non trovata")
			expect(exec(game, "missions")).toContain("Tutorial Fase 1")
		})

		it("runscript, lsscript, killscript e debug", () => {
			const game = setup()
			expect(exec(game, "runscript wallchanger")).toBe("")
			expect(exec(game, "runscript wallchanger")).toContain("già in esecuzione")
			expect(exec(game, "runscript nulla")).toContain("Script non trovato")
			expect(exec(game, "lsscript")).toContain("wallchanger.script")
			expect(exec(game, "killscript wallchanger")).toContain("script terminato.")
			expect(exec(game, "killscript wallchanger")).toContain("non in esecuzione")
			expect(exec(game, "lsscript")).toContain("nessuno script")

			expect(exec(game, "debug 1")).toContain("attivato")
			expect(game.state.debug).toBe(true)
			expect(exec(game, "debug")).toContain("attuale: 1")
			exec(game, "debug 0")
			expect(game.state.debug).toBe(false)
		})
	})

	describe("accesso forzato e backtrace", () => {
		const LOGIN = "10.258.291.13" // servid.telemark: Login, Admin con ranking 450, log.connections
		const VRLS = "147.12.36.941" // hime.bentekamerica: VRLS con la voce snd_phone_admin:3
		const PHONE_OK = "033921923941" // linea con la voce snd_phone_admin:3
		const PHONE_OTHER = "03319229741" // linea con la voce snd_phone_admin:1
		const ADMIN_RANKING = 450

		const setup = () => Game.newGame(diskPack(), "eve", "eve", NOW, { random: () => 0.5 })
		const install = (game: Game, id: string, version: string) => game.addLocalFile({ name: `${id}-${version}`, dim: 2, img: -1, contents: id, owner: "eve" })
		const connect = (game: Game, ip: string) => {
			expect(game.network.connectDirect(ip)).toBeNull()
			game.advance(3_000)
			expect(game.network.host?.ip).toBe(ip)
		}
		// Completa l'operazione a tempo in corso del tipo dato
		const finish = (game: Game, kind: "crack" | "call") => {
			const task = game.tasks.find((t) => t.kind === kind)!
			game.advance(Math.ceil((task.total - task.elapsed) * 1000) + 250)
		}
		/** Login forzato su LOGIN con rootbreaker 1.1; restituisce il ranking subito dopo */
		const crackLogin = (game: Game) => {
			install(game, "rootbreaker", "1.1")
			connect(game, LOGIN)
			expect(game.network.startCrack()).toBeNull()
			finish(game, "crack")
			expect(game.network.connection?.forced).toBe(true)
			return game.state.ranking
		}

		it("rootbreaker: login forzato, ranking alla prima violazione e backtrace avviato", () => {
			const game = setup()
			connect(game, LOGIN)
			const srv = game.state.servers[LOGIN]
			expect(game.network.needsAuth()).toBe(true)
			expect(game.network.startCrack()).toContain("rootbreaker non presente")

			install(game, "rootbreaker", "1.1")
			const ranking = game.state.ranking
			expect(game.network.startCrack()).toBeNull()
			expect(game.network.startCrack()).toContain("già in corso")
			const task = game.tasks.find((t) => t.kind === "crack")!
			expect(task.total).toBeCloseTo(crackSeconds(ADMIN_RANKING, srv.cpu, 1000, 1))
			const trace = game.network.connection!.trace!
			expect(trace.total).toBeCloseTo(traceSeconds(srv.net, ADMIN_RANKING, 1, 0))
			expect(trace.total).toBeGreaterThan(task.total)

			finish(game, "crack")
			const c = game.network.connection!
			expect(c.logged).toBe("Admin")
			expect(c.forced).toBe(true)
			expect(game.network.needsAuth()).toBe(false)
			expect(game.network.breach).toBeNull()
			expect(game.state.ranking).toBe(ranking + violationRanking(ADMIN_RANKING))
			expect(srv.everHacked).toBe(true)
			expect(srv.traces?.ranking).toBe(ADMIN_RANKING)
			expect(game.network.visibleFiles().map((f) => f.name)).toContain("log.connections")
			expect(trace.elapsed).toBeGreaterThan(0)
		})

		it("reato notificato dopo CRIME_NOTIFICATION_S, sequestro con hackedsys.fak e ripristino", () => {
			const game = setup()
			const messages: string[] = []
			game.onEvent((e) => e.type === "message" && messages.push(e.text))
			const ranking = crackLogin(game)
			expect(game.state.events.some((e) => e.kind === "crime")).toBe(false)
			game.network.disconnect()
			expect(game.state.events.filter((e) => e.kind === "crime")).toHaveLength(1)

			game.advance(CRIME_NOTIFICATION_S * 1000 - 500)
			expect(game.state.ranking).toBe(ranking)
			game.advance(500)
			const penalty = crimePenalty(ADMIN_RANKING, false)
			expect(game.state.ranking).toBe(ranking - penalty.ranking)
			expect(game.state.credits).toBe(60)
			expect(messages.some((m) => m.includes("servid.telemark") && m.includes("sequestro"))).toBe(true)

			const seized = game.state.servers[LOGIN]
			expect(seized.seizedUntil).toBeDefined()
			expect(seized.traces).toBeUndefined()
			expect(seized.welcome).toContain("Server sotto sequestro")
			connect(game, LOGIN)
			expect(game.network.needsAuth()).toBe(false)
			expect(game.network.visibleFiles()).toEqual([])
			expect(game.network.startCrack()).toContain("Nessuna interfaccia")
			game.network.disconnect()

			game.advance(SERVER_REFRESH_S * 1000 + 1_000)
			const restored = game.state.servers[LOGIN]
			expect(restored.seizedUntil).toBeUndefined()
			expect(restored.protection).toBe("Login")
			expect(restored.welcome).not.toContain("sequestro")
			expect(restored.everHacked).toBe(true)

			// Seconda violazione dello stesso server: niente ranking extra
			const before = game.state.ranking
			connect(game, LOGIN)
			expect(game.network.startCrack()).toBeNull()
			finish(game, "crack")
			expect(game.state.ranking).toBe(before)
		})

		it("cancellare i log delle connessioni elimina le tracce: nessun reato", () => {
			const game = setup()
			const ranking = crackLogin(game)
			const log = game.network.visibleFiles().find((f) => f.name === "log.connections")!
			expect(game.network.deleteRemoteFile(log)).toBe(true)
			expect(game.state.servers[LOGIN].traces).toBeUndefined()
			game.network.disconnect()
			expect(game.state.events.some((e) => e.kind === "crime")).toBe(false)
			game.advance(CRIME_NOTIFICATION_S * 1000 + 1_000)
			expect(game.state.ranking).toBe(ranking)
			expect(game.state.servers[LOGIN].seizedUntil).toBeUndefined()
		})

		it("backtrace completato prima del cracking: preso in diretta, nessun sequestro", () => {
			const game = setup()
			const traced: string[] = []
			game.onEvent((e) => e.type === "traced" && traced.push(e.ip))
			install(game, "rootbreaker", "1.1")
			const ARCHIVES = "212.218.162.172" // archives.gs: Admin 1800, cracking più lento del backtrace
			connect(game, ARCHIVES)
			const ranking = game.state.ranking
			expect(game.network.startCrack()).toBeNull()
			const trace = game.network.connection!.trace!
			expect(trace.total).toBeLessThan(game.tasks.find((t) => t.kind === "crack")!.total)
			game.advance(Math.ceil(trace.total * 1000) + 250)

			const penalty = crimePenalty(1800, true)
			expect(game.network.connection).toBeNull()
			expect(game.network.breach).toBeNull()
			expect(game.tasks.some((t) => t.kind === "crack")).toBe(false)
			expect(traced).toEqual([ARCHIVES])
			expect(game.state.ranking).toBe(ranking - penalty.ranking)
			expect(game.state.credits).toBe(60 - penalty.credits)
			expect(game.state.servers[ARCHIVES].everHacked).toBeFalsy()
			expect(game.state.servers[ARCHIVES].seizedUntil).toBeUndefined()
		})

		it("restando connessi conta solo il backtrace in tempo reale", () => {
			const game = setup()
			const ranking = crackLogin(game)
			const trace = game.network.connection!.trace!
			// Il backtrace di servid.telemark dura più di CRIME_NOTIFICATION_S: nessuna notifica differita intanto
			expect(trace.total - trace.elapsed).toBeGreaterThan(CRIME_NOTIFICATION_S + 1)
			game.advance(CRIME_NOTIFICATION_S * 1000 + 500)
			expect(game.network.connection?.forced).toBe(true)
			expect(game.state.ranking).toBe(ranking)

			game.advance(Math.ceil((trace.total - trace.elapsed) * 1000) + 250)
			const penalty = crimePenalty(ADMIN_RANKING, true)
			expect(game.network.connection).toBeNull()
			expect(game.state.ranking).toBe(ranking - penalty.ranking)
			expect(game.state.credits).toBe(60 - penalty.credits)
			expect(game.state.servers[LOGIN].seizedUntil).toBeDefined()
			// Preso in diretta: la disconnessione non programma un secondo reato
			expect(game.state.events.some((e) => e.kind === "crime")).toBe(false)
		})

		it("logout con le tracce nei log: reato notificato dopo CRIME_NOTIFICATION_S", () => {
			const game = setup()
			const ranking = crackLogin(game)
			game.network.logout()
			expect(game.network.needsAuth()).toBe(true)
			game.network.disconnect()
			// Logout e disconnessione programmano entrambi la notifica, ma il reato è uno solo
			game.advance(CRIME_NOTIFICATION_S * 1000 + 1_000)
			expect(game.state.ranking).toBe(ranking - crimePenalty(ADMIN_RANKING, false).ranking)
			expect(game.state.servers[LOGIN].seizedUntil).toBeDefined()
		})

		it("nuovo accesso forzato dopo il logout: vale la notifica della sessione più recente", () => {
			const game = setup()
			const ranking = crackLogin(game)
			game.network.logout()
			game.advance(1_000)
			expect(game.network.startCrack()).toBeNull()
			finish(game, "crack")
			const tracesAt = game.state.servers[LOGIN].traces!.at
			game.network.disconnect()
			const crimes = game.state.events.filter((e) => e.kind === "crime")
			expect(crimes.map((e) => e.payload.at)).toEqual([expect.any(Number), tracesAt])

			// La notifica programmata al logout riguarda tracce ormai sostituite: ignorata
			game.advance(crimes[1].at - game.now - 500)
			expect(game.state.ranking).toBe(ranking)
			game.advance(1_000)
			expect(game.state.ranking).toBe(ranking - crimePenalty(ADMIN_RANKING, false).ranking)
		})

		it("backmirror aperto rallenta il backtrace", () => {
			const game = setup()
			install(game, "rootbreaker", "1.1")
			connect(game, LOGIN)
			expect(game.network.startCrack()).toBeNull()
			const trace = game.network.connection!.trace!
			game.advance(10_000)
			expect(trace.elapsed).toBeCloseTo(10)
			game.network.backmirror = true
			game.advance(10_000)
			expect(BACKMIRROR_TRACE_SPEED).toBeCloseTo(0.7)
			expect(trace.elapsed).toBeCloseTo(10 + 10 * BACKMIRROR_TRACE_SPEED)
			game.network.backmirror = false
			game.advance(1_000)
			expect(trace.elapsed).toBeCloseTo(11 + 10 * BACKMIRROR_TRACE_SPEED)
		})

		it("i Proxy Server contano doppio nel backtrace; disconnettersi interrompe l'attacco", () => {
			const game = setup()
			install(game, "rootbreaker", "1.1")
			const proxy = Object.values(game.state.servers).find((s) => s.type === "Proxy Server")!
			game.network.addNode(proxy.ip)
			connect(game, LOGIN)
			expect(game.network.connection!.nodes).toEqual([proxy.ip, LOGIN])
			expect(game.network.startCrack()).toBeNull()
			const srv = game.state.servers[LOGIN]
			expect(game.network.connection!.trace!.total).toBeCloseTo(traceSeconds(srv.net, ADMIN_RANKING, 3, 0))

			game.network.disconnect()
			expect(game.network.breach).toBeNull()
			expect(game.tasks.some((t) => t.kind === "crack")).toBe(false)
		})

		it("rootbreaker rifiutato su server non violabili o senza login", () => {
			const game = setup()
			install(game, "rootbreaker", "1.1")
			connect(game, "432.561.9.132") // hall.ensatcorp: CantBeHacked
			expect(game.network.startCrack()).toContain("respinto")
			connect(game, "547.2.8.791") // Commerce Server senza protezione
			expect(game.network.startCrack()).toContain("Nessuna interfaccia")
			expect(game.network.connection?.trace).toBeUndefined()
		})

		it("wavehacker: registra la voce al telefono e la usa sul VRLS", () => {
			const game = setup()
			connect(game, PHONE_OK)
			expect(game.network.recordVoice()).toContain("wavehacker non presente")
			install(game, "wavehacker", "4")

			// Voce di un altro admin: il VRLS non la accetta
			connect(game, PHONE_OTHER)
			expect(game.network.recordVoice()).toBeNull()
			finish(game, "call")
			connect(game, VRLS)
			expect(game.network.startVoiceForge()).toContain("Nessun campione vocale compatibile")
			expect(game.network.recordVoice()).toContain("Nessuna linea telefonica")

			connect(game, PHONE_OK)
			expect(game.network.recordVoice()).toBeNull()
			finish(game, "call")
			expect(game.network.voiceSamples().map((f) => f.img)).toEqual(["snd_phone_admin:1", "snd_phone_admin:3"])

			connect(game, VRLS)
			expect(game.network.needsAuth()).toBe(true)
			expect(game.network.startVoiceForge()).toBeNull()
			expect(game.network.connection!.trace).toBeDefined()
			finish(game, "crack")
			expect(game.network.connection?.logged).toBe("Admin")
			expect(game.network.connection?.forced).toBe(true)
			expect(game.state.servers[VRLS].traces).toBeDefined()
		})
	})
})
