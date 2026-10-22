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
})
