// Console di Mother: interprete dei comandi testuali.
// TODO: aggiungere i comandi di gioco (vedi docs/riferimento-originale.md, sezione Console).

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
}
