// Messaggi d'errore che insegnano: dicono cosa manca, con i numeri, e cosa si può fare.

import { connectionBandwidth } from "./balance"
import type { Game } from "./game"

export function noSpace(game: Game, dim: number): string {
	return `Spazio insufficiente: servono ${dim} MB e nella memoria ne restano ${Math.max(0, game.flashramFree)}. Elimina i file inutili con 'rm <file>' dalla console o compra un SSD più grande.`
}

export function noCredits(game: Game, cost: number): string {
	return `Crediti insufficienti: costa ${cost} Cr. e ne hai ${Math.floor(game.state.credits)}.`
}

/** Programma da comprare: rootbreaker, wavehacker, fileforce e nukelord sono tutti su warez.underground */
export function missingProgram(name: string): string {
	return `${name} non è nella tua memoria: puoi comprarlo su un Software Server, come warez.underground.`
}

export function noBandwidth(game: Game, nodes: number): string {
	const free = Math.max(0, Math.round(game.netTotal - game.netUsed))
	return `Banda insufficiente: una connessione con ${nodes} ${nodes === 1 ? "nodo" : "nodi"} richiede ${connectionBandwidth(nodes)} MBps e ne hai ${free} liberi. Togli un nodo, chiudi i download in corso o compra una scheda di rete più veloce.`
}

export function firewallRefused(server: string, mask: string): string {
	return `Connessione rifiutata dal firewall di ${server}: accetta solo connessioni provenienti da ${mask}. Usa quel server come ultimo nodo prima della destinazione.`
}
