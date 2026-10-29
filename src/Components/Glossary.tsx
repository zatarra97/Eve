// Glossario nell'interfaccia: i termini del gioco sottolineati nei testi, con un riquadro di
// spiegazione al passaggio del mouse (i termini collegati nel riquadro si aprono a loro volta),
// e la Guida, che raccoglie le voci già incontrate.

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react"
import { create } from "zustand"
import { GLOSSARY, findTerms, glossaryEntry, type GlossaryCategory } from "@/content/glossary"
import { MENTOR, TIPS, type TipId } from "@/content/tips"
import { useGame } from "@/hooks/useGame"
import { TabButton, Window } from "./ui"

const TIP_W = 270

interface TipState {
	tip: { id: string; x: number; y: number; above: boolean } | null
	/** Termine da cui è aperto il riquadro */
	anchor: HTMLElement | null
	/** Uscita del mouse dal termine o dal riquadro: si chiude dopo un attimo, se non ci si rientra */
	hideTimer: ReturnType<typeof setTimeout> | null
	show: (id: string, anchor: HTMLElement) => void
	/** Il termine sparisce dallo schermo (pannello chiuso o sostituito): il suo riquadro si chiude */
	detach: (anchor: HTMLElement) => void
	keep: () => void
	hide: () => void
	switchTo: (id: string) => void
}

const useTip = create<TipState>((set, get) => ({
	tip: null,
	anchor: null,
	hideTimer: null,
	show(id, anchor) {
		get().keep()
		// Coordinate logiche del desktop: il palco è riscalato per riempire la finestra
		const desktop = anchor.closest<HTMLElement>("[data-desktop]")
		if (!desktop) return
		const box = desktop.getBoundingClientRect()
		const scale = box.width / desktop.offsetWidth || 1
		const r = anchor.getBoundingClientRect()
		const left = (r.left - box.left) / scale
		const top = (r.top - box.top) / scale
		const bottom = (r.bottom - box.top) / scale
		const above = bottom > desktop.offsetHeight - 170
		set({ anchor, tip: { id, x: Math.max(4, Math.min(left, desktop.offsetWidth - TIP_W - 4)), y: above ? top - 4 : bottom + 4, above } })
	},
	detach(anchor) {
		if (get().anchor !== anchor) return
		get().keep()
		set({ tip: null, anchor: null })
	},
	keep() {
		const t = get().hideTimer
		if (t) clearTimeout(t)
		set({ hideTimer: null })
	},
	hide() {
		get().keep()
		set({ hideTimer: setTimeout(() => set({ tip: null, anchor: null, hideTimer: null }), 200) })
	},
	switchTo(id) {
		const tip = get().tip
		if (tip) set({ tip: { ...tip, id } })
	},
}))

/** Termine del glossario sottolineato: al passaggio del mouse mostra la spiegazione e lo sblocca nella Guida */
export function Term({ id, children }: { id: string; children: ReactNode }) {
	const game = useGame()
	const show = useTip((s) => s.show)
	const hide = useTip((s) => s.hide)
	const detach = useTip((s) => s.detach)
	const ref = useRef<HTMLSpanElement>(null)
	useEffect(() => {
		const el = ref.current
		return () => {
			if (el) detach(el)
		}
	}, [detach])
	return (
		<span
			ref={ref}
			className="cursor-help underline decoration-mo-accent/70 decoration-dotted underline-offset-2 hover:text-white"
			onMouseEnter={(e) => {
				show(id, e.currentTarget)
				game.act(() => game.learn(id))
			}}
			onMouseLeave={hide}
		>
			{children}
		</span>
	)
}

/** Testo con i termini del glossario evidenziati (solo la prima volta che compaiono, per non riempirlo di sottolineature) */
export function GlossaryText({ text }: { text: string }) {
	const seen = new Set<string>()
	const parts: ReactNode[] = []
	let pos = 0
	for (const m of findTerms(text)) {
		if (seen.has(m.id)) continue
		seen.add(m.id)
		parts.push(text.slice(pos, m.start), <Term key={m.start} id={m.id}>{text.slice(m.start, m.end)}</Term>)
		pos = m.end
	}
	parts.push(text.slice(pos))
	return (
		<>
			{parts.map((p, i) => (
				<Fragment key={i}>{p}</Fragment>
			))}
		</>
	)
}

/** Riquadro della spiegazione, unico per tutto il desktop (sopra pannelli e programmi) */
export function GlossaryTooltip() {
	const game = useGame()
	const tip = useTip((s) => s.tip)
	const keep = useTip((s) => s.keep)
	const hide = useTip((s) => s.hide)
	const switchTo = useTip((s) => s.switchTo)
	const entry = tip && glossaryEntry(tip.id)
	if (!tip || !entry) return null
	return (
		<div
			className="absolute z-[60] border border-mo-line bg-[#0b2f6e]/95 px-2 py-1.5 text-[12px] leading-[15px] shadow-[0_0_14px_#3a8fe055]"
			style={{ left: tip.x, top: tip.y, width: TIP_W, transform: tip.above ? "translateY(-100%)" : undefined }}
			onMouseEnter={keep}
			onMouseLeave={hide}
		>
			<div className="font-title text-[10px] tracking-[0.08em] text-mo-accent uppercase">{entry.term}</div>
			<div className="mt-0.5 text-white">{entry.short}</div>
			{!!entry.related?.length && (
				<div className="mt-1 text-[11px] text-mo-line">
					Vedi anche:{" "}
					{entry.related.map((id, i) => (
						<Fragment key={id}>
							{i > 0 && ", "}
							<button
								type="button"
								className="cursor-pointer text-mo-accent underline decoration-dotted underline-offset-2 hover:text-white"
								onClick={() => {
									switchTo(id)
									game.act(() => game.learn(id))
								}}
							>
								{glossaryEntry(id)?.term ?? id}
							</button>
						</Fragment>
					))}
				</div>
			)}
		</div>
	)
}

