// Parser GML → AST. Copre ciò che serve ai file di Mother e agli script delle mod:
// assegnamenti (anche indicizzati e composti), chiamate, if/else, while, do/until, for, repeat,
// blocchi, var, exit/break/continue/return. Nelle espressioni '=' è un confronto, come in GML.

import { GmlSyntaxError, tokenize, type Token } from "./lexer"

export type Expr =
	| { kind: "num"; value: number }
	| { kind: "str"; value: string }
	| { kind: "ident"; name: string }
	| { kind: "member"; object: Expr; name: string }
	| { kind: "index"; target: Expr; index: Expr[] }
	| { kind: "call"; callee: string; args: Expr[]; line: number }
	| { kind: "unary"; op: string; arg: Expr }
	| { kind: "binary"; op: string; left: Expr; right: Expr }

export type LValue = Extract<Expr, { kind: "ident" | "member" | "index" }>

export type Stmt =
	| { kind: "assign"; target: LValue; op: string; value: Expr; line: number }
	| { kind: "expr"; expr: Expr; line: number }
	| { kind: "if"; cond: Expr; then: Stmt; else?: Stmt }
	| { kind: "while"; cond: Expr; body: Stmt }
	| { kind: "do"; body: Stmt; until: Expr }
	| { kind: "for"; init?: Stmt; cond?: Expr; step?: Stmt; body: Stmt }
	| { kind: "repeat"; count: Expr; body: Stmt }
	| { kind: "block"; body: Stmt[] }
	| { kind: "var"; names: string[] }
	| { kind: "exit" }
	| { kind: "break" }
	| { kind: "continue" }
	| { kind: "return"; value?: Expr }

export interface Program {
	body: Stmt[]
}

const ASSIGN_OPS = new Set(["=", "+=", "-=", "*=", "/="])
const KEYWORDS = new Set(["if", "else", "then", "while", "do", "until", "for", "repeat", "var", "exit", "break", "continue", "return", "begin", "end"])

// Livelli di precedenza, dal più basso al più alto
const BINARY_LEVELS: string[][] = [
	["||", "or"],
	["&&", "and"],
	["^^", "xor"],
	["=", "==", "!=", "<>", "<", "<=", ">", ">="],
	["|", "&", "^"],
	["+", "-"],
	["*", "/", "div", "mod", "%"],
]
const WORD_OPS = new Set(["or", "and", "xor", "div", "mod", "not"])

export function parse(src: string): Program {
	return new Parser(tokenize(src)).program()
}

class Parser {
	private pos = 0
	private tokens: Token[]

	constructor(tokens: Token[]) {
		this.tokens = tokens
	}

	program(): Program {
		const body: Stmt[] = []
		while (!this.at("eof")) body.push(this.statement())
		return { body }
	}

	// --- utilità ---

