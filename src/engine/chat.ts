// Chat server: log pubblici e messaggi casuali generati da texts/chats.text.
// Il file usa espressioni con random(): rivalutarlo produce ogni volta nomi diversi.

import { toStr } from "./gml/interpreter"
import { evalDefinition, type GmlRecord } from "./gml/record"
import type { Game } from "./game"

export class Chat {
	private game: Game
	private logCache: string[] | null = null

	constructor(game: Game) {
		this.game = game
	}

	private evalFile(): GmlRecord | null {
		const src = this.game.content.chats
		if (!src) return null
		try {
			return evalDefinition(src)
		} catch {
			return null
		}
	}

	/** Log pubblici del chat server: righe del file di testo + righe aggiunte dalle missioni */
	logs(ip: string): string[] {
		if (!this.logCache) {
			const r = this.evalFile()
			const count = r ? Number(r.get("Logs") ?? 0) : 0
			this.logCache = r ? Array.from({ length: count + 1 }, (_, i) => r.get("Log", [i])).filter((v) => v !== undefined).map((v) => toStr(v!)) : []
		}
		const extra = this.game.network.server(ip)?.chatLog ?? []
		return [...this.logCache, ...extra]
	}

	/** Un messaggio casuale della chat dal vivo */
	randomMessage(): string {
		const r = this.evalFile()
		if (!r) return ""
		const count = Number(r.get("Messages") ?? 0)
		const i = Math.floor(this.game.random() * count)
		const v = r.get("Message", [i])
		return v === undefined ? "" : toStr(v)
	}
}
