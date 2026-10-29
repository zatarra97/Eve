// Tutorial guidato dell'interfaccia di Mother (ridotto rispetto al tutorial originale descritto in
// docs/riferimento-originale.md). Lo schermo si scurisce e resta illuminata solo la parte di cui
// si sta parlando; le zone scure non sono cliccabili. I passi che chiedono un'azione avanzano da
// soli quando l'azione è fatta, gli altri con "Continua".

import { useEffect, useRef, useState } from "react"
import type { Game } from "@/engine/game"
import { useGame } from "@/hooks/useGame"
import { useApp, type RightPanel } from "@/store/app"
import { GlossaryText } from "./Glossary"
import { TabButton, Typewriter } from "./ui"

interface Ctx {
	game: Game
	menuOpen: boolean
	sysmonExpanded: boolean
	netmapOpen: boolean
	inboxOpen: boolean
	right: RightPanel
}

interface Step {
	text: string
	/** Elementi da illuminare (attributo data-tut); vuoto = nessuno */
	target?: string[]
	/** Il passo avanza da solo quando la condizione è vera; senza, serve "Continua" */
	until?: (c: Ctx) => boolean
}

const IRON = "1ronch4ng@mother"
const openMail = (c: Ctx) => (c.right?.kind === "mail" ? c.game.state.mails.find((m) => m.id === (c.right as { id: number }).id) : undefined)

// Al massimo 10 passi, solo l'essenziale per muoversi: il resto lo spiegano Diario, Guida e i
// consigli di 1ronCh4ng quando serve.
const STEPS: Step[] = [
	{
		text: "Benvenuto in Mother! Ti mostro le basi in pochi passi. Il Pulsante Applicazioni, in basso a sinistra, apre i programmi e le funzioni del sistema: cliccalo...",
		target: ["apps"],
		until: (c) => c.menuOpen,
	},
	{
		text: "Qui trovi le funzioni di Mother; i programmi che installerai compariranno in alto. Clicca su 'Apri Network Map'...",
		target: ["apps", "appsmenu"],
		until: (c) => c.netmapOpen,
	},
	{
		text: "Questa è la Network Map: ogni icona è un server che conosci. Clicca su un server per sceglierlo come destinazione...",
		target: ["netmap"],
		until: (c) => c.game.network.pendingNodes.length > 0,
	},
	{ text: "Ora premi 'Connetti' e attendi la fine della connessione...", target: ["netmap-connect"], until: (c) => c.game.network.connection?.status === "connected" },
	{
		text: "Sei collegato! Ogni server ha la sua interfaccia: news, file, negozi, posta. Per uscire, apri il Pulsante Applicazioni e scegli 'Disconnetti'...",
		target: ["apps", "appsmenu"],
		until: (c) => !c.game.network.connection,
	},
	{
		text: "Ti è arrivata una mail: clicca sull'icona della posta in basso a destra...",
		target: ["mail"],
		until: (c) => c.inboxOpen,
	},
	{
		text: "Apri il messaggio di 1ronCh4ng (se non c'è ancora, attendi qualche istante)...",
		target: ["inbox", "mail"],
		until: (c) => openMail(c)?.from.toLowerCase() === IRON,
	},
	{
		text: "1ronCh4ng vuole aiutarti: premi 'Rispondi' e poi 'Invia'. Il testo si compila da solo; non allegare nulla...",
		target: ["mailpanel"],
		until: (c) => c.game.state.mails.some((m) => m.sent && m.subject.toLowerCase().includes("piccoli lamer")),
	},
	{
		text: "Accanto alla posta c'è il Diario: ti dice sempre cosa fare e come. Le parole sottolineate si spiegano passandoci sopra il mouse.",
		target: ["journal"],
	},
	{
		text: "Fatto! 1ronCh4ng ti risponderà a breve. Segui le mail e il Diario: al resto penseremo strada facendo. Buon divertimento!",
	},
]

interface Rect {
	x: number
	y: number
	w: number
	h: number
}

const PAD = 5

