// Consigli del mentore al momento giusto: ognuno compare una sola volta per partita, la prima
// volta che il giocatore incontra il meccanismo che spiega (vedi src/content/tips.ts).

import { TIPS, type TipId } from "../content/tips"
import type { Game } from "./game"

export class Tips {
	private game: Game
	/** Classe e ranking all'ultimo controllo: salire di classe merita un consiglio */
	private lastClass: string
	private lastRanking: number

	constructor(game: Game) {
		this.game = game
		this.lastClass = game.userClass
		this.lastRanking = game.state.ranking
	}

	/** Consigli già mostrati; assente nei salvataggi più vecchi */
	get seen(): string[] {
		return (this.game.state.tipsSeen ??= [])
	}

	/** Mostra il consiglio se non è già stato dato; vars riempie i segnaposto ({class}) */
	show(id: TipId, vars: Record<string, string> = {}) {
		if (this.seen.includes(id)) return
		this.seen.push(id)
		const text = TIPS[id].replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "")
		this.game.learnFrom(text)
		this.game.emit({ type: "tip", id, text })
	}

	tick() {
		const g = this.game
		const cls = g.userClass
		// Solo salendo di ranking: la classe da cracker (karma) o una penalità non sono un traguardo
		if (cls !== this.lastClass && g.state.ranking > this.lastRanking && !cls.includes("Cracker")) this.show("class", { class: cls })
		this.lastClass = cls
		this.lastRanking = g.state.ranking
	}
}
