// Obiettivi delle missioni in parole semplici, ricavati dal tipo e dai campi della missione: li
// mostrano il Diario, il riquadro "Obiettivo" nelle mail e il comando missions della console.
// Le mail originali raccontano la storia ma spesso non dicono cosa fare: qui lo si dice sempre.

import type { Game } from "./game"
import type { MissionDef, ServerState } from "./types"
import { MISSION_TEXT } from "../content/missions"

export interface Objective {
	/** Cosa fare, in una o due frasi */
	text: string
	/** Avanzamento misurabile ("180/250") */
	progress?: string
	/** Consiglio pratico (testi di Eve, src/content/missions.ts) */
	hint?: string
}

/** Server indicato per nome e IP, con l'indicazione per trovarlo se non è ancora nella Network Map */
function where(game: Game, ip: string): string {
	const srv: ServerState | undefined = game.network.server(ip)
	if (!srv) return ip
	const name = `${srv.name} [${srv.ip}]`
	if (game.state.known.includes(srv.ip)) return name
	// Server Hiding: non si risolve per nome, ci si collega solo con l'IP
	return srv.type ? `${name} (non è nella Network Map: scrivi 'resolve ${srv.name}' nella console)` : `${name} (collegati con 'connect ${srv.ip}' dalla console)`
}

/** Obiettivo della missione; null se non chiede nulla (es. mail di benvenuto) */
export function objectiveOf(game: Game, d: MissionDef): Objective | null {
	const reply = d.targetMailFrom && !d.noMailNeeded
	const replyText = reply
		? `rispondi alla mail di ${d.targetMailFrom}${d.targetMailAttachment ? ` allegando il file '${d.targetMailAttachment}'` : ""}`
		: ""
	let main = ""
	let progress: string | undefined
	switch (d.type) {
		case "":
		case "SendMailTo":
			break
		case "FileDeleting":
			main = `Elimina il file '${d.refRemoteFileToDelete}' da ${where(game, d.refServerIP)}.`
			break
		case "FileUploading":
			main = `Carica il file '${d.refRemoteFileUploaded}' su ${where(game, d.refServerIP)}.`
			break
		case "LocalFileExists":
			main = `Procurati il file '${d.localFileName}' e tienilo nella tua Flashram.`
			break
		case "GetRanking":
			main = `Raggiungi ${d.rankingToGet} punti di Ranking.`
			progress = `${Math.min(game.state.ranking, d.rankingToGet)}/${d.rankingToGet}`
			break
		case "ChatPartecipation":
			main = `Collegati al Chat Server ${where(game, d.targetChatServerIP)}.`
			break
		case "ServerDestruction":
		case "ClusterDestruction":
			main = `Metti fuori uso il server ${where(game, d.refServerIP)}.`
			break
		case "ClusterCreation": {
			const n = Math.max(1, d.clusterMaxClients)
			main = `Crea un cluster di ${n} Personal Server.`
			progress = `${Math.min(game.state.cluster.length, n)}/${n}`
			break
		}
	}
	if (!main && !replyText) return null
	const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
	const text = !main ? `${cap(replyText)}.` : replyText ? `${main} Poi ${replyText}.` : main
	const hint = MISSION_TEXT[d.path]?.hint
	return { text, ...(progress && { progress }), ...(hint && { hint }) }
}
