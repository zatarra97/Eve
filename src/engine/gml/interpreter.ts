// Interprete dell'AST GML. L'ambiente (Env) decide dove finiscono variabili e chiamate:
// nei file di definizione (svr/miss) le variabili riempiono un record, negli script del gioco
// le chiamate arrivano alla Runtime API del motore.

import type { Expr, LValue, Program, Stmt } from "./parser"
import { GmlSyntaxError } from "./lexer"

// Oggetto GML con proprietà (System, Host, global, un server…)
export interface GmlObject {
	readonly gmlName: string
	get(prop: string, index?: number[]): Value
	set(prop: string, value: Value, index?: number[]): void
}

export type Value = number | string | GmlObject

export interface Env {
	/** Variabile semplice o array; undefined = non definita */
	getVar(name: string, index?: number[]): Value | undefined
	setVar(name: string, value: Value, index?: number[]): void
	/** Chiamata a funzione dell'ambiente; undefined = funzione sconosciuta all'ambiente */
	call?(name: string, args: Value[], line: number): Value | undefined
	/** Valore di un identificatore non definito (nomi di risorse GM: FileServer, rootbreaker…) */
	resolveIdent?(name: string): Value
}

export class GmlRuntimeError extends Error {
	line?: number
	constructor(message: string, line?: number) {
		super(line ? `${message} (riga ${line})` : message)
		this.line = line
	}
}

/** Lanciata da `exit`, da ExitScript() o da return al livello principale */
export class ExitSignal {
	value?: Value
	constructor(value?: Value) {
		this.value = value
	}
}

class BreakSignal {}
class ContinueSignal {}

export interface RunOptions {
	/** Limite di istruzioni, contro i loop infiniti */
	maxSteps?: number
}

export function isObject(v: Value): v is GmlObject {
	return typeof v === "object"
}

export function truthy(v: Value): boolean {
	if (typeof v === "number") return v > 0.5
	if (typeof v === "string") return v.length > 0
	return true
}

export function toNumber(v: Value): number {
	if (typeof v === "number") return v
	if (typeof v === "string") {
		const n = Number(v)
		return Number.isFinite(n) ? n : 0
	}
	return 0
}

export function toStr(v: Value): string {
	if (typeof v === "string") return v
	if (typeof v === "number") return formatNumber(v)
	return v.gmlName
}

// GM6 stampa i reali con al massimo 2 decimali, senza zeri finali
function formatNumber(n: number): string {
	if (Number.isInteger(n)) return String(n)
	return String(Math.round(n * 100) / 100)
}

/** Esegue un programma; restituisce il valore di un eventuale `exit`/`return`. */
export function run(program: Program, env: Env, opts: RunOptions = {}): Value | undefined {
	const interp = new Interpreter(env, opts.maxSteps ?? 200_000)
	try {
		interp.block(program.body)
	} catch (e) {
		if (e instanceof ExitSignal) return e.value
		if (e instanceof BreakSignal || e instanceof ContinueSignal) return undefined
		throw e
	}
	return undefined
}

/** Valuta una singola espressione (usato per i campi calcolati a runtime). */
export function evaluate(expr: Expr, env: Env): Value {
	return new Interpreter(env, 10_000).expr(expr)
}

class Interpreter {
	private steps = 0
	private env: Env
	private maxSteps: number

	constructor(env: Env, maxSteps: number) {
		this.env = env
		this.maxSteps = maxSteps
	}

	block(body: Stmt[]) {
		for (const s of body) this.stmt(s)
	}

	private tick() {
		if (++this.steps > this.maxSteps) throw new GmlRuntimeError("troppe istruzioni eseguite (loop infinito?)")
	}

