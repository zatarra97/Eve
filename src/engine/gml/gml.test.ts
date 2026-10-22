import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"
import { evaluate, isBuiltin, run, type GmlObject, type Value } from "./interpreter"
import { parse } from "./parser"
import { evalDefinition, GmlRecord, recordEnv } from "./record"

const GAME = join(process.cwd(), "public/game")

function walk(dir: string): string[] {
	return readdirSync(dir).flatMap((n) => {
		const p = join(dir, n)
		return statSync(p).isDirectory() ? walk(p) : [p]
	})
}

// Oggetto System fittizio per i file che leggono dati dell'utente
const fakeSystem: GmlObject = {
	gmlName: "System",
	get: (prop) => (prop === "CurrUser" ? "tester" : 0),
	set: () => {},
}

// Le funzioni del motore non servono qui: rispondono 0, quelle GML standard restano attive
const stubCall = (name: string) => (isBuiltin(name) ? undefined : 0)

function exec(src: string) {
	const record = new GmlRecord()
	run(parse(src), recordEnv(record, { objects: { System: fakeSystem }, call: stubCall }))
	return record
}

describe("interprete GML", () => {
	it("concatena stringhe e chr()", () => {
		const r = exec('A="ciao"+chr(13)+chr(10)+System.CurrUser')
		expect(r.get("A")).toBe("ciao\r\ntester")
	})

	it("gestisce array, += e indici calcolati", () => {
		const r = exec("TotFiles=2\nTotFiles+=1\nFileName[TotFiles]=\"x\"\nFileDim[1]=-5")
		expect(r.get("TotFiles")).toBe(3)
		expect(r.get("FileName", [3])).toBe("x")
		expect(r.get("FileDim", [1])).toBe(-5)
	})

	it("usa '=' come confronto nelle condizioni e supporta <>", () => {
		const r = exec("a=1\nif(a=1){b=2}else{b=3}\nif(a<>1) c=1 else c=4")
		expect(r.get("b")).toBe(2)
		expect(r.get("c")).toBe(4)
	})

	it("risolve i nomi di risorsa e global.*", () => {
		const r = exec("T=FileServer\nI=global.spr_portrait[24]\nB=global.spr_intrapol_logo")
		expect(r.get("T")).toBe("FileServer")
		expect(r.get("I")).toBe("spr_portrait:24")
		expect(r.get("B")).toBe("spr_intrapol_logo")
	})

	it("non interpreta il backslash nelle stringhe", () => {
		const r = exec('p="users\\"+"x"')
		expect(r.get("p")).toBe("users\\x")
	})

	it("esegue cicli for/while con break", () => {
		const r = exec("s=0\nfor(i=0;i<5;i+=1){s+=i}\nwhile(true){s+=100; break}")
		expect(r.get("s")).toBe(110)
	})

	it("valuta true/false e operatori logici", () => {
		const env = recordEnv(new GmlRecord())
		const e = (src: string): Value => {
			const p = parse(`x=${src}`)
			const s = p.body[0]
			if (s.kind !== "assign") throw new Error()
			return evaluate(s.value, env)
		}
		expect(e("true && !false")).toBe(1)
		expect(e("1 > 2 or 3 = 3")).toBe(1)
		expect(e("7 div 2")).toBe(3)
		expect(e("7 mod 2")).toBe(1)
	})
})

describe("file originali", () => {
	const files = walk(GAME).filter((f) => /\.(svr|miss|script|fak)$/.test(f))

	it("ci sono tutti i file importati", () => {
		expect(files.filter((f) => f.endsWith(".svr"))).toHaveLength(57)
		expect(files.filter((f) => f.endsWith(".miss"))).toHaveLength(42)
	})

	for (const file of files) {
		const name = relative(GAME, file).split("\\").join("/")
		it(`analizza ${name}`, () => {
			const src = readFileSync(file, "utf8")
			expect(() => parse(src)).not.toThrow()
			if (!file.endsWith(".script")) {
				expect(() => evalDefinition(src, { objects: { System: fakeSystem }, call: stubCall })).not.toThrow()
			}
		})
	}
})
