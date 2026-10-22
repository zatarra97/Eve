// Script di Mother (Scripting HOW-TO §1.3): file .script in GML eseguiti ciclicamente.
// 'Delay' imposta i secondi tra un ciclo e l'altro (predefinito 5; 0 = una volta sola,
// ma il processo resta attivo); ExitScript() termina il processo.

import { run } from "./gml/interpreter"
import { GmlRecord, parseCached, recordEnv } from "./gml/record"
import type { Program } from "./gml/parser"
import type { Game } from "./game"

const DEFAULT_DELAY_S = 5

interface ScriptProcess {
	name: string
	program: Program
	vars: GmlRecord
	/** Secondi al prossimo ciclo; null = non va più ripetuto */
	wait: number | null
}

export class Scripts {
	private game: Game
	processes: ScriptProcess[] = []

	constructor(game: Game) {
		this.game = game
	}

	private source(name: string): string | undefined {
		const n = name.toLowerCase()
		const scripts = this.game.content.scripts
		return scripts.get(n) ?? scripts.get(n.endsWith(".script") ? n : n + ".script")
	}

	/** runscript / LoadScriptObject */
	start(name: string): string | null {
		const src = this.source(name)
		if (!src) return `Script non trovato: ${name}`
		const file = name.toLowerCase().endsWith(".script") ? name : name + ".script"
		if (this.processes.some((p) => p.name.toLowerCase() === file.toLowerCase())) return `Lo script ${file} è già in esecuzione.`
		let program: Program
		try {
			program = parseCached(src)
		} catch (e) {
			return `Errore nello script ${file}: ${(e as Error).message}`
		}
		const proc: ScriptProcess = { name: file, program, vars: new GmlRecord(), wait: 0 }
		this.processes.push(proc)
		this.cycle(proc)
		this.game.changed()
		return null
	}

	/** killscript */
	kill(name: string): boolean {
		const n = name.toLowerCase().replace(/\.script$/, "")
		const before = this.processes.length
		this.processes = this.processes.filter((p) => p.name.toLowerCase().replace(/\.script$/, "") !== n)
		this.game.changed()
		return this.processes.length < before
	}

	list(): string[] {
		return this.processes.map((p) => p.name)
	}

	private cycle(proc: ScriptProcess) {
		const opts = this.game.runtime.envOptions()
		let exited = false
		try {
			// run() restituisce il valore di exit/ExitScript; distinguiamo l'uscita guardando il flag
			const env = recordEnv(proc.vars, {
				...opts,
				call: (name, args, line) => {
					if (name.toLowerCase() === "exitscript") {
						exited = true
					}
					return opts.call?.(name, args, line)
				},
			})
			run(proc.program, env)
		} catch (e) {
			this.game.log(`Errore nello script ${proc.name}: ${(e as Error).message}`)
			exited = true
		}
		if (exited) {
			this.processes = this.processes.filter((p) => p !== proc)
			return
		}
		const delay = proc.vars.get("Delay")
		const seconds = delay === undefined ? DEFAULT_DELAY_S : Number(delay)
		proc.wait = seconds > 0 ? seconds : null
	}

	tick(dt: number) {
		for (const proc of [...this.processes]) {
			if (proc.wait === null) continue
			proc.wait -= dt / 1000
			if (proc.wait <= 0) this.cycle(proc)
		}
	}

	/** autoexec.console (comandi) e autoexec.script (funzioni) all'ingresso nel desktop */
	runAutoexec() {
		const g = this.game
		const batch = g.content.autoexecConsole
		if (batch) for (const line of batch.split("\n")) if (line.trim()) g.shell.exec(line.trim())
		const script = g.content.autoexecScript
		if (script) {
			try {
				run(parseCached(script), recordEnv(new GmlRecord(), g.runtime.envOptions()))
			} catch (e) {
				g.log(`Errore in autoexec.script: ${(e as Error).message}`)
			}
		}
	}
}
