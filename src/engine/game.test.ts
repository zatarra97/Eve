import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"
import { NETPATCH_KERNEL, NETPATCH_SECONDS, startNetPatch } from "./netpatch"
import {
	BACKMIRROR_TRACE_SPEED,
	CRIME_NOTIFICATION_S,
	MISSGEN_INTERVAL_S,
	MISSGEN_LIFETIME_S,
	MISSGEN_MAX_OFFERS,
	NETBANKING_KARMA_PENALTY,
	NUKE_DURATION_S,
	SERVER_REFRESH_S,
	crackSeconds,
	crimePenalty,
	nukeSeconds,
	traceSeconds,
	transferSeconds,
	violationRanking,
} from "./balance"
import { addToPack, emptyPack, type ContentPack } from "./content"
import { Game } from "./game"
import { formatRemaining } from "./missgen"
import { objectiveOf } from "./objectives"

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
		expect(mail!.body).toContain("Hey eve, benvenuto")
		expect(game.replyText(mail!.id)).toContain("Ci conosciamo??")

		game.reply(mail!.id)
		game.advance(60_000)
		expect(game.state.completed).toContain("def/tut0.miss")
		expect(game.findLocalFile("tut_hack-1.0")).toBeGreaterThanOrEqual(0)
		expect(game.state.mails.some((m) => m.subject === "Ecco l'aiuto...")).toBe(true)
	})

	it("glossario: le mail sbloccano i termini nella Guida, anche nei salvataggi senza glossario", () => {
		const game = Game.newGame(diskPack(), "eve", "eve", NOW, { random: () => 0.5 })
		delete game.state.glossary
		game.receiveMail({ from: "x@mother", subject: "prova", body: "Usa rootbreaker e poi cancella log.connections." })
		expect(game.glossary).toEqual(["rootbreaker", "log"])
		game.learn("rootbreaker")
		game.learn("inesistente")
		expect(game.glossary).toEqual(["rootbreaker", "log"])
	})

	it("diciture: nelle mail originali Flashram diventa memoria", () => {
		const game = Game.newGame(diskPack(), "eve", "eve", NOW, { random: () => 0.5 })
		const mail = game.receiveMail({ from: "x@mother", subject: "prova", body: "La troverai nella tua Flashram." })
		expect(mail.body).toBe("La troverai nella tua memoria.")
	})

	it("obiettivi: ogni missione iniziale dice cosa fare, anche senza mail", () => {
		const game = Game.newGame(diskPack(), "eve", "eve", NOW, { random: () => 0.5 })
		game.missions.load("def/tut0.miss")
		const byId = Object.fromEntries(game.missions.list().map((m) => [m.path, m.objective?.text]))
		// def/000 è solo una mail di benvenuto
		expect(byId["def/000.miss"]).toBeUndefined()
		expect(byId["uground/a00.miss"]).toMatch(/^Collegati al Chat Server /)
		expect(byId["xmiss/nmcha-01.miss"]).toMatch(/^Elimina il file 'exe\.hotmeat' da /)
		expect(byId["def/tut0.miss"]).toMatch(/^Rispondi alla mail di 1ronch4ng@mother/i)

		// Server non ancora in mappa: l'obiettivo dice come trovarlo
		const a01 = game.missions.load("uground/a01.miss")!
		game.state.known = game.state.known.filter((ip) => ip !== game.network.server(a01.refServerIP)!.ip)
		expect(objectiveOf(game, a01)?.text).toContain("resolve")

		const a02 = game.missions.load("uground/a02.miss")!
		expect(objectiveOf(game, a02)).toMatchObject({ text: expect.stringContaining("Raggiungi 250 punti di Ranking"), progress: "100/250", hint: expect.any(String) })

		// Le mail di inizio portano il riferimento alla missione, per il riquadro Obiettivo
		game.advance(60_000)
		expect(game.state.mails.find((m) => m.mission === "uground/a02.miss")).toBeDefined()
	})

	it("testi di Eve: sostituiscono quelli originali solo dove sono riscritti", () => {
		const game = Game.newGame(diskPack(), "eve", "eve", NOW, { random: () => 0.5 })
		const a01 = game.missions.load("uground/a01.miss")!
		// Mittente e oggetto restano quelli dell'originale (servono per riconoscere la risposta)
		expect(a01.begin[0]).toMatchObject({ from: "s0ftm4rk@mother", subject: "AIUTOOOOOO!!" })
		expect(a01.begin[0].body).toMatch(/^Ciao eve, ti ho visto in chat/)
		expect(a01.begin[0].body).toContain("rootbreaker")
		// A05 non aveva mail di inizio: ora ne ha una
		const a05 = game.missions.load("uground/a05.miss")!
		expect(a05.begin).toHaveLength(1)
		expect(a05.begin[0].from).toBe("1ronCh4ng@mother")
		// Le missioni non riscritte restano come nell'originale
		const a07 = game.missions.load("uground/a07.miss")!
		expect(a07.begin[0].body).not.toContain("{user}")
		expect(a07.begin[0].body.split(/\s+/).length).toBeGreaterThan(80)
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

	it('ServerIPToRemove="RefServerIP" non rimuove nulla, come nell\'originale', () => {
		const game = Game.newGame(diskPack(), "eve", "eve", NOW, { random: () => 0.5 })
		// A04 punta a crimediv.intrapol, che serve ancora ad A19 e nmcha-05
		const def = game.missions.load("uground/A04.miss")!
		expect(def.serverIPToRemove).toBe("RefServerIP")
		const ref = game.network.server(def.refServerIP)!
		game.network.addKnown(ref.ip)
		game.missions.complete(game.missions.active.find((m) => m.def === def)!)
		expect(ref.removed).toBeFalsy()
		expect(game.state.known).toContain(ref.ip)
	})

	it("netpatch6231: A11 si completa dopo l'aggiornamento del kernel di NetComm", () => {
		const game = Game.newGame(diskPack(), "eve", "eve", NOW, { random: () => 0.5 })
		// Senza il programma non si parte
		expect(startNetPatch(game)).toContain("non è presente")

		game.missions.load("uground/A11.miss")
		expect(game.hasProgram("netpatch6231")).toBeDefined()
		game.advance(30_000)
		const mail = game.state.mails.find((m) => m.subject === "Arriva la medicina!")!
		expect(mail).toBeDefined()

		// Rispondere prima dell'aggiornamento non basta
		game.reply(mail.id)
		game.advance(5_000)
		expect(game.missions.active.find((m) => m.def.path === "uground/a11.miss")?.done).toBeFalsy()

		expect(startNetPatch(game)).toBeNull()
		expect(startNetPatch(game)).toContain("già in corso")
		expect(game.cpuUsed).toBeGreaterThan(0)
		game.advance((NETPATCH_SECONDS - 1) * 1000)
		expect(game.findLocalFile(NETPATCH_KERNEL)).toBe(-1)
		game.advance(2_000)
		expect(game.findLocalFile(NETPATCH_KERNEL)).toBeGreaterThanOrEqual(0)
		expect(game.cpuUsed).toBe(0)
		expect(startNetPatch(game)).toContain("già aggiornato")

		game.reply(mail.id)
		game.advance(60_000)
		expect(game.state.completed).toContain("uground/a11.miss")
		expect(game.missions.active.some((m) => m.def.path === "uground/a12.miss")).toBe(true)
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
			// Chi sbaglia a scrivere riceve un suggerimento
			expect(exec(game, "conect 1.2.3.4")).toContain("forse intendevi 'connect'?")
			expect(exec(game, "missons")).toContain("forse intendevi 'missions'?")
			const help = exec(game, "help")
			for (const name of ["ls", "rm", "view", "run", "connect", "resolve", "missions"]) expect(help).toMatch(new RegExp(`^ {4}${name} `, "m"))
			// I comandi per chi crea missioni e mod compaiono solo con debug 1
			expect(help).not.toMatch(/^ {4}runscript /m)
			game.state.debug = true
			expect(exec(game, "help")).toMatch(/^ {4}runscript /m)
		})

		it("rm senza server remoto elimina i file della flashram, non quelli di sistema", () => {
			const game = setup()
			game.addLocalFile({ name: "dat.vecchio", dim: 50, img: -1, contents: "", owner: "eve" })
			game.addLocalFile({ name: "sys.core", dim: 5, img: -1, contents: "%SYSTEM%", owner: "eve" })
			const free = game.flashramFree
			expect(exec(game, "rm dat.vecchio")).toContain("eliminato dalla memoria")
			expect(game.flashramFree).toBe(free + 50)
			expect(exec(game, "rm sys.core")).toContain("impossibile eliminare")
		})

		it("errori che insegnano: numeri e cosa fare", () => {
			const game = setup()
			for (const ip of ["547.2.8.791", "632.639.14.633", "666.underground.0.1", "412.23.0.69"]) game.network.addNode(ip)
			const err = game.network.connect()!
			expect(err).toContain("4 nodi richiede 160 MBps e ne hai 80 liberi")
			expect(err).toContain("Togli un nodo")
			// Il firewall dice da quale indirizzo accetta connessioni
			expect(setup().network.connectDirect("10.258.26.13")).toContain("accetta solo connessioni provenienti da 10.258.1.119")
		})

		it("ls, view e run sui file in flashram", () => {
			const game = setup()
			expect(exec(game, "ls")).toContain("nessun file in memoria.")
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

		it("connect digitato dal giocatore chiede nella console se aggiungere in mappa i server visibili non ancora noti", () => {
			const game = setup()
			const servers = Object.values(game.state.servers).filter((s) => !game.state.known.includes(s.ip) && game.network.isOnline(s))
			const [visible, other] = servers.filter((s) => s.type && !s.firewall)
			const hidden = servers.find((s) => !s.type && !s.firewall)!
			const known = game.network.knownServers().find((s) => !s.firewall)!
			const type = (line: string) => {
				const before = game.state.console.length
				game.shell.exec(line, { interactive: true })
				return game.state.console.slice(before).join("\n")
			}

			// Da autoexec o script non si chiede nulla
			game.shell.exec(`connect ${visible.ip}`)
			expect(game.shell.prompt).not.toBe("(s/N): ")
			for (const srv of [hidden, known]) expect(type(`connect ${srv.ip}`)).not.toContain("Network Map?")

			expect(type(`connect ${visible.ip}`)).toContain(`aggiungere ${visible.name} alla Network Map?`)
			expect(game.shell.prompt).toBe("(s/N): ")
			expect(type("forse")).toContain("rispondi s oppure n.")
			expect(type("s")).toContain(`${visible.name} aggiunto alla Network Map.`)
			expect(game.state.known).toContain(visible.ip)
			expect(game.shell.prompt).not.toBe("(s/N): ")

			// Invio senza risposta vale "no"
			type(`connect ${other.ip}`)
			type("")
			expect(game.state.known).not.toContain(other.ip)
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
		const finish = (game: Game, kind: "crack" | "call" | "upload") => {
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
			expect(game.network.startCrack()).toContain("rootbreaker non è nella tua memoria")

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

		it("log.connections cancellato: al nuovo accesso forzato il server lo ricrea", () => {
			const game = setup()
			const ranking = crackLogin(game)
			const srv = game.state.servers[LOGIN]
			const original = srv.files.find((f) => f.name === "log.connections")!
			const deleteLog = () => {
				const log = game.network.visibleFiles().find((f) => f.name === "log.connections")!
				expect(log).toBeDefined()
				expect(game.network.deleteRemoteFile(log)).toBe(true)
				expect(srv.traces).toBeUndefined()
			}
			deleteLog()
			game.network.disconnect()
			game.advance(CRIME_NOTIFICATION_S * 1000 + 1_000)
			expect(game.state.ranking).toBe(ranking)
			expect(srv.files.some((f) => f.name === "log.connections")).toBe(false)

			// Nuovo accesso forzato: l'indirizzo viene registrato in un log nuovo, come nel .svr
			connect(game, LOGIN)
			expect(game.network.startCrack()).toBeNull()
			finish(game, "crack")
			expect(srv.traces).toBeDefined()
			const log = srv.files.find((f) => f.name === "log.connections")!
			expect(log).toMatchObject({ dim: original.dim, contents: "%BIN%", owner: "Admin" })
			expect(srv.files.filter((f) => f.name === "log.connections")).toHaveLength(1)

			deleteLog()
			game.network.disconnect()
			expect(game.state.events.some((e) => e.kind === "crime")).toBe(false)
			game.advance(CRIME_NOTIFICATION_S * 1000 + 1_000)
			expect(game.state.ranking).toBe(ranking)
			expect(srv.seizedUntil).toBeUndefined()
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

		it("consigli del mentore: al primo incontro, una volta sola, anche dopo il ricaricamento", () => {
			const game = setup()
			const tips: string[] = []
			game.onEvent((e) => e.type === "tip" && tips.push(e.id))
			connect(game, LOGIN)
			expect(tips).toEqual(["login"])
			crackLogin(game)
			expect(tips).toEqual(["login", "backtrace", "forced"])
			// Il testo del consiglio sblocca i termini nella Guida
			expect(game.glossary).toContain("log")

			game.network.disconnect()
			connect(game, LOGIN)
			expect(tips).toEqual(["login", "backtrace", "forced"])

			// Più nodi della banda disponibile: consiglio sulla banda, poi sui nodi alla prima connessione multinodo
			game.network.disconnect()
			for (const ip of ["547.2.8.791", "632.639.14.633", "666.underground.0.1"]) game.network.addNode(ip)
			game.state.hardware.net.value = 60
			expect(game.network.connect()).toContain("Banda insufficiente")
			game.state.hardware.net.value = 80
			for (const ip of ["547.2.8.791", "632.639.14.633"]) game.network.addNode(ip)
			expect(game.network.connect()).toBeNull()
			expect(tips.slice(3)).toEqual(["bandwidth", "multinode"])

			const loaded = Game.load(diskPack(), JSON.parse(JSON.stringify(game.state)), { random: () => 0.5 })
			const after: string[] = []
			loaded.onEvent((e) => e.type === "tip" && after.push(e.id))
			loaded.tips.show("login")
			expect(after).toEqual([])
		})

		it("partita salvata durante l'accesso forzato: il ricaricamento vale come disconnessione", () => {
			const game = setup()
			const ranking = crackLogin(game)
			expect(game.state.events.some((e) => e.kind === "crime")).toBe(false)
			const saved = JSON.parse(JSON.stringify(game.state))

			const loaded = Game.load(diskPack(), saved, { random: () => 0.5 })
			expect(loaded.network.connection).toBeNull()
			expect(loaded.state.events.filter((e) => e.kind === "crime")).toHaveLength(1)
			// Un secondo caricamento dello stesso stato non duplica la notifica in coda
			loaded.network.leaveTracesOnLoad()
			expect(loaded.state.events.filter((e) => e.kind === "crime")).toHaveLength(1)

			loaded.advance(CRIME_NOTIFICATION_S * 1000 - 500)
			expect(loaded.state.ranking).toBe(ranking)
			loaded.advance(500)
			expect(loaded.state.ranking).toBe(ranking - crimePenalty(ADMIN_RANKING, false).ranking)
			expect(loaded.state.servers[LOGIN].seizedUntil).toBeDefined()
		})

		it("fileforce: caricamento su un File Server e missione FileUploading completata", () => {
			const PURESUN = "115.898.14.892" // subcorp.puresun: File Server, Login, Admin con ranking 450
			const MISSION = "uground/a-135-80-01.miss" // (percorso normalizzato) caricare exe.database su subcorp.puresun
			const game = setup()
			game.missions.load(MISSION, { subscription: true })
			game.advance(10_000)
			const mail = game.state.mails.find((m) => m.subject === "Sottoscrizione No. A-135-80-01")!
			expect(mail).toBeDefined()
			const file = game.state.files[game.findLocalFile("exe.database")]
			expect(file.dim).toBe(12)

			install(game, "rootbreaker", "1.1")
			connect(game, PURESUN)
			expect(game.network.upload(file)).toContain("fileforce non è nella tua memoria")
			install(game, "fileforce", "3.0")
			expect(game.network.upload(file)).toContain("Nessun File Server")
			expect(game.network.startCrack()).toBeNull()
			finish(game, "crack")
			expect(game.network.connection?.logged).toBe("Admin")

			const netUsed = game.netUsed
			const free = game.netFree
			expect(game.network.upload(file)).toBeNull()
			const task = game.tasks.find((t) => t.kind === "upload")!
			expect(task.total).toBeCloseTo(transferSeconds(12, free))
			expect(game.netUsed).toBe(netUsed + task.net)
			expect(game.netFree).toBe(0)
			const srv = game.state.servers[PURESUN]
			expect(srv.files.some((f) => f.name === "exe.database")).toBe(false)

			game.advance(Math.ceil(task.total * 1000) + 250)
			expect(game.tasks.some((t) => t.kind === "upload")).toBe(false)
			expect(srv.files.find((f) => f.name === "exe.database")?.owner).toBe("Admin")
			expect(game.network.visibleFiles().map((f) => f.name)).toContain("exe.database")

			const credits = game.state.credits
			game.reply(mail.id)
			expect(game.state.missions.find((m) => m.def.path === MISSION)?.done).toBe(true)
			expect(game.state.credits).toBe(credits + 80)
			game.advance(30_000)
			expect(game.state.completed).toContain(MISSION)
		})

		it("CantBeHacked: crimediv.intrapol si forza (A01), reato notificato ma nessun sequestro", () => {
			const CRIMEDIV = "911.intrapol.1.132" // crimediv.intrapol: Database Server, Login, Secure con ranking 300
			const MISSION = "uground/a01.miss" // eliminare data.unsecure-8541569 da crimediv.intrapol
			const game = setup()
			const messages: string[] = []
			game.onEvent((e) => e.type === "message" && messages.push(e.text))
			game.missions.load(MISSION)
			game.advance(10_000)
			const mail = game.state.mails.find((m) => m.subject === "AIUTOOOOOO!!")!
			expect(mail).toBeDefined()
			expect(game.state.known).toContain(CRIMEDIV)

			install(game, "rootbreaker", "1.1")
			connect(game, CRIMEDIV)
			const srv = game.state.servers[CRIMEDIV]
			expect(srv.cantBeHacked).toBe(true)
			const before = game.state.ranking
			expect(game.network.startCrack()).toBeNull()
			// Il backtrace parte comunque
			const trace = game.network.connection!.trace!
			expect(trace.total).toBeCloseTo(traceSeconds(srv.net, 300, 1, 0))
			finish(game, "crack")
			expect(game.network.connection?.logged).toBe("Secure")
			expect(game.state.ranking).toBe(before + violationRanking(300))
			expect(srv.traces?.ranking).toBe(300)

			const report = game.network.visibleFiles().find((f) => f.name === "data.unsecure-8541569")!
			expect(game.network.deleteRemoteFile(report)).toBe(true)
			game.reply(mail.id)
			expect(game.state.missions.find((m) => m.def.path === MISSION)?.done).toBe(true)

			// Le tracce restano nei log: reato notificato e penalità, ma il server non va sotto sequestro
			const ranking = game.state.ranking
			game.network.disconnect()
			game.advance(CRIME_NOTIFICATION_S * 1000 + 1_000)
			expect(game.state.completed).toContain(MISSION)
			expect(game.state.ranking).toBe(ranking - crimePenalty(300, false).ranking)
			expect(srv.traces).toBeUndefined()
			expect(srv.seizedUntil).toBeUndefined()
			expect(srv.protection).toBe("Login")
			expect(srv.terminal).toBe("DatabaseServer")
			const notice = messages.find((m) => m.includes("crimediv.intrapol"))
			expect(notice).toBeDefined()
			expect(notice).not.toContain("sequestro")
			// Nessun ripristino da programmare: il server è rimasto com'era
			game.advance(SERVER_REFRESH_S * 1000 + 1_000)
			expect(game.state.servers[CRIMEDIV].files.some((f) => f.name === "data.unsecure-8541569")).toBe(false)
		})

		it("fileforce su un Database Server: le prove di A04 caricate su crimediv.intrapol", () => {
			const CRIMEDIV = "911.intrapol.1.132" // crimediv.intrapol: Database Server, Login, CantBeHacked
			const WELLMARK = "122.13.59.874" // file.wellmark: contiene dat.sell-20111213
			const MISSION = "uground/a04.miss"
			const game = setup()
			game.missions.load(MISSION)
			game.advance(10_000)
			const mail = game.state.mails.find((m) => m.subject === "Dobbiamo fare qualcosa!")!
			expect(mail).toBeDefined()
			// Il file recuperato da file.wellmark (la violazione è già coperta dagli altri test)
			const evidence = game.state.servers[WELLMARK].files.find((f) => f.name === "dat.sell-20111213")!
			game.addLocalFile({ ...evidence, owner: "eve" })
			install(game, "fileforce", "3.0")
			install(game, "rootbreaker", "1.1")

			const srv = game.state.servers[CRIMEDIV]
			expect(srv.terminal).toBe("DatabaseServer")
			connect(game, CRIMEDIV)
			const file = game.state.files[game.findLocalFile("dat.sell-20111213")]
			expect(game.network.upload(file)).toContain("Nessun File Server o Database Server")
			expect(game.network.startCrack()).toBeNull()
			finish(game, "crack")
			expect(game.network.connection?.forced).toBe(true)
			expect(game.network.uploadTarget()).toBe(srv)

			expect(game.network.upload(file)).toBeNull()
			finish(game, "upload")
			expect(srv.files.find((f) => f.name === "dat.sell-20111213")?.owner).toBe("Secure")
			// Compare nell'elenco del terminale insieme ai fascicoli di Intrapol
			expect(game.network.visibleFiles().map((f) => f.name)).toContain("dat.sell-20111213")

			game.reply(mail.id)
			expect(game.state.missions.find((m) => m.def.path === MISSION)?.done).toBe(true)
			game.advance(30_000)
			expect(game.state.completed).toContain(MISSION)
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

		it("rootbreaker rifiutato su server senza login", () => {
			const game = setup()
			install(game, "rootbreaker", "1.1")
			connect(game, "547.2.8.791") // Commerce Server senza protezione
			expect(game.network.startCrack()).toContain("Nessuna interfaccia")
			expect(game.network.connection?.trace).toBeUndefined()
		})

		it("wavehacker: registra la voce al telefono e la usa sul VRLS", () => {
			const game = setup()
			connect(game, PHONE_OK)
			expect(game.network.recordVoice()).toContain("wavehacker non è nella tua memoria")
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

	describe("distruzione dei server", () => {
		const setup = () => Game.newGame(diskPack(), "eve", "eve", NOW, { random: () => 0.5 })
		const install = (game: Game, id: string, version: string) => game.addLocalFile({ name: `${id}-${version}`, dim: 2, img: -1, contents: id, owner: "eve" })
		const connect = (game: Game, ip: string) => {
			expect(game.network.connectDirect(ip)).toBeNull()
			game.advance(3_000)
			expect(game.network.host?.ip).toBe(ip)
		}
		const finish = (game: Game, kind: "crack" | "nuke") => {
			const task = game.tasks.find((t) => t.kind === kind)!
			game.advance(Math.ceil((task.total - task.elapsed) * 1000) + 250)
		}
		const exec = (game: Game, line: string) => {
			const before = game.state.console.length
			game.shell.exec(line)
			return game.state.console.slice(before + 1).join("\n")
		}
		/** Avvia la missione e restituisce la mail di inizio */
		const startMission = (game: Game, path: string, subject: string) => {
			game.missions.load(path)
			game.advance(10_000)
			const mail = game.state.mails.find((m) => m.subject === subject)
			expect(mail).toBeDefined()
			return mail!
		}

		it("nmcha-03: file sys.* eliminati e riavvio da Admin distruggono n3v3rmind.xfreeze", () => {
			const XFREEZE = "515.42.xfreeze.74" // n3v3rmind.xfreeze: File Server, Login, Admin con ranking 1120
			const MISSION = "xmiss/nmcha-03.miss"
			const game = setup()
			const mail = startMission(game, MISSION, "Avvertimento...")
			install(game, "rootbreaker", "1.1")
			connect(game, XFREEZE)
			expect(game.network.reboot()).toContain("solo all'amministratore")
			expect(game.network.startCrack()).toBeNull()
			finish(game, "crack")
			expect(game.network.isAdmin()).toBe(true)

			// Con i file di sistema al loro posto il server si riavvia e basta
			expect(game.network.reboot()).toBeNull()
			const srv = game.state.servers[XFREEZE]
			expect(game.network.connection).toBeNull()
			expect(srv.destroyed).toBeFalsy()

			game.network.addKnown(XFREEZE)
			connect(game, XFREEZE)
			expect(game.network.startCrack()).toBeNull()
			finish(game, "crack")
			for (const f of game.network.visibleFiles().filter((f) => f.name.startsWith("sys."))) expect(game.network.deleteRemoteFile(f)).toBe(true)
			expect(srv.files.some((f) => f.name.startsWith("sys."))).toBe(false)
			expect(game.network.reboot()).toBeNull()
			expect(srv.destroyed).toBe(true)
			expect(game.network.connection).toBeNull()
			expect(game.state.known).not.toContain(XFREEZE)
			expect(game.network.connectDirect(XFREEZE)).toContain("Impossibile raggiungere")

			game.reply(mail.id)
			expect(game.state.missions.find((m) => m.def.path === MISSION)?.done).toBe(true)
		})

		it("A18 dalla console: ls, rm e reboot su master.underground", () => {
			const MASTER = "master.666wearegone.0.1" // master.underground: KeyFile, nessun terminale
			const MISSION = "uground/a18.miss"
			const game = setup()
			startMission(game, MISSION, "Ci siamo!")
			game.addLocalFile({ name: "KEY.FG2GB9GD1EF2", dim: 1, img: -1, contents: "%KEY%", owner: "eve" })
			connect(game, MASTER)
			// Non ancora autenticati: ls e rm agiscono sulla flashram, reboot non ha un server su cui agire
			expect(exec(game, "ls")).toContain("KEY.FG2GB9GD1EF2")
			expect(exec(game, "rm sys.kernel")).toContain("file inesistente!")
			expect(game.network.loginWithKeyFile()).toBe(true)

			const ls = exec(game, "ls")
			expect(ls).toContain("== master.underground ==")
			expect(ls).toContain("sys.kernel")
			expect(ls).not.toContain("KEY.FG2GB9GD1EF2")
			expect(exec(game, "rm")).toContain("sintassi: rm <file>")
			expect(exec(game, "rm inesistente")).toContain("file inesistente!")
			for (const name of ["sys.kernel", "sys.system", "sys.network"]) expect(exec(game, `rm ${name}`)).toContain(`${name} eliminato.`)
			expect(exec(game, "ls")).not.toContain("sys.")

			exec(game, "reboot")
			const srv = game.state.servers[MASTER]
			expect(srv.destroyed).toBe(true)
			expect(game.network.connection).toBeNull()
			// ClusterDestruction senza mail: la missione si chiude da sola
			expect(game.state.missions.find((m) => m.def.path === MISSION)?.done).toBe(true)
		})

		it("CantBeDestroyed: il riavvio senza file di sistema non distrugge il server", () => {
			const XFREEZE = "515.42.xfreeze.74"
			const game = setup()
			const srv = game.state.servers[XFREEZE]
			srv.cantBeDestroyed = true
			connect(game, XFREEZE)
			expect(game.network.login("Admin", srv.users[0].password)).toBe(true)
			for (const f of game.network.visibleFiles().filter((f) => f.name.startsWith("sys."))) game.network.deleteRemoteFile(f)
			expect(game.network.reboot()).toBeNull()
			expect(srv.destroyed).toBeFalsy()
			expect(game.network.connection).toBeNull()
		})

		it("A06: nukelord manda fuori linea web4.telemark, con banda sufficiente lo distrugge", () => {
			const WEB4 = "10.258.26.13" // web4.telemark: Web Server, Net 200, firewall che accetta solo 10.258.1.119
			const RELAY = "10.258.1.119"
			const MISSION = "uground/a06.miss"
			const game = setup()
			const mail = startMission(game, MISSION, "Richiesta aiuto...")
			expect(game.state.known).toContain(WEB4)
			const via = () => {
				game.network.addNode(RELAY)
				connect(game, WEB4)
			}

			via()
			expect(game.network.startNuke()).toContain("nukelord non è nella tua memoria")
			install(game, "nukelord", "8")
			const srv = game.state.servers[WEB4]
			// 80 MBps meno i 40 della connessione a due nodi: non bastano contro i 200 del server
			const free = game.netFree
			expect(free).toBeLessThan(srv.net)
			expect(game.network.startNuke()).toBeNull()
			expect(game.network.startNuke()).toContain("già in corso")
			const task = game.tasks.find((t) => t.kind === "nuke")!
			expect(task.total).toBeCloseTo(nukeSeconds(srv.net, free))
			expect(game.netFree).toBe(0)
			finish(game, "nuke")
			expect(game.network.connection).toBeNull()
			expect(srv.destroyed).toBeFalsy()
			expect(srv.nukedUntil).toBeGreaterThan(game.now + (NUKE_DURATION_S - 1) * 1000)
			game.network.addNode(RELAY)
			expect(game.network.connectDirect(WEB4)).toContain("Impossibile raggiungere")
			game.network.pendingNodes = []
			game.reply(mail.id)
			expect(game.state.missions.find((m) => m.def.path === MISSION)?.done).toBeFalsy()

			// Tornato in linea, con una scheda di rete più veloce l'attacco lo disconnette per sempre
			game.advance(NUKE_DURATION_S * 1000)
			game.state.hardware.net.value = 1000
			via()
			expect(game.network.startNuke()).toBeNull()
			finish(game, "nuke")
			expect(srv.destroyed).toBe(true)
			expect(game.network.connection).toBeNull()
			expect(game.state.known).not.toContain(WEB4)

			game.reply(mail.id)
			expect(game.state.missions.find((m) => m.def.path === MISSION)?.done).toBe(true)
		})

		it("A-110-40-02: con la scheda iniziale la banda libera eguaglia quella di web.neowase, che viene distrutto", () => {
			const NEOWASE = "92.147.43.912" // web.neowase: Web Server, Net 60, nessun firewall
			const MISSION = "uground/a-110-40-02.miss"
			const game = setup()
			const mail = startMission(game, MISSION, "Sottoscrizione No. A-110-40-02")
			install(game, "nukelord", "8")
			connect(game, NEOWASE)
			const srv = game.state.servers[NEOWASE]
			// 80 MBps meno i 20 della connessione diretta
			expect(game.netFree).toBe(60)
			expect(srv.net).toBe(60)
			expect(game.network.startNuke()).toBeNull()
			finish(game, "nuke")
			expect(srv.destroyed).toBe(true)
			expect(srv.nukedUntil).toBeUndefined()
			expect(game.network.connection).toBeNull()
			expect(game.state.known).not.toContain(NEOWASE)

			game.reply(mail.id)
			expect(game.state.missions.find((m) => m.def.path === MISSION)?.done).toBe(true)
		})

		it("CantBeNuked: l'attacco viene respinto, il server resta in linea", () => {
			const NEOWASE = "92.147.43.912"
			const game = setup()
			const srv = game.state.servers[NEOWASE]
			srv.cantBeNuked = true
			install(game, "nukelord", "8")
			connect(game, NEOWASE)
			expect(game.network.startNuke()).toContain("respinto")
			expect(game.network.nuke).toBeNull()
			expect(game.tasks.some((t) => t.kind === "nuke")).toBe(false)
			game.advance(60_000)
			expect(srv.destroyed).toBeFalsy()
			expect(srv.nukedUntil).toBeUndefined()
			expect(game.network.host?.ip).toBe(NEOWASE)
		})

		it("l'account forzato e l'amministratore sono l'utente Admin, anche se un altro ha ranking più alto", () => {
			const XFREEZE = "515.42.xfreeze.74"
			const game = setup()
			const srv = game.state.servers[XFREEZE]
			srv.users.push({ ...srv.users[0], username: "Root", password: "root", ranking: 5000 })
			expect(game.network.adminOf(srv)?.username).toBe("Admin")
			install(game, "rootbreaker", "1.1")
			connect(game, XFREEZE)
			expect(game.network.startCrack()).toBeNull()
			finish(game, "crack")
			expect(game.network.connection?.logged).toBe("Admin")
			expect(game.network.isAdmin()).toBe(true)

			// Senza un utente Admin si ripiega sul ranking più alto
			game.network.logout()
			expect(game.network.login("Root", "root")).toBe(true)
			expect(game.network.isAdmin()).toBe(false)
			srv.users = srv.users.filter((u) => u.username !== "Admin")
			expect(game.network.adminOf(srv)?.username).toBe("Root")
			expect(game.network.isAdmin()).toBe(true)
		})

		it("nukelord: disconnettersi interrompe l'attacco e libera la banda", () => {
			const NEOWASE = "92.147.43.912" // web.neowase: Web Server, Net 60
			const game = setup()
			install(game, "nukelord", "8")
			connect(game, NEOWASE)
			expect(game.network.startNuke()).toBeNull()
			game.network.disconnect()
			expect(game.network.nuke).toBeNull()
			expect(game.tasks.some((t) => t.kind === "nuke")).toBe(false)
			game.advance(60_000)
			expect(game.state.servers[NEOWASE].destroyed).toBeFalsy()
			expect(game.state.servers[NEOWASE].nukedUntil).toBeUndefined()
		})
	})

	describe("cluster della campagna Underground", () => {
		// Personal Server con 1000 MBps (pstagna.nonameservers ne ha 100, chang.ironkingdom non ha file di sistema)
		const PERSONAL = ["111.158.354.111", "172.23.24.125", "199.112.112.172", "386.456.3.45", "489.456.486.351"]
		const MASTER = "master.666wearegone.0.1" // master.underground: KeyFile, Net 1000000, Admin con ranking 4000
		/** Secondi che il giocatore impiega a scrivere e lanciare un comando in console */
		const COMMAND_S = 15

		const setup = () => Game.newGame(diskPack(), "eve", "eve", NOW, { random: () => 0.5 })
		const install = (game: Game, id: string, version: string) => game.addLocalFile({ name: `${id}-${version}`, dim: 2, img: -1, contents: id, owner: "eve" })
		const connect = (game: Game, ip: string) => {
			expect(game.network.connectDirect(ip)).toBeNull()
			game.advance(3_000)
			expect(game.network.host?.ip).toBe(ip)
		}
		const finish = (game: Game, kind: "crack" | "upload") => {
			const task = game.tasks.find((t) => t.kind === kind)!
			game.advance(Math.ceil((task.total - task.elapsed) * 1000) + 250)
		}
		const exec = (game: Game, line: string) => {
			const before = game.state.console.length
			game.shell.exec(line)
			return game.state.console.slice(before + 1).join("\n")
		}
		const core = (game: Game) => game.state.files[game.findLocalFile("exe.clustercore")]
		const connFiles = (game: Game) => game.state.files.filter((f) => f.name.startsWith("log.clientconn")).map((f) => f.name)
		/** Login con la password dell'account Admin: nessuna traccia nei log */
		const adminLogin = (game: Game, ip: string) => {
			connect(game, ip)
			const admin = game.state.servers[ip].users.find((u) => u.username === "Admin")!
			expect(game.network.login(admin.username, admin.password)).toBe(true)
		}
		/** Forza il Personal Server, ci carica la backdoor e cancella log.connections per non lasciare tracce */
		const plantBackdoor = (game: Game, ip: string) => {
			connect(game, ip)
			expect(game.network.startCrack()).toBeNull()
			finish(game, "crack")
			expect(game.network.upload(core(game))).toBeNull()
			finish(game, "upload")
			const log = game.network.visibleFiles().find((f) => f.name === "log.connections")!
			expect(game.network.deleteRemoteFile(log)).toBe(true)
			game.network.disconnect()
		}
		/** A17 fino all'arrivo della mail, con rootbreaker e fileforce in flashram */
		const startA17 = (game: Game) => {
			game.missions.load("uground/a17.miss")
			game.advance(10_000)
			const mail = game.state.mails.find((m) => m.subject === "Ci sono novità!")!
			expect(mail).toBeDefined()
			install(game, "rootbreaker", "1.1")
			install(game, "fileforce", "3.0")
			return mail
		}

		it("A17: exe.clustercore su 5 Personal Server, file di connessione e banda del cluster", () => {
			const game = setup()
			const mail = startA17(game)
			expect(core(game)).toBeDefined()
			expect(game.findLocalFile("KEY.FG2GB9GD1EF2")).toBeGreaterThanOrEqual(0)

			for (const ip of PERSONAL.slice(0, 4)) plantBackdoor(game, ip)
			expect(game.state.cluster).toEqual(PERSONAL.slice(0, 4))
			// Quattro nodi non bastano
			game.reply(mail.id)
			expect(game.state.missions.find((m) => m.def.path === "uground/a17.miss")?.done).toBeFalsy()

			plantBackdoor(game, PERSONAL[4])
			expect(game.state.cluster).toEqual(PERSONAL)
			expect(connFiles(game)).toEqual(["log.clientconn1", "log.clientconn2", "log.clientconn3", "log.clientconn4", "log.clientconn5"])
			expect(game.state.files[game.findLocalFile("log.clientconn3")].contents).toContain(`[${PERSONAL[2]}]`)
			expect(game.network.clusterBandwidth()).toBe(5000)
			expect(game.netTotal).toBe(80 + 5000)
			// Nessun sequestro: le tracce sono state cancellate con i log
			game.advance(CRIME_NOTIFICATION_S * 1000 + 1_000)
			expect(game.state.cluster).toHaveLength(5)

			game.reply(mail.id)
			expect(game.state.missions.find((m) => m.def.path === "uground/a17.miss")?.done).toBe(true)
			game.advance(30_000)
			expect(game.state.completed).toContain("uground/a17.miss")
			expect(game.state.missions.some((m) => m.def.path === "uground/a18.miss")).toBe(true)
		})

		it("un nodo esce dal cluster: backdoor eliminata, sequestro e ripristino, distruzione", () => {
			const game = setup()
			startA17(game)
			const [A, B, C] = PERSONAL
			for (const ip of [A, B, C]) plantBackdoor(game, ip)
			expect(game.state.cluster).toEqual([A, B, C])

			// Backdoor eliminata (dagli script: è un file %SYSTEM%, il giocatore non può cancellarla)
			adminLogin(game, A)
			const backdoor = game.network.visibleFiles().find((f) => f.name === "exe.clustercore")!
			expect(game.network.deleteRemoteFile(backdoor)).toBe(false)
			expect(game.network.deleteRemoteFile(backdoor, true)).toBe(true)
			expect(game.state.cluster).toEqual([B, C])
			expect(connFiles(game)).toEqual(["log.clientconn2", "log.clientconn3"])
			// Ricaricata, riprende il primo numero di connessione libero
			expect(game.network.upload(core(game))).toBeNull()
			finish(game, "upload")
			expect(game.state.cluster).toEqual([B, C, A])
			expect(game.state.files[game.findLocalFile("log.clientconn1")].contents).toContain(`[${A}]`)
			game.network.disconnect()

			// Sequestro: forzato senza cancellare i log, Intrapol notifica il reato
			connect(game, B)
			expect(game.network.startCrack()).toBeNull()
			finish(game, "crack")
			game.network.disconnect()
			game.advance(CRIME_NOTIFICATION_S * 1000 + 1_000)
			expect(game.state.servers[B].seizedUntil).toBeDefined()
			expect(game.state.cluster).toEqual([C, A])
			expect(connFiles(game)).not.toContain("log.clientconn2")
			// Il ripristino cancella la backdoor: il server non rientra
			game.advance(SERVER_REFRESH_S * 1000 + 1_000)
			expect(game.state.servers[B].seizedUntil).toBeUndefined()
			expect(game.state.servers[B].files.some((f) => f.name === "exe.clustercore")).toBe(false)
			expect(game.state.cluster).toEqual([C, A])

			// Distruzione: file di sistema eliminati e riavvio
			adminLogin(game, C)
			for (const name of ["sys.kernel", "sys.system", "sys.network"]) exec(game, `rm ${name}`)
			exec(game, "reboot")
			expect(game.state.servers[C].destroyed).toBe(true)
			expect(game.state.cluster).toEqual([A])
			expect(connFiles(game)).toEqual(["log.clientconn1"])
			expect(game.network.clusterBandwidth()).toBe(1000)
		})

		it("A18 con il cluster: il backtrace dà il tempo di distruggere master.underground, poi A19 scioglie il cluster", () => {
			const game = setup()
			const mail = startA17(game)
			for (const ip of PERSONAL) plantBackdoor(game, ip)
			game.reply(mail.id)
			game.advance(30_000)
			expect(game.state.missions.some((m) => m.def.path === "uground/a18.miss")).toBe(true)

			connect(game, MASTER)
			expect(game.network.connection!.trace).toBeUndefined()
			expect(game.network.loginWithKeyFile()).toBe(true)
			// Il dump della chiave fa partire subito il backtrace; i 5 nodi lo rallentano
			const srv = game.state.servers[MASTER]
			const trace = game.network.connection!.trace!
			expect(trace.total).toBeCloseTo(traceSeconds(srv.net, 4000, 1, 5))
			expect(trace.total).toBeGreaterThan(4 * COMMAND_S)
			expect(game.network.connection!.forced).toBe(true)

			for (const cmd of ["rm sys.kernel", "rm sys.system", "rm sys.network", "reboot"]) {
				game.advance(COMMAND_S * 1000)
				expect(game.network.connection).not.toBeNull()
				exec(game, cmd)
			}
			expect(srv.destroyed).toBe(true)
			expect(game.state.missions.find((m) => m.def.path === "uground/a18.miss")?.done).toBe(true)

			// A19: lo script iniziale cancella file di connessione, exe.clustercore e chiave
			game.advance(30_000)
			expect(game.state.missions.some((m) => m.def.path === "uground/a19.miss")).toBe(true)
			expect(connFiles(game)).toEqual([])
			expect(game.findLocalFile("exe.clustercore")).toBe(-1)
			expect(game.findLocalFile("KEY.FG2GB9GD1EF2")).toBe(-1)
			expect(game.state.cluster).toEqual([])
			expect(game.netTotal).toBe(80)
		})

		it("A18 senza cluster: il backtrace arriva prima del riavvio", () => {
			const game = setup()
			game.missions.load("uground/a18.miss")
			game.advance(10_000)
			game.addLocalFile({ name: "KEY.FG2GB9GD1EF2", dim: 1, img: -1, contents: "%SYSTEM%", owner: "eve" })
			const traced: string[] = []
			game.onEvent((e) => e.type === "traced" && traced.push(e.ip))
			connect(game, MASTER)
			expect(game.network.loginWithKeyFile()).toBe(true)
			const srv = game.state.servers[MASTER]
			const trace = game.network.connection!.trace!
			expect(trace.total).toBeCloseTo(traceSeconds(srv.net, 4000, 1, 0))
			expect(trace.total).toBeLessThan(4 * COMMAND_S)

			const ranking = game.state.ranking
			const done: string[] = []
			for (const cmd of ["rm sys.kernel", "rm sys.system", "rm sys.network", "reboot"]) {
				game.advance(COMMAND_S * 1000)
				if (!game.network.connection) break
				exec(game, cmd)
				done.push(cmd)
			}
			expect(done).not.toContain("reboot")
			expect(traced).toEqual([MASTER])
			expect(game.network.connection).toBeNull()
			expect(srv.destroyed).toBeFalsy()
			expect(game.state.ranking).toBe(ranking - crimePenalty(4000, true).ranking)
			expect(game.state.missions.find((m) => m.def.path === "uground/a18.miss")?.done).toBeFalsy()
		})
	})

	describe("Netbanking", () => {
		const BANK = "721.564.892.743" // eurodigibank.eurogroup: Login, 7 utenti, 4 conti, Net 50000
		const setup = () => Game.newGame(diskPack(), "eve", "eve", NOW, { random: () => 0.5 })
		/** Connessione e login con le credenziali di un correntista */
		const login = (game: Game, user: string, password: string) => {
			expect(game.network.connectDirect(BANK)).toBeNull()
			game.advance(3_000)
			expect(game.network.host?.ip).toBe(BANK)
			expect(game.network.login(user, password)).toBe(true)
		}

		it("trasferimento entro il limite: saldo scalato, crediti accreditati, nessun backtrace", () => {
			const game = setup()
			login(game, "marcaz", "sunshine")
			// Utente senza conto
			expect(game.network.bankAccount()).toBeUndefined()
			expect(game.network.transfer(10)).toContain("Nessun conto")

			login(game, "Kelly", "LOVE")
			const account = game.network.bankAccount()!
			expect(account).toMatchObject({ name: "Kelly Lord", dim: 1713, img: 15, owner: "Kelly" })
			// Ogni utente vede solo il proprio conto
			expect(game.network.visibleFiles()).toEqual([account])
			expect(game.network.transferLimit(account)).toBe(15)
			expect(game.network.transfer(0)).toContain("non valido")
			expect(game.network.transfer(2.5)).toContain("non valido")
			expect(game.network.transfer(2000)).toContain("Saldo insufficiente")

			expect(game.network.transfer(15)).toBeNull()
			expect(account.dim).toBe(1698)
			expect(game.state.servers[BANK].files.find((f) => f.owner === "Kelly")!.dim).toBe(1698)
			expect(game.state.credits).toBe(60 + 15)
			expect(game.network.connection!.trace).toBeUndefined()
			game.advance(120_000)
			expect(game.network.connection?.logged).toBe("Kelly")
			expect(game.state.credits).toBe(75)
		})

		it("trasferimento oltre il limite: il backtrace parte subito e, se si resta connessi, si viene presi", () => {
			const game = setup()
			const traced: string[] = []
			game.onEvent((e) => e.type === "traced" && traced.push(e.ip))
			login(game, "JJkarl", "icntrst")
			const account = game.network.bankAccount()!
			expect(game.network.transferLimit(account)).toBe(45)
			expect(game.network.transfer(1000)).toBeNull()
			expect(account.dim).toBe(357400 - 1000)
			expect(game.state.credits).toBe(60 + 1000)
			const srv = game.state.servers[BANK]
			const trace = game.network.connection!.trace!
			expect(trace.total).toBeCloseTo(traceSeconds(srv.net, 100, 1, 0))

			game.advance(Math.ceil(trace.total * 1000) + 250)
			expect(traced).toEqual([BANK])
			expect(game.network.connection).toBeNull()
			const penalty = crimePenalty(100, true)
			expect(game.state.credits).toBe(60 + 1000 - penalty.credits)
			// Nessuna violazione del sistema: niente sequestro
			expect(srv.seizedUntil).toBeUndefined()

			// Disconnettendosi in tempo si sfugge al backtrace
			login(game, "JJkarl", "icntrst")
			expect(game.network.transfer(500)).toBeNull()
			expect(game.network.connection!.trace).toBeDefined()
			game.network.disconnect()
			const credits = game.state.credits
			game.advance(CRIME_NOTIFICATION_S * 1000 + 1_000)
			expect(game.state.credits).toBe(credits)
		})

		it("ogni trasferimento abbassa il karma: Cracker e poi Master Cracker", () => {
			const game = setup()
			login(game, "pstagna", "ale42y7e")
			expect(game.userClass).toBe("Lamer")
			expect(game.network.transfer(10)).toBeNull()
			expect(game.state.karma).toBe(-NETBANKING_KARMA_PENALTY)
			const toCracker = Math.ceil(50 / NETBANKING_KARMA_PENALTY)
			for (let i = 1; i < toCracker; i++) expect(game.network.transfer(10)).toBeNull()
			expect(game.state.karma).toBe(-toCracker * NETBANKING_KARMA_PENALTY)
			expect(game.userClass).toBe("Cracker")
			const toMaster = Math.ceil(150 / NETBANKING_KARMA_PENALTY)
			for (let i = toCracker; i < toMaster; i++) expect(game.network.transfer(10)).toBeNull()
			expect(game.userClass).toBe("Master Cracker")
			// I trasferimenti rifiutati non toccano il karma
			const karma = game.state.karma
			expect(game.network.transfer(999_999)).toContain("Saldo insufficiente")
			expect(game.state.karma).toBe(karma)
		})
	})

	describe("missioni casuali (MissGen)", () => {
		const KARMA = "666.underground.0.3" // karma.underground: MissGenFaction underground
		const ALTPROJECT = "911.intrapol.1.1" // altproject.intrapolru: MissGenFaction intrapol
		// File Server con AllowRandomMission=true, Login e Admin con ranking 450
		const TARGETS = ["10.258.291.13", "115.898.2.115", "432.561.9.132", "799.15.232.232", "837.762.1.252"]
		const setup = () => Game.newGame(diskPack(), "eve", "eve", NOW, { random: () => 0.5 })
		// Con random() = 0.5 l'intervallo tra due offerte è esattamente MISSGEN_INTERVAL_S
		const INTERVAL_MS = MISSGEN_INTERVAL_S * 1000
		const advance = (game: Game, ms: number) => game.advance(ms, 1000)

		it("generazione nel tempo: un'offerta per Subscription Server con fazione", () => {
			const game = setup()
			expect(game.missgen.generators().map((s) => s.ip).sort()).toEqual([KARMA, ALTPROJECT].sort())
			expect(game.missgen.targets().map((s) => s.ip).sort()).toEqual([...TARGETS].sort())
			advance(game, INTERVAL_MS - 2_000)
			expect(game.missgen.offers).toEqual([])
			advance(game, 3_000)
			expect(game.missgen.offersOf(KARMA)).toHaveLength(1)
			expect(game.missgen.offersOf(ALTPROJECT)).toHaveLength(1)

			const offer = game.missgen.offersOf(KARMA)[0]
			const d = offer.def
			expect(offer.faction).toBe("underground")
			expect(TARGETS).toContain(offer.target)
			expect(d.refServerIP).toBe(offer.target)
			expect(["FileDeleting", "FileUploading"]).toContain(d.type)
			expect(d.type === "FileDeleting" ? d.refRemoteFileToDelete : d.refRemoteFileUploaded).toBe(offer.file.name)
			// Proporzionati al ranking 450 dell'Admin del bersaglio (variazione nulla con random() = 0.5)
			expect(d.credits).toBe(Math.round(450 * 0.25))
			expect(d.extraRanking).toBe(Math.round(450 * 0.04))
			expect(offer.minRanking).toBe(225)
			// Generata negli ultimi 3 secondi: scade MISSGEN_LIFETIME_S dopo
			expect(offer.expiresAt - game.now).toBeGreaterThan(MISSGEN_LIFETIME_S * 1000 - 3_000)
			expect(offer.expiresAt - game.now).toBeLessThanOrEqual(MISSGEN_LIFETIME_S * 1000)
			expect(d.begin).toHaveLength(1)
			expect(d.begin[0].from).toBe(`${offer.id}@underground`)
			expect(d.begin[0].body).toContain(offer.file.name)
			expect(d.targetMailFrom).toBe(d.begin[0].from)
			expect(d.targetMailSubject).toBe(d.begin[0].subject)
			expect(d.end).toHaveLength(1)
			expect(game.missgen.offersOf(ALTPROJECT)[0].def.begin[0].from).toMatch(/@intrapol$/)
			// Nessun file .miss: la missione non è nei contenuti
			expect(game.content.missions.has(d.path)).toBe(false)
			// Solo offerte: nessuna missione avviata, nessuna mail
			expect(game.state.missions.some((m) => m.def.path.startsWith("missgen/"))).toBe(false)
			expect(game.state.mails.some((m) => m.subject === d.begin[0].subject)).toBe(false)
		})

		it("al massimo MISSGEN_MAX_OFFERS offerte per server", () => {
			const game = setup()
			advance(game, INTERVAL_MS * MISSGEN_MAX_OFFERS + 1_000)
			expect(game.missgen.offersOf(KARMA)).toHaveLength(MISSGEN_MAX_OFFERS)
			advance(game, INTERVAL_MS * 2)
			expect(game.missgen.offersOf(KARMA)).toHaveLength(MISSGEN_MAX_OFFERS)
			expect(game.missgen.offersOf(ALTPROJECT)).toHaveLength(MISSGEN_MAX_OFFERS)
			const ids = game.missgen.offers.map((o) => o.id)
			expect(new Set(ids).size).toBe(ids.length)
		})

		it("le offerte non accettate spariscono alla scadenza", () => {
			const game = setup()
			advance(game, INTERVAL_MS + 1_000)
			const first = game.missgen.offersOf(KARMA)[0]
			advance(game, first.expiresAt - game.now - 2_000)
			expect(game.missgen.offers.map((o) => o.id)).toContain(first.id)
			advance(game, 3_000)
			expect(game.missgen.offers.map((o) => o.id)).not.toContain(first.id)
			// Il posto liberato viene occupato dalla generazione successiva
			advance(game, INTERVAL_MS)
			expect(game.missgen.offersOf(KARMA)).toHaveLength(MISSGEN_MAX_OFFERS)
		})

		it("salvataggio e caricamento: offerte e prossima generazione restano", () => {
			const game = setup()
			advance(game, INTERVAL_MS + 1_000)
			const saved = JSON.parse(JSON.stringify(game.state))
			const loaded = Game.load(diskPack(), saved, { random: () => 0.5 })
			expect(loaded.missgen.offers).toEqual(game.missgen.offers)
			expect(loaded.missgen.state.nextAt).toEqual(game.missgen.state.nextAt)
			// La generazione riprende da dove era rimasta, con la numerazione che continua
			advance(loaded, INTERVAL_MS)
			expect(loaded.missgen.offersOf(KARMA)).toHaveLength(2)
			expect(loaded.missgen.offers.map((o) => o.id)).toEqual(["R-0001", "R-0002", "R-0003", "R-0004"])

			// Partita salvata prima di MissGen: lo stato riparte vuoto
			const old = JSON.parse(JSON.stringify(game.state))
			delete old.missgen
			const legacy = Game.load(diskPack(), old, { random: () => 0.5 })
			expect(legacy.missgen.offers).toEqual([])
			advance(legacy, INTERVAL_MS + 1_000)
			expect(legacy.missgen.offersOf(KARMA)).toHaveLength(1)
		})

		// --- accettazione e completamento ---

		/** Offerta del tipo dato su karma.underground, con il ranking che basta ad accettarla */
		const offerOf = (game: Game, type: "FileDeleting" | "FileUploading") => {
			const offer = game.missgen.generate(game.state.servers[KARMA], type)!
			expect(offer.def.type).toBe(type)
			game.state.ranking = offer.minRanking
			return offer
		}
		const activeOf = (game: Game, path: string) => game.state.missions.find((m) => m.def.path === path)
		/** Mail di inizio della missione accettata (arriva dopo qualche secondo) */
		const beginMail = (game: Game, subject: string) => {
			advance(game, 10_000)
			const mail = game.state.mails.find((m) => m.subject === subject && !m.sent)
			expect(mail).toBeDefined()
			return mail!
		}
		/** Login sul bersaglio con la password dell'Admin (nessuna traccia nei log) */
		const loginTarget = (game: Game, ip: string) => {
			expect(game.network.connectDirect(ip)).toBeNull()
			advance(game, 3_000)
			expect(game.network.host?.ip).toBe(ip)
			const admin = game.state.servers[ip].users.find((u) => u.username === "Admin")!
			expect(game.network.login(admin.username, admin.password)).toBe(true)
		}

		it("accettazione rifiutata: ranking insufficiente, offerta inesistente o scaduta", () => {
			const game = setup()
			const offer = game.missgen.generate(game.state.servers[KARMA], "FileDeleting")!
			expect(game.state.ranking).toBeLessThan(offer.minRanking)
			expect(game.missgen.accept(offer.id)).toContain("Ranking insufficiente")
			expect(game.missgen.accept("R-9999")).toContain("non disponibile")
			game.state.ranking = offer.minRanking
			offer.expiresAt = game.now
			expect(game.missgen.accept(offer.id)).toContain("scaduta")
			// Nessun effetto: l'offerta non è stata accettata
			expect(activeOf(game, offer.def.path)).toBeUndefined()
			expect(game.state.servers[offer.target].files.some((f) => f.name === offer.file.name)).toBe(false)
		})

		it("accettazione riuscita: missione avviata e file posizionato", () => {
			const game = setup()
			const del = offerOf(game, "FileDeleting")
			expect(game.missgen.accept(del.id)).toBeNull()
			expect(game.missgen.offers).not.toContain(del)
			const m = activeOf(game, del.def.path)!
			expect(m).toMatchObject({ subscription: true, expiresAt: del.expiresAt })
			// FileDeleting: il file da eliminare compare sul bersaglio, dell'Admin
			expect(game.state.servers[del.target].files.find((f) => f.name === del.file.name)?.owner).toBe("Admin")
			expect(game.findLocalFile(del.file.name)).toBe(-1)
			expect(game.missgen.accept(del.id)).toContain("non disponibile")

			// FileUploading: il file da caricare finisce in flashram
			const up = offerOf(game, "FileUploading")
			expect(game.missgen.accept(up.id)).toBeNull()
			expect(game.state.files[game.findLocalFile(up.file.name)].owner).toBe("eve")
			expect(game.state.servers[up.target].files.some((f) => f.name === up.file.name)).toBe(false)
			beginMail(game, del.def.begin[0].subject)
			beginMail(game, up.def.begin[0].subject)
		})

		it("completamento di una FileDeleting rispondendo alla mail", () => {
			const game = setup()
			const offer = offerOf(game, "FileDeleting")
			expect(game.missgen.accept(offer.id)).toBeNull()
			const mail = beginMail(game, offer.def.begin[0].subject)
			// Rispondere prima di aver eliminato il file non basta
			game.reply(mail.id)
			expect(activeOf(game, offer.def.path)?.done).toBeFalsy()

			loginTarget(game, offer.target)
			const file = game.network.visibleFiles().find((f) => f.name === offer.file.name)!
			expect(game.network.deleteRemoteFile(file)).toBe(true)
			const { credits, ranking } = game.state
			game.reply(mail.id)
			expect(activeOf(game, offer.def.path)?.done).toBe(true)
			expect(game.state.credits).toBe(credits + offer.def.credits)
			expect(game.state.ranking).toBe(ranking + offer.def.extraRanking)
			advance(game, 30_000)
			expect(game.state.completed).toContain(offer.def.path)
			expect(activeOf(game, offer.def.path)).toBeUndefined()
			expect(game.state.mails.some((m) => m.subject === "Sottoscrizione completata!" && m.from === offer.def.targetMailFrom)).toBe(true)
		})

		it("completamento di una FileUploading rispondendo alla mail", () => {
			const game = setup()
			const offer = offerOf(game, "FileUploading")
			expect(game.missgen.accept(offer.id)).toBeNull()
			const mail = beginMail(game, offer.def.begin[0].subject)
			game.addLocalFile({ name: "fileforce-3.0", dim: 2, img: -1, contents: "fileforce", owner: "eve" })
			loginTarget(game, offer.target)
			expect(game.network.upload(game.state.files[game.findLocalFile(offer.file.name)])).toBeNull()
			const task = game.tasks.find((t) => t.kind === "upload")!
			advance(game, Math.ceil(task.total * 1000) + 1_000)
			expect(game.state.servers[offer.target].files.some((f) => f.name === offer.file.name)).toBe(true)

			const { credits, ranking } = game.state
			game.reply(mail.id)
			expect(game.state.credits).toBe(credits + offer.def.credits)
			expect(game.state.ranking).toBe(ranking + offer.def.extraRanking)
			advance(game, 30_000)
			expect(game.state.completed).toContain(offer.def.path)
		})

		it("missione accettata e non completata: ritirata alla scadenza con una mail, il file in flashram resta", () => {
			const game = setup()
			const offer = offerOf(game, "FileUploading")
			expect(game.missgen.accept(offer.id)).toBeNull()
			const mail = beginMail(game, offer.def.begin[0].subject)
			advance(game, offer.expiresAt - game.now - 2_000)
			expect(activeOf(game, offer.def.path)).toBeDefined()
			advance(game, 3_000)
			expect(activeOf(game, offer.def.path)).toBeUndefined()
			expect(game.state.completed).not.toContain(offer.def.path)
			const notice = game.state.mails.find((m) => m.subject === "Sottoscrizione scaduta")!
			expect(notice.from).toBe(offer.def.targetMailFrom)
			expect(notice.body).toContain(offer.id)
			expect(game.findLocalFile(offer.file.name)).toBeGreaterThanOrEqual(0)
			// Rispondere ora non dà più nulla
			const credits = game.state.credits
			game.reply(mail.id)
			expect(game.state.credits).toBe(credits)
		})

		it("tempo residuo: formato e comando console missions", () => {
			expect(formatRemaining(0)).toBe("0:00")
			expect(formatRemaining(-5_000)).toBe("0:00")
			expect(formatRemaining(61_000)).toBe("1:01")
			expect(formatRemaining(599_500)).toBe("10:00")
			expect(formatRemaining(3_600_000)).toBe("1:00:00")
			expect(formatRemaining(3_725_000)).toBe("1:02:05")

			const game = setup()
			const offer = offerOf(game, "FileDeleting")
			expect(game.missgen.objective(offer)).toContain(offer.file.name)
			expect(game.missgen.accept(offer.id)).toBeNull()
			const missions = () => {
				const before = game.state.console.length
				game.shell.exec("missions")
				return game.state.console.slice(before + 1).join("\n")
			}
			expect(missions()).toContain(`${offer.def.name} [scade tra ${formatRemaining(offer.expiresAt - game.now)}]`)
			advance(game, 600_000)
			expect(missions()).toContain(`[scade tra ${formatRemaining(offer.expiresAt - game.now)}]`)
			// Le missioni dei file .miss non hanno scadenza
			expect(missions()).not.toMatch(/^ {4}(?!R-).*\[scade tra/m)
		})

		it("salvataggio e caricamento con una missione casuale in corso", () => {
			const game = setup()
			const offer = offerOf(game, "FileDeleting")
			expect(game.missgen.accept(offer.id)).toBeNull()
			const mail = beginMail(game, offer.def.begin[0].subject)

			const loaded = Game.load(diskPack(), JSON.parse(JSON.stringify(game.state)), { random: () => 0.5 })
			const m = activeOf(loaded, offer.def.path)!
			expect(m.def).toEqual(offer.def)
			expect(m.expiresAt).toBe(offer.expiresAt)
			expect(m.subscription).toBe(true)
			expect(loaded.state.servers[offer.target].files.some((f) => f.name === offer.file.name)).toBe(true)

			// La missione si completa anche dopo il caricamento
			loginTarget(loaded, offer.target)
			const file = loaded.network.visibleFiles().find((f) => f.name === offer.file.name)!
			expect(loaded.network.deleteRemoteFile(file)).toBe(true)
			const credits = loaded.state.credits
			loaded.reply(mail.id)
			expect(loaded.state.credits).toBe(credits + offer.def.credits)
			advance(loaded, 30_000)
			expect(loaded.state.completed).toContain(offer.def.path)

			// E la scadenza vale anche dopo il caricamento
			const other = offerOf(game, "FileUploading")
			expect(game.missgen.accept(other.id)).toBeNull()
			const reloaded = Game.load(diskPack(), JSON.parse(JSON.stringify(game.state)), { random: () => 0.5 })
			advance(reloaded, other.expiresAt - reloaded.now + 1_000)
			expect(activeOf(reloaded, other.def.path)).toBeUndefined()
			expect(reloaded.state.mails.some((x) => x.subject === "Sottoscrizione scaduta" && x.from === other.def.targetMailFrom)).toBe(true)
		})
	})
})
