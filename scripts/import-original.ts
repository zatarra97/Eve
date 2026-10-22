#!/usr/bin/env node
// Importa i contenuti del Mother originale in public/game/.
//
// Uso: npm run import -- <cartella installazione> [<cartella upgrade> ...]
// Le cartelle successive sovrascrivono le precedenti (es. 1.0 e poi upgrade 1.02).
// Ogni cartella è quella che contiene Mother.exe, cioè con dentro data/ ed extra/.
//
// - .svr / .miss / .script / chats.text: ricodificati da latin-1 a UTF-8, testo invariato
// - graphics.dat / sounds.dat / texts.dat: sono ZIP, estratti; i BMP diventano PNG
// - manifest.json: elenco dei file, perché il browser non può leggere le cartelle

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { basename, dirname, extname, join, relative, resolve } from "node:path"
import { unzipSync } from "fflate"
import sharp from "sharp"

const OUT = resolve("public/game")
const TEXT_EXT = new Set([".svr", ".miss", ".script", ".text", ".console", ".fak"])

const sources = process.argv.slice(2).map((s) => resolve(s))
if (sources.length === 0) {
	console.error("Uso: npm run import -- <cartella installazione Mother> [<cartella upgrade> ...]")
	process.exit(1)
}
for (const s of sources) {
	if (!existsSync(join(s, "data"))) {
		console.error(`Cartella non valida (manca data/): ${s}`)
		process.exit(1)
	}
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

// File di testo: latin-1 -> UTF-8, fine riga normalizzati a \n
function writeText(dest: string, raw: Uint8Array) {
	mkdirSync(dirname(dest), { recursive: true })
	const text = Buffer.from(raw).toString("latin1").replace(/\r\n?/g, "\n")
	writeFileSync(dest, text, "utf8")
}

// Decodifica di BMP 24 bit non compressi (gli unici presenti nel gioco) in RGBA grezzo.
// Il magenta puro (#FF00FF) è il colore trasparente degli sprite di GameMaker.
function decodeBmp(buf: Buffer) {
	if (buf.toString("ascii", 0, 2) !== "BM") throw new Error("non è un BMP")
	const offset = buf.readUInt32LE(10)
	const width = buf.readInt32LE(18)
	const rawHeight = buf.readInt32LE(22)
	const bpp = buf.readUInt16LE(28)
	const compression = buf.readUInt32LE(30)
	if (bpp !== 24 || compression !== 0) throw new Error(`BMP non supportato: ${bpp} bpp, compressione ${compression}`)
	const height = Math.abs(rawHeight)
	const bottomUp = rawHeight > 0
	const stride = Math.ceil((width * 3) / 4) * 4
	const rgba = Buffer.alloc(width * height * 4)
	for (let y = 0; y < height; y++) {
		const src = offset + (bottomUp ? height - 1 - y : y) * stride
		for (let x = 0; x < width; x++) {
			const s = src + x * 3
			const d = (y * width + x) * 4
			const r = buf[s + 2]
			const g = buf[s + 1]
			const b = buf[s]
			rgba[d] = r
			rgba[d + 1] = g
			rgba[d + 2] = b
			rgba[d + 3] = r === 255 && g === 0 && b === 255 ? 0 : 255
		}
	}
	return { rgba, width, height }
}

async function writeAsset(dest: string, raw: Uint8Array) {
	mkdirSync(dirname(dest), { recursive: true })
	const ext = extname(dest).toLowerCase()
	if (ext === ".bmp") {
		const { rgba, width, height } = decodeBmp(Buffer.from(raw))
		await sharp(rgba, { raw: { width, height, channels: 4 } })
			.png()
			.toFile(dest.slice(0, -4) + ".png")
	} else if (TEXT_EXT.has(ext)) {
		writeText(dest, raw)
	} else {
		writeFileSync(dest, raw)
	}
}

function walk(dir: string): string[] {
	if (!existsSync(dir)) return []
	return readdirSync(dir).flatMap((name) => {
		const p = join(dir, name)
		return statSync(p).isDirectory() ? walk(p) : [p]
	})
}

for (const src of sources) {
	console.log(`Import da ${src}`)
	const data = join(src, "data")

	// Server e missioni
	for (const sub of ["servers", "missions"]) {
		for (const file of walk(join(data, sub))) {
			if (!TEXT_EXT.has(extname(file).toLowerCase())) continue
			writeText(join(OUT, sub, relative(join(data, sub), file)), readFileSync(file))
		}
	}

	// Script di esempio (extra/*.script) e file batch/script di avvio, se presenti
	for (const file of walk(join(src, "extra"))) {
		if (extname(file).toLowerCase() === ".script") writeText(join(OUT, "scripts", basename(file)), readFileSync(file))
	}
	for (const name of ["autoexec.console", "autoexec.script"]) {
		const file = join(data, name)
		if (existsSync(file)) writeText(join(OUT, name), readFileSync(file))
	}

	// Archivi di risorse: ZIP con dentro graphics/, sounds/, texts/
	for (const dat of ["graphics.dat", "sounds.dat", "texts.dat"]) {
		const file = join(data, dat)
		if (!existsSync(file)) continue
		const entries = unzipSync(readFileSync(file))
		for (const [name, content] of Object.entries(entries)) {
			if (name.endsWith("/") || /thumbs\.db$/i.test(name)) continue
			await writeAsset(join(OUT, name), content)
		}
	}
}

// Manifest: percorsi relativi a public/game, con separatore '/'
const files = walk(OUT)
	.map((f) => relative(OUT, f).split("\\").join("/"))
	.sort()
const pick = (prefix: string, ext?: string) =>
	files.filter((f) => f.startsWith(prefix) && (!ext || f.endsWith(ext)))
const manifest = {
	servers: pick("servers/", ".svr"),
	missions: pick("missions/", ".miss"),
	scripts: pick("scripts/", ".script"),
	graphics: pick("graphics/"),
	sounds: pick("sounds/"),
	texts: pick("texts/"),
	autoexec: files.filter((f) => f.startsWith("autoexec.")),
}
writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, "\t") + "\n")

console.log(
	`Fatto: ${manifest.servers.length} server, ${manifest.missions.length} missioni, ` +
		`${manifest.scripts.length} script, ${manifest.graphics.length} immagini, ${manifest.sounds.length} suoni.`,
)
