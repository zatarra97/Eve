// Missioni: caricamento (con esecuzione del codice del file), mail di inizio, verifica degli
// obiettivi, risposta di chiusura, ricompense e concatenazione delle campagne (NextMission).

import { run } from "./gml/interpreter"
import { parseCached, recordEnv, GmlRecord } from "./gml/record"
import { normPath } from "./content"
import type { Game } from "./game"
import { loadMission } from "./loaders"
import type { ActiveMission, GameFile, Mail, MissionDef } from "./types"

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export class Missions {
	private game: Game

	constructor(game: Game) {
		this.game = game
	}

	get active(): ActiveMission[] {
		return this.game.state.missions
	}

	/** def.miss: missioni caricate all'inizio di ogni nuova partita */
	runDefinitions() {
		const src = this.game.content.missions.get("def.miss")
		if (!src) return
		run(parseCached(src), recordEnv(new GmlRecord(), this.game.runtime.envOptions()))
	}

	/** LoadMission / addmission: percorso relativo a missions/ */
	load(path: string, opts: { subscription?: boolean } = {}): MissionDef | null {
		const g = this.game
		// "def/tut0" e "def\TUT0.miss" sono la stessa missione: l'estensione è facoltativa
		const raw = normPath(path)
		const p = raw.endsWith(".miss") ? raw : raw + ".miss"
		const source = g.content.missions.get(p)
		if (!source) {
			g.log(`Missione non trovata: ${path}`)
			return null
		}
		if (this.active.some((m) => m.def.path === p) || g.state.completed.includes(p)) return null

		let def: MissionDef
		try {
			def = loadMission(source, p, g.runtime.envOptions())
		} catch (e) {
			g.log(`Errore nella missione ${path}: ${(e as Error).message}`)
			return null
		}
		g.debug(`Missione caricata: ${def.id} (${def.name})`)
		this.active.push({ def, subscription: opts.subscription, startedAt: g.now })

		// Le mail di inizio arrivano dopo qualche secondo, una dopo l'altra
		let delay = 0
		for (const mail of def.begin) {
			delay += g.randomDelay([2, 6])
			g.sendMailLater(mail, delay)
		}
		g.changed()
		return def
	}

	/** Testo compilato automaticamente rispondendo a una mail */
	replyTextFor(mail: Mail): string {
		const m = this.targetOf(mail)
		return m ? m.def.replyMailText : ""
	}

	private targetOf(mail: Mail): ActiveMission | undefined {
		return this.active.find(
			(m) => !m.done && m.def.targetMailFrom && same(m.def.targetMailFrom, mail.from) && same(m.def.targetMailSubject, mail.subject),
		)
	}

	/** Il giocatore risponde a una mail */
	onReply(mail: Mail, attachment?: GameFile) {
		const g = this.game
		const m = this.targetOf(mail)
		g.state.mails.push({
			id: g.state.nextMailId++,
			from: g.address,
			subject: `RE: ${mail.subject}`,
			body: m?.def.replyMailText ?? "",
			attachment,
			read: true,
			date: g.now,
			sent: true,
		})
		g.changed()
		if (!m) return

		const d = m.def
		// Chi non chiede allegati ignora le risposte che ne contengono (tutorial di 1ronCh4ng)
		if (d.targetMailAttachment ? !attachment || !same(attachment.name, d.targetMailAttachment) : !!attachment) return
		if (this.objectiveMet(d)) this.complete(m)
	}

	/** Verifica degli obiettivi delle missioni che si chiudono senza mail */
	check() {
		for (const m of [...this.active]) {
			if (m.done) continue
			const auto = m.def.noMailNeeded || !m.def.targetMailFrom
			if (auto && this.objectiveMet(m.def)) this.complete(m)
		}
	}

	tick() {
		this.check()
	}

	objectiveMet(d: MissionDef): boolean {
		const g = this.game
		const srv = d.refServerIP ? g.network.server(d.refServerIP) : undefined
		const hasRemote = (name: string) => !!srv?.files.some((f) => same(f.name, name))
		switch (d.type) {
			case "":
			case "SendMailTo":
				return true
			case "FileDeleting":
				return !!srv && !hasRemote(d.refRemoteFileToDelete)
			case "FileUploading":
				return !!srv && hasRemote(d.refRemoteFileUploaded)
			case "LocalFileExists":
				return g.findLocalFile(d.localFileName) >= 0
			case "GetRanking":
				return g.state.ranking >= d.rankingToGet
			case "ChatPartecipation":
				return g.state.visitedChats.includes(g.network.server(d.targetChatServerIP)?.ip ?? d.targetChatServerIP)
			case "ServerDestruction":
			case "ClusterDestruction":
				return !!srv && !!srv.destroyed
			case "ClusterCreation":
				return g.state.cluster.length >= Math.max(1, d.clusterMaxClients)
		}
		return false
	}

	/** Missione riuscita: ricompense, mail e news di fine, missione successiva */
	complete(m: ActiveMission) {
		const g = this.game
		const d = m.def
		m.done = true
		g.state.credits += d.credits
		g.state.ranking += d.extraRanking
		if (d.credits || d.extraRanking) g.log(`Missione '${d.name}' completata: +${d.credits} crediti, +${d.extraRanking} ranking.`)

		for (const news of d.endNews) g.network.addNews(news.server, news.title, news.body)
		// Alcuni file originali (A04, A-135-80-01, A-135-150-01) hanno ServerIPToRemove="RefServerIP"
		// tra virgolette: è una stringa letterale che non corrisponde a nessun IP, quindi nel gioco
		// originale non rimuoveva nulla. Va lasciata così: A04 rimuoverebbe crimediv.intrapol, che
		// serve ancora ad A19 e nmcha-05.
		if (d.serverIPToRemove) g.network.removeServer(d.serverIPToRemove)

		let delay = 0
		for (const mail of d.end) {
			delay += g.randomDelay()
			g.sendMailLater(mail, delay)
		}
		// La missione successiva parte dopo le mail di fine
		g.schedule(delay + 1, "missionEnd", { path: d.path })
		g.changed()
	}

	/** Dopo le mail di fine: archivia la missione e carica la successiva */
	afterEnd(path: string) {
		const g = this.game
		const m = this.active.find((x) => x.def.path === path)
		if (!m) return
		g.state.missions = this.active.filter((x) => x !== m)
		if (!g.state.completed.includes(path)) g.state.completed.push(path)
		if (m.def.nextMission) this.load(m.def.nextMission)
		g.changed()
	}

	/** Missioni visibili al giocatore (comando missions) */
	list(): { id: string; name: string; done: boolean }[] {
		return this.active.map((m) => ({ id: m.def.id, name: m.def.name, done: !!m.done }))
	}
}
