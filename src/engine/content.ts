// Pacchetto contenuti: i sorgenti testuali originali (server, missioni, script, chat),
// indicizzati per percorso normalizzato. Le mod si sovrappongono al pacchetto base.

/** I percorsi nei file di gioco usano '\' o '/' e maiuscole a caso: "uground\A18.miss" = "uground/a18.miss" */
export function normPath(p: string): string {
	return p.replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase()
}

export interface ContentPack {
	/** Sorgenti .svr e .fak per percorso relativo a servers/ */
	servers: Map<string, string>
	/** Sorgenti .miss per percorso relativo a missions/ ("def.miss", "uground/a00.miss"…) */
	missions: Map<string, string>
	/** Sorgenti .script per nome file */
	scripts: Map<string, string>
	chats?: string
	autoexecConsole?: string
	autoexecScript?: string
	/** Prefisso URL di graphics/ e sounds/ */
	assetsBase: string
}

export interface Manifest {
	servers: string[]
	missions: string[]
	scripts: string[]
	graphics: string[]
	sounds: string[]
	texts: string[]
	autoexec: string[]
}

export function emptyPack(assetsBase = ""): ContentPack {
	return { servers: new Map(), missions: new Map(), scripts: new Map(), assetsBase }
}

/** Aggiunge un file al pacchetto in base al suo percorso (come nel manifest o in una mod) */
export function addToPack(pack: ContentPack, path: string, source: string) {
	const p = normPath(path).replace(/^data\//, "")
	if (p.startsWith("servers/")) pack.servers.set(p.slice("servers/".length), source)
	else if (p.startsWith("missions/")) pack.missions.set(p.slice("missions/".length), source)
	else if (p.startsWith("scripts/") || p.endsWith(".script")) {
		if (p === "autoexec.script") pack.autoexecScript = source
		else pack.scripts.set(p.split("/").pop()!, source)
	} else if (p === "autoexec.console") pack.autoexecConsole = source
	else if (p.endsWith("chats.text")) pack.chats = source
}

/** Sovrappone una mod al pacchetto base (i file con lo stesso percorso vengono sostituiti) */
export function mergePacks(base: ContentPack, mod: ContentPack): ContentPack {
	return {
		servers: new Map([...base.servers, ...mod.servers]),
		missions: new Map([...base.missions, ...mod.missions]),
		scripts: new Map([...base.scripts, ...mod.scripts]),
		chats: mod.chats ?? base.chats,
		autoexecConsole: mod.autoexecConsole ?? base.autoexecConsole,
		autoexecScript: mod.autoexecScript ?? base.autoexecScript,
		assetsBase: base.assetsBase,
	}
}

/** Carica il pacchetto base via HTTP da public/game */
export async function fetchPack(base: string): Promise<ContentPack> {
	const root = base.endsWith("/") ? base : base + "/"
	const manifest: Manifest = await fetch(root + "manifest.json").then((r) => r.json())
	const pack = emptyPack(root)
	const textFiles = [...manifest.servers, ...manifest.missions, ...manifest.scripts, ...manifest.texts, ...manifest.autoexec]
	// I .fak (modelli dei server violati) non sono nel manifest dei server ma servono
	textFiles.push("servers/hackedsys.fak")
	const sources = await Promise.all(
		textFiles.map((f) =>
			fetch(root + f)
				.then((r) => (r.ok ? r.text() : null))
				.catch(() => null),
		),
	)
	textFiles.forEach((f, i) => {
		const src = sources[i]
		if (src !== null) addToPack(pack, f, src)
	})
	return pack
}