	stmt(s: Stmt): void {
		this.tick()
		switch (s.kind) {
			case "assign":
				return this.assign(s.target, s.op, this.expr(s.value), s.line)
			case "expr":
				this.expr(s.expr)
				return
			case "if":
				if (truthy(this.expr(s.cond))) this.stmt(s.then)
				else if (s.else) this.stmt(s.else)
				return
			case "while":
				while (truthy(this.expr(s.cond))) if (this.loopBody(s.body)) break
				return
			case "do":
				do {
					if (this.loopBody(s.body)) break
				} while (!truthy(this.expr(s.until)))
				return
			case "for":
				if (s.init) this.stmt(s.init)
				while (!s.cond || truthy(this.expr(s.cond))) {
					if (this.loopBody(s.body)) break
					if (s.step) this.stmt(s.step)
				}
				return
			case "repeat": {
				const count = Math.floor(toNumber(this.expr(s.count)))
				for (let k = 0; k < count; k++) if (this.loopBody(s.body)) break
				return
			}
			case "block":
				return this.block(s.body)
			case "var":
				for (const name of s.names) if (this.env.getVar(name) === undefined) this.env.setVar(name, 0)
				return
			case "exit":
				throw new ExitSignal()
			case "break":
				throw new BreakSignal()
			case "continue":
				throw new ContinueSignal()
			case "return":
				throw new ExitSignal(s.value ? this.expr(s.value) : undefined)
		}
	}

	/** Esegue il corpo di un ciclo; true = break */
	private loopBody(body: Stmt): boolean {
		try {
			this.stmt(body)
		} catch (e) {
			if (e instanceof BreakSignal) return true
			if (e instanceof ContinueSignal) return false
			throw e
		}
		return false
	}

	private assign(target: LValue, op: string, value: Value, line: number) {
		if (op !== "=") {
			const current = this.read(target) ?? 0
			value = arithmetic(op[0], current, value, line)
		}
		if (target.kind === "ident") return this.env.setVar(target.name, value)
		if (target.kind === "member") return this.objectOf(target.object, line).set(target.name, value)
		// index
		const index = target.index.map((e) => toNumber(this.expr(e)))
		const base = target.target
		if (base.kind === "ident") return this.env.setVar(base.name, value, index)
		if (base.kind === "member") return this.objectOf(base.object, line).set(base.name, value, index)
		throw new GmlRuntimeError("assegnamento indicizzato non valido", line)
	}

	/** Legge un lvalue senza risolvere i nomi di risorsa (per gli operatori composti) */
	private read(target: LValue): Value | undefined {
		if (target.kind === "ident") return this.env.getVar(target.name)
		if (target.kind === "member") return this.objectOf(target.object).get(target.name)
		const index = target.index.map((e) => toNumber(this.expr(e)))
		const base = target.target
		if (base.kind === "ident") return this.env.getVar(base.name, index)
		if (base.kind === "member") return this.objectOf(base.object).get(base.name, index)
		return undefined
	}

	private objectOf(e: Expr, line?: number): GmlObject {
		const v = this.expr(e)
		if (!isObject(v)) throw new GmlRuntimeError(`'${toStr(v)}' non è un oggetto`, line)
		return v
	}

	expr(e: Expr): Value {
		switch (e.kind) {
			case "num":
				return e.value
			case "str":
				return e.value
			case "ident": {
				const v = this.env.getVar(e.name)
				if (v !== undefined) return v
				return this.env.resolveIdent ? this.env.resolveIdent(e.name) : e.name
			}
			case "member":
				return this.objectOf(e.object).get(e.name)
			case "index": {
				const index = e.index.map((x) => toNumber(this.expr(x)))
				if (e.target.kind === "ident") {
					const v = this.env.getVar(e.target.name, index)
					return v ?? 0
				}
				if (e.target.kind === "member") return this.objectOf(e.target.object).get(e.target.name, index)
				throw new GmlRuntimeError("indicizzazione non valida")
			}
			case "call": {
				const args = e.args.map((a) => this.expr(a))
				const fromEnv = this.env.call?.(e.callee, args, e.line)
				if (fromEnv !== undefined) return fromEnv
				const builtin = BUILTINS[e.callee.toLowerCase()]
				if (builtin) return builtin(args)
				throw new GmlRuntimeError(`funzione sconosciuta '${e.callee}'`, e.line)
			}
			case "unary": {
				const v = this.expr(e.arg)
				if (e.op === "!") return truthy(v) ? 0 : 1
				if (e.op === "-") return -toNumber(v)
				return toNumber(v)
			}
			case "binary":
				return this.binary(e.op, e.left, e.right)
		}
	}

