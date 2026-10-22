import { useSyncExternalStore } from "react"
import type { Game } from "@/engine/game"
import { useApp } from "@/store/app"

const noop = () => () => {}
const zero = () => 0

/** Partita attiva; il componente si ridisegna a ogni modifica dello stato di gioco */
export function useGame(): Game {
	const game = useApp((s) => s.game)
	useSyncExternalStore(game ? game.subscribe : noop, game ? game.getVersion : zero)
	if (!game) throw new Error("Nessuna partita attiva")
	return game
}
