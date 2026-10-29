// MissGen: sottoscrizioni casuali "con pre-accettazione" (Manuale §2.8, Modding HOW-TO §2.7).
//
// I Subscription Server con MissGenFaction generano nel tempo nuove offerte che puntano ai server
// con AllowRandomMission=true. Ogni offerta è una MissionDef costruita in memoria (nessun file .miss)
// di un tipo già verificato da Missions.objectiveMet; se nessuno la accetta sparisce alla scadenza.
// Un'offerta accettata diventa una missione attiva con la stessa scadenza: se non viene completata
// in tempo è ritirata. Manca ancora l'interfaccia.

import {
	MISSGEN_CREDITS_PER_RANKING,
	MISSGEN_INTERVAL_S,
	MISSGEN_LIFETIME_S,
	MISSGEN_MAX_OFFERS,
	MISSGEN_MIN_RANKING_RATIO,
	MISSGEN_RANKING_PER_RANKING,
	MISSGEN_VARIATION,
} from "./balance"
import type { Game } from "./game"
import { objectiveOf } from "./objectives"
import type { GameFile, MissionDef, ServerState } from "./types"

/** Tipi di missione generati: i bersagli dei contenuti sono File Server con Login e CantBeDestroyed */
export type MissGenType = "FileDeleting" | "FileUploading"

/** Sottoscrizione generata, in offerta su un Subscription Server */
export interface MissGenOffer {
	/** Numero della sottoscrizione (es. "R-0007") */
	id: string
	/** IP del Subscription Server che la offre */
	server: string
	faction: string
	/** IP del server bersaglio */
	target: string
	def: MissionDef
	minRanking: number
	expiresAt: number
	/**
	 * File della missione: per FileDeleting va messo sul bersaglio, per FileUploading in flashram,
	 * entrambi al momento dell'accettazione
	 */
	file: GameFile
}

export interface MissGenState {
	/** Contatore per i numeri delle sottoscrizioni */
	nextId: number
	/** Prossima generazione per Subscription Server (IP → timestamp) */
	nextAt: Record<string, number>
	offers: MissGenOffer[]
}

export function emptyMissGen(): MissGenState {
	return { nextId: 1, nextAt: {}, offers: [] }
}