/** Voce della Guida con i consigli del mentore già ricevuti */
const TIPS_PAGE = "@consigli"

const CATEGORIES: GlossaryCategory[] = ["Il tuo sistema", "Account", "Network", "Server", "Protezioni", "Rischi", "Programmi"]

/** Guida: le voci del glossario già incontrate, per categoria */
export function Guide({ onClose }: { name: string; onClose: () => void }) {
	const game = useGame()
	const known = new Set(game.glossary)
	const entries = GLOSSARY.filter((e) => known.has(e.id))
	const [selected, setSelected] = useState<string | null>(entries[0]?.id ?? null)
	const detail = useRef<HTMLDivElement>(null)
	const entry = selected && selected !== TIPS_PAGE ? glossaryEntry(selected) : undefined
	const tips = (game.state.tipsSeen ?? []).filter((id): id is TipId => id in TIPS)

	function open(id: string) {
		game.act(() => game.learn(id))
		setSelected(id)
		detail.current?.scrollTo(0, 0)
	}

	return (
		<Window
			title={`Guida [${entries.length}/${GLOSSARY.length} voci scoperte]`}
			className="top-[110px] left-[calc(50%-280px)] h-[380px] w-[560px]"
			actions={<TabButton onClick={onClose}>Chiudi</TabButton>}
		>
			<div className="flex min-h-0 flex-1 gap-2 text-[12px] leading-[15px]">
				<div className="mo-scroll w-[170px] shrink-0 overflow-y-auto border border-mo-line-dim bg-[#071226]/60 py-0.5">
					{CATEGORIES.map((cat) => {
						const list = entries.filter((e) => e.category === cat)
						if (!list.length) return null
						return (
							<div key={cat} className="mb-1">
								<div className="px-1.5 font-title text-[9px] tracking-[0.12em] text-mo-line uppercase">{cat}</div>
								{list.map((e) => (
									<button
										key={e.id}
										type="button"
										onClick={() => open(e.id)}
										className={`block w-full cursor-pointer truncate px-2 text-left ${selected === e.id ? "bg-[#1b5fb0]/70 text-white" : "hover:bg-[#123e80]/60"}`}
									>
										{e.term}
									</button>
								))}
							</div>
						)
					})}
					{tips.length > 0 && (
						<div className="mb-1">
							<div className="px-1.5 font-title text-[9px] tracking-[0.12em] text-mo-line uppercase">Consigli</div>
							<button
								type="button"
								onClick={() => setSelected(TIPS_PAGE)}
								className={`block w-full cursor-pointer truncate px-2 text-left ${selected === TIPS_PAGE ? "bg-[#1b5fb0]/70 text-white" : "hover:bg-[#123e80]/60"}`}
							>
								Consigli di {MENTOR} ({tips.length})
							</button>
						</div>
					)}
					{!entries.length && <div className="px-1.5 text-mo-accent">Nessuna voce ancora: i termini sottolineati nelle mail si aggiungono qui.</div>}
				</div>
				<div ref={detail} className="mo-scroll min-h-0 flex-1 overflow-y-auto pr-1">
					{selected === TIPS_PAGE ? (
						tips.map((id) => (
							<p key={id} className="mb-1.5 border-l-2 border-mo-ok pl-1.5">
								{/* {class} resta generico: il consiglio mostrato riportava la classe del momento */}
								<GlossaryText text={TIPS[id].replace("{class}", "di una classe superiore")} />
							</p>
						))
					) : entry ? (
						<>
							<div className="font-title text-[12px] text-mo-accent">{entry.term}</div>
							<p className="mt-1 text-white">{entry.short}</p>
							{entry.long && <p className="mt-1.5">{entry.long}</p>}
							{!!entry.related?.length && (
								<div className="mt-2 text-mo-line">
									Vedi anche:{" "}
									{entry.related.map((id, i) => (
										<Fragment key={id}>
											{i > 0 && ", "}
											<button type="button" className="cursor-pointer text-mo-accent underline decoration-dotted underline-offset-2 hover:text-white" onClick={() => open(id)}>
												{glossaryEntry(id)?.term ?? id}
											</button>
										</Fragment>
									))}
								</div>
							)}
						</>
					) : (
						<div className="text-mo-accent">Passa il mouse sui termini sottolineati per scoprire cosa significano.</div>
					)}
				</div>
			</div>
		</Window>
	)
}