	private peek(offset = 0): Token {
		return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)]
	}
	private next(): Token {
		return this.tokens[this.pos++]
	}
	private at(type: Token["type"], value?: string): boolean {
		const t = this.peek()
		return t.type === type && (value === undefined || t.value === value)
	}
	private atWord(word: string): boolean {
		const t = this.peek()
		return t.type === "ident" && t.value.toLowerCase() === word
	}
	private eat(type: Token["type"], value?: string): boolean {
		if (this.at(type, value)) {
			this.pos++
			return true
		}
		return false
	}
	private expect(type: Token["type"], value?: string): Token {
		const t = this.peek()
		if (!this.at(type, value)) throw new GmlSyntaxError(`atteso '${value ?? type}', trovato '${t.value || t.type}'`, t.line)
		return this.next()
	}
	private skipSemicolons() {
		while (this.eat("punct", ";"));
	}

	// --- istruzioni ---

	private statement(): Stmt {
		this.skipSemicolons()
		const t = this.peek()
		let stmt: Stmt

		if (this.at("punct", "{") || this.atWord("begin")) {
			stmt = this.block()
		} else if (this.atWord("if")) {
			this.next()
			const cond = this.expression()
			if (this.atWord("then")) this.next()
			const then = this.statement()
			this.skipSemicolons()
			let otherwise: Stmt | undefined
			if (this.atWord("else")) {
				this.next()
				otherwise = this.statement()
			}
			stmt = { kind: "if", cond, then, else: otherwise }
		} else if (this.atWord("while")) {
			this.next()
			const cond = this.expression()
			if (this.atWord("do")) this.next()
			stmt = { kind: "while", cond, body: this.statement() }
		} else if (this.atWord("do")) {
			this.next()
			const body = this.statement()
			this.skipSemicolons()
			if (!this.atWord("until")) throw new GmlSyntaxError("atteso 'until'", this.peek().line)
			this.next()
			stmt = { kind: "do", body, until: this.expression() }
		} else if (this.atWord("for")) {
			this.next()
			this.expect("punct", "(")
			const init = this.at("punct", ";") ? undefined : this.simpleStatement()
			this.expect("punct", ";")
			const cond = this.at("punct", ";") ? undefined : this.expression()
			this.expect("punct", ";")
			const step = this.at("punct", ")") ? undefined : this.simpleStatement()
			this.expect("punct", ")")
			stmt = { kind: "for", init, cond, step, body: this.statement() }
		} else if (this.atWord("repeat")) {
			this.next()
			const count = this.expression()
			stmt = { kind: "repeat", count, body: this.statement() }
		} else if (this.atWord("var")) {
			this.next()
			const names = [this.expect("ident").value]
			while (this.eat("punct", ",")) names.push(this.expect("ident").value)
			stmt = { kind: "var", names }
		} else if (this.atWord("exit")) {
			this.next()
			stmt = { kind: "exit" }
		} else if (this.atWord("break")) {
			this.next()
			stmt = { kind: "break" }
		} else if (this.atWord("continue")) {
			this.next()
			stmt = { kind: "continue" }
		} else if (this.atWord("return")) {
			this.next()
			const value = this.at("punct", ";") || this.at("punct", "}") || this.at("eof") ? undefined : this.expression()
			stmt = { kind: "return", value }
		} else if (t.type === "eof") {
			throw new GmlSyntaxError("fine file inattesa", t.line)
		} else {
			stmt = this.simpleStatement()
		}

		this.skipSemicolons()
		return stmt
	}

	private block(): Stmt {
		const closeWord = this.atWord("begin")
		this.next()
		const body: Stmt[] = []
		for (;;) {
			this.skipSemicolons()
			if (closeWord ? this.atWord("end") : this.at("punct", "}")) break
			if (this.at("eof")) throw new GmlSyntaxError("blocco non chiuso", this.peek().line)
			body.push(this.statement())
		}
		this.next()
		return { kind: "block", body }
	}

	// Assegnamento o chiamata
	private simpleStatement(): Stmt {
		const line = this.peek().line
		const target = this.postfix()
		const t = this.peek()
		if (t.type === "op" && ASSIGN_OPS.has(t.value)) {
			if (target.kind !== "ident" && target.kind !== "member" && target.kind !== "index")
				throw new GmlSyntaxError("assegnamento a un'espressione non valida", line)
			this.next()
			return { kind: "assign", target, op: t.value, value: this.expression(), line }
		}
		if (target.kind !== "call") throw new GmlSyntaxError(`istruzione non valida vicino a '${t.value || t.type}'`, line)
		return { kind: "expr", expr: target, line }
	}

	// --- espressioni ---

	expression(level = 0): Expr {
		if (level >= BINARY_LEVELS.length) return this.unary()
		let left = this.expression(level + 1)
		for (;;) {
			const t = this.peek()
			const op = t.type === "op" || (t.type === "ident" && WORD_OPS.has(t.value.toLowerCase())) ? t.value.toLowerCase() : null
			if (op === null || !BINARY_LEVELS[level].includes(op)) return left
			this.next()
			left = { kind: "binary", op: normalizeOp(op), left, right: this.expression(level + 1) }
		}
	}

	private unary(): Expr {
		if (this.at("op", "!") || this.atWord("not")) {
			this.next()
			return { kind: "unary", op: "!", arg: this.unary() }
		}
		if (this.at("op", "-") || this.at("op", "+")) {
			const op = this.next().value
			return { kind: "unary", op, arg: this.unary() }
		}
		return this.postfix()
	}

	private postfix(): Expr {
		let expr = this.primary()
		for (;;) {
			if (this.at("punct", ".")) {
				this.next()
				expr = { kind: "member", object: expr, name: this.expect("ident").value }
			} else if (this.at("punct", "[")) {
				this.next()
				const index = [this.expression()]
				while (this.eat("punct", ",")) index.push(this.expression())
				this.expect("punct", "]")
				expr = { kind: "index", target: expr, index }
			} else {
				return expr
			}
		}
	}

	private primary(): Expr {
		const t = this.next()
		switch (t.type) {
			case "num":
				return { kind: "num", value: Number(t.value) }
			case "str":
				return { kind: "str", value: t.value }
			case "punct":
				if (t.value === "(") {
					const e = this.expression()
					this.expect("punct", ")")
					return e
				}
				break
			case "ident": {
				const lower = t.value.toLowerCase()
				if (lower === "true") return { kind: "num", value: 1 }
				if (lower === "false") return { kind: "num", value: 0 }
				if (KEYWORDS.has(lower)) break
				if (this.at("punct", "(")) {
					this.next()
					const args: Expr[] = []
					if (!this.at("punct", ")")) {
						args.push(this.expression())
						while (this.eat("punct", ",")) args.push(this.expression())
					}
					this.expect("punct", ")")
					return { kind: "call", callee: t.value, args, line: t.line }
				}
				return { kind: "ident", name: t.value }
			}
		}
		throw new GmlSyntaxError(`espressione inattesa '${t.value || t.type}'`, t.line)
	}
}

function normalizeOp(op: string): string {
	switch (op) {
		case "or":
			return "||"
		case "and":
			return "&&"
		case "xor":
			return "^^"
		case "==":
			return "="
		case "<>":
			return "!="
		case "%":
			return "mod"
		default:
			return op
	}
}