/** Tempo residuo fino alla scadenza, "m:ss" o "h:mm:ss" ("0:00" se già scaduta) */
export function formatRemaining(ms: number): string {
	const total = Math.max(0, Math.ceil(ms / 1000))
	const h = Math.floor(total / 3600)
	const m = Math.floor((total % 3600) / 60)
	const s = String(total % 60).padStart(2, "0")
	return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`
}

/** Fazioni dei Subscription Server (MissGenFaction): dominio del mittente delle mail */
const FACTIONS: Record<string, { domain: string }> = {
	underground: { domain: "underground" },
	intrapol: { domain: "intrapol" },
}

/** Nomi base dei file delle missioni, con un suffisso numerico casuale */
const FILE_NAMES: Record<MissGenType, string[]> = {
	FileDeleting: ["dat.archive", "dat.report", "dat.records"],
	FileUploading: ["exe.monitor", "exe.update", "dat.notice"],
}

const TYPES: MissGenType[] = ["FileDeleting", "FileUploading"]

export class MissGen {
	private game: Game

	constructor(game: Game) {
		this.game = game
	}

	/** Stato salvato; le partite salvate prima di MissGen non lo hanno */
	get state(): MissGenState {
		return (this.game.state.missgen ??= emptyMissGen())
	}

	/** Obiettivo dell'offerta, per il terminale */
	objective(offer: MissGenOffer): string {
		return objectiveOf(this.game, offer.def)?.text ?? ""
	}

	get offers(): MissGenOffer[] {
		return this.state.offers
	}

	/** Offerte di un Subscription Server */
	offersOf(serverIP: string): MissGenOffer[] {
		return this.offers.filter((o) => o.server === serverIP)
	}

	/** Subscription Server che generano offerte (MissGenFaction nota e server in linea) */
	generators(): ServerState[] {
		const net = this.game.network
		return Object.values(this.game.state.servers).filter(
			(s) => s.terminal === "SubscriptionServer" && !!FACTIONS[s.missGenFaction.toLowerCase()] && net.isOnline(s),
		)
	}

	/** Bersagli possibili: AllowRandomMission, in linea, non sotto sequestro, con un amministratore */
	targets(): ServerState[] {
		const net = this.game.network
		return Object.values(this.game.state.servers).filter((s) => s.allowRandomMission && net.isOnline(s) && !s.seizedUntil && !!net.adminOf(s))
	}

	tick() {
		const g = this.game
		const st = this.state
		// Le offerte non accettate spariscono alla scadenza
		const before = st.offers.length
		st.offers = st.offers.filter((o) => o.expiresAt > g.now)
		if (st.offers.length !== before) g.changed()
		this.withdrawExpired()

		for (const srv of this.generators()) {
			const next = st.nextAt[srv.ip]
			if (next === undefined) {
				st.nextAt[srv.ip] = g.now + this.interval()
				continue
			}
			if (g.now < next) continue
			st.nextAt[srv.ip] = g.now + this.interval()
			if (this.offersOf(srv.ip).length < MISSGEN_MAX_OFFERS) this.generate(srv)
		}
	}

	/** Intervallo fino alla prossima generazione: MISSGEN_INTERVAL_S, tra la metà e una volta e mezza */
	private interval(): number {
		return MISSGEN_INTERVAL_S * (0.5 + this.game.random()) * 1000
	}

	private pick<T>(list: T[]): T {
		return list[Math.min(list.length - 1, Math.floor(this.game.random() * list.length))]
	}

	/** Genera un'offerta sul Subscription Server dato (tipo casuale se non indicato); null se non ci sono bersagli */
	generate(srv: ServerState, forcedType?: MissGenType): MissGenOffer | null {
		const g = this.game
		const targets = this.targets()
		if (!targets.length) return null
		const faction = srv.missGenFaction.toLowerCase()
		const target = this.pick(targets)
		const type = forcedType ?? this.pick(TYPES)
		const adminRanking = g.network.adminOf(target)!.ranking
		const variation = 1 + (g.random() * 2 - 1) * MISSGEN_VARIATION
		const credits = Math.round(adminRanking * MISSGEN_CREDITS_PER_RANKING * variation)
		const extraRanking = Math.max(1, Math.round(adminRanking * MISSGEN_RANKING_PER_RANKING * variation))
		const minRanking = Math.round(adminRanking * MISSGEN_MIN_RANKING_RATIO)

		const id = `R-${String(this.state.nextId++).padStart(4, "0")}`
		const fileName = `${this.pick(FILE_NAMES[type])}-${1000 + Math.floor(g.random() * 9000)}`
		const file: GameFile = { name: fileName, dim: 1, img: -1, contents: "%BIN%", owner: type === "FileDeleting" ? "Admin" : g.state.user }
		const from = `${id}@${FACTIONS[faction].domain}`
		const subject = `Sottoscrizione No. ${id}`
		const where = `${target.name} [${target.ip}]`
		const task =
			type === "FileDeleting"
				? `eliminare il file '${fileName}' dal server ${where}`
				: `caricare il file '${fileName}', che troverai in Flashram, sul server ${where}`
		const def: MissionDef = {
			path: `missgen/${id.toLowerCase()}`,
			id,
			name: `Sottoscrizione ${id}`,
			type,
			begin: [
				{
					from,
					subject,
					body: `Sottoscrizione No. ${id}\n\nObiettivo: ${task}.\nRicompensa: ${credits} Crediti.\n\nRispondi a questa mail a lavoro concluso.`,
				},
			],
			targetMailFrom: from,
			targetMailSubject: subject,
			targetMailAttachment: "",
			noMailNeeded: false,
			refServerIP: target.ip,
			refRemoteFileToDelete: type === "FileDeleting" ? fileName : "",
			refRemoteFileUploaded: type === "FileUploading" ? fileName : "",
			targetChatServerIP: "",
			rankingToGet: 0,
			localFileName: "",
			clusterExeName: "",
			clusterMaxClients: 0,
			credits,
			extraRanking,
			nextMission: "",
			serverIPToRemove: "",
			replyMailText: `Sottoscrizione ${id}: obiettivo raggiunto su ${target.name}.`,
			end: [{ from, subject: "Sottoscrizione completata!", body: `Sottoscrizione No. ${id} completata.\nLa ricompensa di ${credits} Crediti è stata accreditata sul tuo conto.` }],
			endNews: [],
		}
		const offer: MissGenOffer = {
			id,
			server: srv.ip,
			faction,
			target: target.ip,
			def,
			minRanking,
			expiresAt: g.now + MISSGEN_LIFETIME_S * 1000,
			file,
		}
		this.state.offers.push(offer)
		g.debug(`MissGen: ${srv.name} offre ${id} (${type} su ${target.name}).`)
		g.changed()
		return offer
	}

	/**
	 * Accetta un'offerta: la toglie da quelle in offerta, posiziona il suo file (sul bersaglio per
	 * FileDeleting, in flashram per FileUploading) e avvia la missione con la stessa scadenza.
	 */
	accept(id: string): string | null {
		const g = this.game
		const offer = this.offers.find((o) => o.id === id)
		if (!offer) return "Sottoscrizione non disponibile."
		if (offer.expiresAt <= g.now) return "Sottoscrizione scaduta."
		if (g.state.ranking < offer.minRanking) return `Ranking insufficiente: servono almeno ${offer.minRanking} punti.`
		const target = g.network.server(offer.target)
		if (!target || !g.network.isOnline(target)) return "Il server della sottoscrizione non è raggiungibile."
		if (offer.def.type === "FileUploading") {
			if (!g.addLocalFile({ ...offer.file, owner: g.state.user })) return "Spazio insufficiente sulla Flashram."
		} else g.network.putFile(target, { ...offer.file })
		this.state.offers = this.offers.filter((o) => o !== offer)
		g.missions.start(offer.def, { subscription: true, expiresAt: offer.expiresAt })
		g.log(`Sottoscrizione ${offer.id} accettata.`)
		return null
	}

	/** Missioni casuali accettate e non completate entro la scadenza: ritirate con una mail del committente */
	private withdrawExpired() {
		const g = this.game
		const expired = g.state.missions.filter((m) => !m.done && m.expiresAt !== undefined && m.expiresAt <= g.now)
		if (!expired.length) return
		g.state.missions = g.state.missions.filter((m) => !expired.includes(m))
		for (const m of expired) {
			// Gli eventuali file già in flashram restano al giocatore
			g.receiveMail({
				from: m.def.targetMailFrom,
				subject: "Sottoscrizione scaduta",
				body: `La ${m.def.name} è scaduta senza essere stata completata ed è stata ritirata.`,
			})
			g.log(`${m.def.name} scaduta e ritirata.`)
		}
		g.changed()
	}
}