/** Rettangolo (in coordinate del palco) che contiene tutti gli elementi indicati */
function measure(root: HTMLElement, targets: string[]): Rect | null {
	const base = root.getBoundingClientRect()
	const scale = base.width / root.offsetWidth || 1
	let box: { l: number; t: number; r: number; b: number } | null = null
	for (const t of targets) {
		for (const el of document.querySelectorAll<HTMLElement>(`[data-tut="${t}"]`)) {
			const r = el.getBoundingClientRect()
			if (!r.width || !r.height) continue
			const l = (r.left - base.left) / scale
			const tp = (r.top - base.top) / scale
			const rr = l + r.width / scale
			const bb = tp + r.height / scale
			box = box ? { l: Math.min(box.l, l), t: Math.min(box.t, tp), r: Math.max(box.r, rr), b: Math.max(box.b, bb) } : { l, t: tp, r: rr, b: bb }
		}
	}
	if (!box) return null
	return { x: box.l - PAD, y: box.t - PAD, w: box.r - box.l + PAD * 2, h: box.b - box.t + PAD * 2 }
}

export default function Tutorial({ onClose }: { onClose: () => void }) {
	const game = useGame()
	const menuOpen = useApp((s) => s.menuOpen)
	const sysmonExpanded = useApp((s) => s.sysmonExpanded)
	const netmapOpen = useApp((s) => s.netmapOpen)
	const inboxOpen = useApp((s) => s.inboxOpen)
	const right = useApp((s) => s.right)
	const [index, setIndex] = useState(0)
	const [hole, setHole] = useState<Rect | null>(null)
	const rootRef = useRef<HTMLDivElement>(null)

	const step = STEPS[index]
	const last = index === STEPS.length - 1
	const done = step.until?.({ game, menuOpen, sysmonExpanded, netmapOpen, inboxOpen, right }) ?? false

	// I passi con un'azione avanzano da soli, con una breve pausa per vedere l'effetto
	useEffect(() => {
		if (!done || last) return
		const id = setTimeout(() => setIndex((i) => i + 1), 600)
		return () => clearTimeout(id)
	}, [done, last])

	// Gli elementi si spostano e cambiano dimensione (menu, mappa, pannelli): si rimisurano spesso
	useEffect(() => {
		const update = () => {
			const root = rootRef.current
			const next = root && step.target ? measure(root, step.target) : null
			setHole((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
		}
		update()
		const id = setInterval(update, 120)
		return () => clearInterval(id)
	}, [step])

	const dim = "absolute bg-black/65 pointer-events-auto"

	return (
		<div ref={rootRef} className="pointer-events-none absolute inset-0 z-[60]">
			{hole ? (
				<>
					{/* Quattro pannelli scuri intorno alla zona illuminata: bloccano i click altrove */}
					<div className={dim} style={{ left: 0, top: 0, right: 0, height: Math.max(0, hole.y) }} />
					<div className={dim} style={{ left: 0, top: hole.y + hole.h, right: 0, bottom: 0 }} />
					<div className={dim} style={{ left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.h }} />
					<div className={dim} style={{ left: hole.x + hole.w, top: hole.y, right: 0, height: hole.h }} />
					<div
						className="absolute animate-pulse rounded-[2px] border-2 border-mo-accent shadow-[0_0_14px_#6fb8ff,inset_0_0_10px_#6fb8ff66] transition-all duration-200"
						style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }}
					/>
				</>
			) : (
				<div className={`${dim} inset-0 bg-black/45`} />
			)}

			<div
				className="pointer-events-auto absolute bottom-1.5 left-1/2 w-[420px] -translate-x-1/2 border border-mo-line bg-[#06173a]/90 p-2 text-[12.5px] leading-[16px] shadow-[0_0_18px_#3a8fe055] backdrop-blur-[3px]"
				style={{ clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)" }}
			>
				<div className="mb-1 font-title text-[9.5px] tracking-[0.12em] text-mo-line uppercase">Tutorial</div>
				<div className="min-h-[64px] text-white">
					<Typewriter key={index} text={step.text} done={(t) => <GlossaryText text={t} />} />
				</div>
				<div className="mt-1.5 flex items-center justify-between">
					<button type="button" className="cursor-pointer text-[11px] text-mo-line hover:text-mo-accent" onClick={onClose}>
						Esci dal tutorial
					</button>
					{last ? (
						<TabButton onClick={onClose}>Chiudi</TabButton>
					) : step.until ? (
						<span className="text-[11px] text-mo-accent">{done ? "Fatto!" : "In attesa della tua azione..."}</span>
					) : (
						<TabButton onClick={() => setIndex((i) => i + 1)}>Continua</TabButton>
					)}
				</div>
			</div>
		</div>
	)
}
