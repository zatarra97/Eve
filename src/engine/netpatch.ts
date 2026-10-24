// netpatch6231: aggiornamento del sottosistema di rete, allegato da 1ronCh4ng nella missione A11
// "La Cura". Avviato dal Menu Applicazioni, al termine installa il nuovo kernel di NetComm
// 'sys.network6231' in flashram, che è l'obiettivo (LocalFileExists) della missione.

import type { Game, Task } from "./game"

export const NETPATCH_KERNEL = "sys.network6231"
export const NETPATCH_LABEL = "Aggiornamento NetComm"
/** Durata dell'aggiornamento (secondi) e CPU occupata (frazione della CPU installata) */
export const NETPATCH_SECONDS = 12
const NETPATCH_CPU = 0.4
const KERNEL_MB = 10

/** Aggiornamento in corso, se c'è */
export function netPatchTask(game: Game): Task | undefined {
	return game.tasks.find((t) => t.label === NETPATCH_LABEL)
}

export function netPatchInstalled(game: Game): boolean {
	return game.findLocalFile(NETPATCH_KERNEL) >= 0
}

/** Avvia l'aggiornamento; restituisce un messaggio di errore o null */
export function startNetPatch(game: Game): string | null {
	if (!game.hasProgram("netpatch6231")) return "netpatch6231 non è presente nella flashram."
	if (netPatchInstalled(game)) return "Il kernel di NetComm è già aggiornato alla versione 6231."
	if (netPatchTask(game)) return "Aggiornamento già in corso."
	if (game.flashramFree < KERNEL_MB) return "Spazio insufficiente sulla Flashram per il nuovo kernel."

	game.log("netpatch6231: aggiornamento del sottosistema di rete avviato...")
	game.startTask({
		kind: "copy",
		label: NETPATCH_LABEL,
		total: NETPATCH_SECONDS,
		net: 0,
		cpu: game.state.hardware.cpu.value * NETPATCH_CPU,
		onDone: () => {
			const ok = game.addLocalFile({ name: NETPATCH_KERNEL, dim: KERNEL_MB, img: -1, contents: "%SYSTEM%", owner: game.state.user })
			game.log(ok ? `netpatch6231: installato il nuovo kernel di NetComm '${NETPATCH_KERNEL}'.` : "netpatch6231: spazio insufficiente, aggiornamento non riuscito.")
			game.missions.check()
		},
	})
	return null
}
