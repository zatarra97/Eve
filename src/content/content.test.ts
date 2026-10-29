import { describe, expect, it } from "vitest"
import { GLOSSARY, findTerms, glossaryEntry } from "./glossary"
import { MISSION_TEXT } from "./missions"

describe("glossario", () => {
	it("voci con id unici e collegamenti validi", () => {
		const ids = GLOSSARY.map((e) => e.id)
		expect(new Set(ids).size).toBe(ids.length)
		for (const e of GLOSSARY) for (const r of e.related ?? []) expect(glossaryEntry(r), `${e.id} → ${r}`).toBeDefined()
	})

	it("ogni spiegazione breve sta in due righe", () => {
		for (const e of GLOSSARY) expect(e.short.split(/\s+/).length, e.id).toBeLessThanOrEqual(30)
	})

	it("trova i termini come parole intere, il più lungo per primo", () => {
		const ids = (t: string) => findTerms(t).map((m) => m.id)
		expect(ids("Passa da un Proxy Server, poi usa rootbreaker.")).toEqual(["proxy", "rootbreaker"])
		expect(ids("Cancella log.connections prima di uscire")).toEqual(["log"])
		// "log" dentro altre parole o nomi di file non conta
		expect(ids("leggi il blog e il file log.clientconn1")).toEqual([])
		expect(ids("La BANDA è satura, servono 40 MBps")).toEqual(["banda", "banda"])
	})
})

describe("testi delle missioni riscritti", () => {
	const words = (s: string) => s.split(/\s+/).filter(Boolean).length

	it("ogni mail sta sotto le 70 parole e i consigli in poche righe", () => {
		for (const [path, t] of Object.entries(MISSION_TEXT)) {
			for (const m of [...(t.begin ?? []), ...(t.end ?? [])]) expect(words(m.body), path).toBeLessThanOrEqual(70)
			if (t.hint) expect(words(t.hint), path).toBeLessThanOrEqual(35)
		}
	})

	it("le mail nuove (senza originale) hanno mittente e oggetto", () => {
		for (const path of ["uground/a00.miss", "uground/a05.miss"]) for (const m of MISSION_TEXT[path].begin!) expect(m.from && m.subject, path).toBeTruthy()
	})
})
