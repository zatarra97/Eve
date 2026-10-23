import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"
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
})
