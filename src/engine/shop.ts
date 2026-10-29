// Acquisti sui terminali: hardware (Commerce Server), software (Software Server) e
// accettazione delle sottoscrizioni (Subscription Server).

import { noCredits } from "./errors"
import type { Game } from "./game"
import type { GameFile, HardwarePart } from "./types"

type Slot = "cpu" | "net" | "flashram"

const slotOf = (owner: GameFile["owner"]): Slot | null => {
	const o = String(owner).toLowerCase()
	return o === "cpu" ? "cpu" : o === "net" ? "net" : o === "flashram" ? "flashram" : null
}

/** Commerce Server: name = modello, dim = MHz/MBps/MB, img = costo, contents = descrizione, owner = tipo */
export function buyHardware(game: Game, item: GameFile): string | null {
	const slot = slotOf(item.owner)
	if (!slot) return "Articolo non disponibile."
	const cost = Number(item.img)
	if (cost > game.state.credits) return noCredits(game, cost)
	const current = game.state.hardware[slot]
	if (current.name === item.name) return "Questo componente è già installato."
	if (slot === "flashram" && item.dim < game.flashramUsed) return "La nuova Flashram non può contenere i file attuali."
	const part: HardwarePart = { name: item.name, desc: item.contents, value: item.dim }
	game.state.credits -= cost
	game.state.hardware[slot] = part
	game.log(`Installato: ${item.name}.`)
	game.changed()
	return null
}

/** Software Server: name = nome-versione, dim = MB, img = costo, contents = programma, owner = descrizione */
export function buySoftware(game: Game, item: GameFile): string | null {
	const cost = Math.max(0, Number(item.img) || 0)
	return game.network.download({ name: item.name, dim: item.dim, img: -1, contents: item.contents, owner: game.state.user }, cost)
}

/** Subscription Server: dim = ricompensa, img = file missione, contents = descrizione, owner = ranking minimo */
export function acceptSubscription(game: Game, item: GameFile): string | null {
	const minRanking = Number(item.owner) || 0
	if (game.state.ranking < minRanking) return `Ranking insufficiente: servono almeno ${minRanking} punti.`
	const def = game.missions.load(String(item.img), { subscription: true })
	if (!def) return "Sottoscrizione non disponibile o già accettata."
	return null
}