	private binary(op: string, l: Expr, r: Expr): Value {
		// Valutazione a corto circuito
		if (op === "&&") return truthy(this.expr(l)) && truthy(this.expr(r)) ? 1 : 0
		if (op === "||") return truthy(this.expr(l)) || truthy(this.expr(r)) ? 1 : 0
		const a = this.expr(l)
		const b = this.expr(r)
		switch (op) {
			case "^^":
				return truthy(a) !== truthy(b) ? 1 : 0
			case "=":
				return equals(a, b) ? 1 : 0
			case "!=":
				return equals(a, b) ? 0 : 1
			case "<":
			case "<=":
			case ">":
			case ">=":
				return compare(op, a, b) ? 1 : 0
			case "|":
				return toNumber(a) | toNumber(b)
			case "&":
				return toNumber(a) & toNumber(b)
			case "^":
				return toNumber(a) ^ toNumber(b)
			case "div":
				return Math.trunc(toNumber(a) / toNumber(b))
			case "mod":
				return toNumber(a) % toNumber(b)
			default:
				return arithmetic(op, a, b)
		}
	}
}

function equals(a: Value, b: Value): boolean {
	if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < 1e-9
	if (typeof a === "string" && typeof b === "string") return a === b
	return a === b
}

function compare(op: string, a: Value, b: Value): boolean {
	const x = typeof a === "string" && typeof b === "string" ? a.localeCompare(b) : toNumber(a) - toNumber(b)
	switch (op) {
		case "<":
			return x < 0
		case "<=":
			return x <= 0
		case ">":
			return x > 0
		default:
			return x >= 0
	}
}

function arithmetic(op: string, a: Value, b: Value, line?: number): Value {
	if (op === "+") {
		if (typeof a === "string" || typeof b === "string") return toStr(a) + toStr(b)
		return toNumber(a) + toNumber(b)
	}
	const x = toNumber(a)
	const y = toNumber(b)
	switch (op) {
		case "-":
			return x - y
		case "*":
			return x * y
		case "/":
			if (y === 0) throw new GmlRuntimeError("divisione per zero", line)
			return x / y
	}
	throw new GmlRuntimeError(`operatore sconosciuto '${op}'`, line)
}

// Funzioni GML standard usate dai file del gioco e dalle mod
const BUILTINS: Record<string, (a: Value[]) => Value> = {
	chr: ([c]) => String.fromCharCode(toNumber(c)),
	ord: ([s]) => toStr(s).charCodeAt(0) || 0,
	string: ([v]) => toStr(v),
	real: ([v]) => toNumber(v),
	is_string: ([v]) => (typeof v === "string" ? 1 : 0),
	is_real: ([v]) => (typeof v === "number" ? 1 : 0),
	string_length: ([s]) => toStr(s).length,
	string_copy: ([s, i, n]) => toStr(s).substr(Math.max(0, toNumber(i) - 1), toNumber(n)),
	string_char_at: ([s, i]) => toStr(s).charAt(toNumber(i) - 1),
	string_pos: ([sub, s]) => toStr(s).indexOf(toStr(sub)) + 1,
	string_replace: ([s, a, b]) => toStr(s).replace(toStr(a), toStr(b)),
	string_replace_all: ([s, a, b]) => toStr(s).split(toStr(a)).join(toStr(b)),
	string_upper: ([s]) => toStr(s).toUpperCase(),
	string_lower: ([s]) => toStr(s).toLowerCase(),
	string_repeat: ([s, n]) => toStr(s).repeat(Math.max(0, toNumber(n))),
	random: ([n]) => Math.random() * toNumber(n),
	irandom: ([n]) => Math.floor(Math.random() * (toNumber(n) + 1)),
	choose: (args) => args[Math.floor(Math.random() * args.length)] ?? 0,
	floor: ([n]) => Math.floor(toNumber(n)),
	ceil: ([n]) => Math.ceil(toNumber(n)),
	round: ([n]) => Math.round(toNumber(n)),
	abs: ([n]) => Math.abs(toNumber(n)),
	sign: ([n]) => Math.sign(toNumber(n)),
	sqrt: ([n]) => Math.sqrt(toNumber(n)),
	power: ([a, b]) => Math.pow(toNumber(a), toNumber(b)),
	min: (args) => Math.min(...args.map(toNumber)),
	max: (args) => Math.max(...args.map(toNumber)),
}

export function isBuiltin(name: string): boolean {
	return name.toLowerCase() in BUILTINS
}

export { GmlSyntaxError }
