// Virus del gioco (Manuale §2.13): effetti sul sistema simulato del giocatore.

import type { Game } from "./game"

export const VIRUSES = ["virPitagora", "virLupinVI", "virScreenHacker", "virMotherBreaker", "virMotherXucker"] as const
export type VirusId = (typeof VIRUSES)[number]

export function isVirus(id: string): id is VirusId {
	return (VIRUSES as readonly string[]).some((v) => v.toLowerCase() === id.toLowerCase())
}

export class Viruses {
	private game: Game
	private lupinTimer = 0

	constructor(game: Game) {
		this.game = game
	}

	get active(): string[] {
		return this.game.state.viruses
	}

	has(id: VirusId) {
		return this.active.some((v) => v.toLowerCase() === id.toLowerCase())
	}

	infect(id: string) {
		const v = (VIRUSES as readonly string[]).find((x) => x.toLowerCase() === id.toLowerCase())
		if (!v || this.has(v as VirusId)) return
		this.active.push(v)
		this.game.debug(`Infezione: ${v}`)
		this.game.changed()
	}

	/** Pulizia con UAVsys: rimuove tutti i virus tranne MotherBreaker, che danneggia il sistema */
	clean(): string[] {
		const removed = this.active.filter((v) => v !== "virMotherBreaker")
		this.game.state.viruses = this.active.filter((v) => v === "virMotherBreaker")
		this.game.changed()
		return removed
	}

	/** La Network Map non si apre (si può ancora usare connect da console) */
	netmapBlocked() {
		return this.has("virMotherBreaker") || this.has("virMotherXucker")
	}

	/** Banda occupata dai virus (MBps) */
	netLoad(): number {
		const total = this.game.state.hardware.net.value
		if (this.has("virMotherBreaker")) return total
		return this.has("virPitagora") ? total * 0.6 : 0
	}

	cpuLoad(): number {
		const cpu = this.game.state.hardware.cpu.value
		return (this.has("virScreenHacker") ? cpu * 0.15 : 0) + (this.has("virPitagora") ? cpu * 0.05 : 0)
	}

	tick(dt: number) {
		if (!this.has("virLupinVI")) return
		// LupinVI: piccoli prelievi a intervalli casuali, mai oltre i 5 minuti
		this.lupinTimer -= dt / 1000
		if (this.lupinTimer <= 0) {
			this.lupinTimer = 30 + this.game.random() * 270
			const amount = Math.round(this.game.random() * 200) / 100
			this.game.state.credits = Math.round((this.game.state.credits - amount) * 100) / 100
			this.game.changed()
		}
	}
}
