// Lexer per il sottoinsieme di GML (GameMaker 6) usato dai file di Mother.
// Particolarità di GML: le stringhe ("..." o '...') non hanno sequenze di escape e possono andare
// a capo; i fine riga non separano le istruzioni; ';' è facoltativo.

export type TokenType = "num" | "str" | "ident" | "op" | "punct" | "eof"

export interface Token {
	type: TokenType
	value: string
	line: number
}

export class GmlSyntaxError extends Error {
	line: number
	constructor(message: string, line: number) {
		super(`${message} (riga ${line})`)
		this.line = line
	}
}

// Operatori ordinati dal più lungo, così il match è greedy
const OPERATORS = ["+=", "-=", "*=", "/=", "==", "!=", "<>", "<=", ">=", "&&", "||", "^^", "=", "<", ">", "+", "-", "*", "/", "!", "&", "|", "^", "%"]
const PUNCT = new Set(["(", ")", "{", "}", "[", "]", ",", ".", ";"])

export function tokenize(src: string): Token[] {
	const tokens: Token[] = []
	let i = 0
	let line = 1
	const n = src.length

	while (i < n) {
		const c = src[i]

		if (c === "\n") {
			line++
			i++
			continue
		}
		if (c === " " || c === "\t" || c === "\r" || c === "﻿") {
			i++
			continue
		}
		// Commenti // e /* */
		if (c === "/" && src[i + 1] === "/") {
			while (i < n && src[i] !== "\n") i++
			continue
		}
		if (c === "/" && src[i + 1] === "*") {
			const start = line
			i += 2
			while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
				if (src[i] === "\n") line++
				i++
			}
			if (i >= n) throw new GmlSyntaxError("commento non chiuso", start)
			i += 2
			continue
		}
		// Stringhe
		if (c === '"' || c === "'") {
			const start = line
			const end = src.indexOf(c, i + 1)
			if (end < 0) throw new GmlSyntaxError("stringa non chiusa", start)
			const value = src.slice(i + 1, end)
			for (const ch of value) if (ch === "\n") line++
			tokens.push({ type: "str", value, line: start })
			i = end + 1
			continue
		}
		// Numeri (anche esadecimali $FF)
		if (isDigit(c) || (c === "." && isDigit(src[i + 1]))) {
			let j = i
			while (j < n && (isDigit(src[j]) || src[j] === ".")) j++
			tokens.push({ type: "num", value: src.slice(i, j), line })
			i = j
			continue
		}
		if (c === "$" && isHex(src[i + 1])) {
			let j = i + 1
			while (j < n && isHex(src[j])) j++
			tokens.push({ type: "num", value: String(parseInt(src.slice(i + 1, j), 16)), line })
			i = j
			continue
		}
		// Identificatori
		if (isIdentStart(c)) {
			let j = i
			while (j < n && isIdentPart(src[j])) j++
			tokens.push({ type: "ident", value: src.slice(i, j), line })
			i = j
			continue
		}
		// Operatori e punteggiatura
		const op = OPERATORS.find((o) => src.startsWith(o, i))
		if (op) {
			tokens.push({ type: "op", value: op, line })
			i += op.length
			continue
		}
		if (PUNCT.has(c)) {
			tokens.push({ type: "punct", value: c, line })
			i++
			continue
		}
		throw new GmlSyntaxError(`carattere inatteso '${c}'`, line)
	}

	tokens.push({ type: "eof", value: "", line })
	return tokens
}

function isDigit(c: string | undefined) {
	return c !== undefined && c >= "0" && c <= "9"
}
function isHex(c: string | undefined) {
	return c !== undefined && /[0-9a-fA-F]/.test(c)
}
function isIdentStart(c: string) {
	return /[A-Za-z_]/.test(c)
}
function isIdentPart(c: string) {
	return /[A-Za-z0-9_]/.test(c)
}
