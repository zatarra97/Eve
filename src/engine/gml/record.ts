// Ambiente per i file di definizione (.svr, .miss, .fak, def.miss): le variabili assegnate
// finiscono in un record; le chiamate vengono girate al motore se presente.

import type { Env, GmlObject, Value } from "./interpreter"
import { parse, type Program } from "./parser"
import { run } from "./interpreter"

const key = (index: number[]) => index.join(",")

export class GmlRecord {
	readonly scalars = new Map<string, Value>()
	readonly arrays = new Map<string, Map<string, Value>>()

	get(name: string, index?: number[]): Value | undefined {
		if (index) return this.arrays.get(name)?.get(key(index))
		return this.scalars.get(name)
	}

	set(name: string, value: Value, index?: number[]) {
		if (!index) {
			this.scalars.set(name, value)
			return
		}
		let arr = this.arrays.get(name)
		if (!arr) this.arrays.set(name, (arr = new Map()))
		arr.set(key(index), value)
	}

	has(name: string) {
		return this.scalars.has(name) || this.arrays.has(name)
	}

	/** Elementi 1..count di un array monodimensionale (buchi = undefined) */
	list(name: string, count: number): (Value | undefined)[] {
		const arr = this.arrays.get(name)
		return Array.from({ length: Math.max(0, count) }, (_, i) => arr?.get(String(i + 1)))
	}
}

export interface RecordEnvOptions {
	/** Oggetti globali disponibili per nome: System, Host, global… */
	objects?: Record<string, GmlObject>
	/** Chiamate a funzione (Runtime API); undefined = sconosciuta */
	call?: Env["call"]
}

// L'oggetto 'global' nei file di definizione serve solo a riferire risorse grafiche e audio:
// global.spr_portrait[24] → "spr_portrait:24", global.spr_intrapol_logo → "spr_intrapol_logo"
export const RESOURCE_GLOBAL: GmlObject = {
	gmlName: "global",
	get: (prop, index) => (index ? `${prop}:${index.join(",")}` : prop),
	set: () => {},
}

export function recordEnv(record: GmlRecord, opts: RecordEnvOptions = {}): Env {
	const objects: Record<string, GmlObject> = { global: RESOURCE_GLOBAL, ...opts.objects }
	return {
		getVar(name, index) {
			if (!index && name in objects) return objects[name]
			return record.get(name, index)
		},
		setVar(name, value, index) {
			record.set(name, value, index)
		},
		call: opts.call,
		// Identificatori non definiti = nomi di risorse GM (FileServer, Login, rootbreaker…)
		resolveIdent: (name) => name,
	}
}

/** Programmi già analizzati, per non riparsare a ogni caricamento */
const cache = new Map<string, Program>()

export function parseCached(source: string): Program {
	let p = cache.get(source)
	if (!p) {
		p = parse(source)
		cache.set(source, p)
	}
	return p
}

/** Esegue un file di definizione e restituisce il record risultante */
export function evalDefinition(source: string, opts: RecordEnvOptions = {}): GmlRecord {
	const record = new GmlRecord()
	run(parseCached(source), recordEnv(record, opts))
	return record
}
