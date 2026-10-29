// Tutorial guidato dell'interfaccia di Mother (testi e ordine dal tutorial originale,
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

const STEPS: Step[] = [
	{ text: "Benvenuto! Questo tutorial ha lo scopo di descriverti l'interfaccia utente di Mother e tutte le relative componenti. Clicca su 'Continua' per proseguire..." },
	{
		text: "Cominciamo con il Pulsante Applicazioni: attraverso di esso puoi accedere a tutte le interfacce e ai programmi installati nel sistema. È posizionato nella parte inferiore sinistra dello schermo: prova a cliccarci sopra...",
		target: ["apps"],
		until: (c) => c.menuOpen,
	},
	{
		text: "Il Pulsante Applicazioni apre questo menu di sistema. In alto trovi i programmi installati nella tua memoria, sotto le componenti di Mother. Ogni volta che installerai nuovi software verranno aggiunte ulteriori voci.",
		target: ["apps", "appsmenu"],
	},
	{ text: "Clicca nuovamente sul Pulsante Applicazioni per chiudere il menu di sistema...", target: ["apps", "appsmenu"], until: (c) => !c.menuOpen },
	{
		text: "In alto a destra c'è il Monitor di Sistema: riporta in tempo reale la percentuale di utilizzo dell'hardware, come il consumo di CPU e di banda, e lo spazio occupato nella memoria.",
		target: ["sysmon"],
	},
	{ text: "Il Monitor di Sistema può essere espanso, fornendo così maggiori informazioni. Clicca sul pulsante di espansione posto appena sotto gli indicatori...", target: ["sysmon-expand"], until: (c) => c.sysmonExpanded },
	{
		text: "Ora vedi il tipo di hardware installato e i consumi precisi, oltre allo stato del tuo account: l'indirizzo '@mother' ti identifica nel Network; il Ranking misura le tue capacità e la Classe la tua posizione nella comunità Underground; i Crediti sono la moneta del Network.",
		target: ["sysmon"],
	},
	{
		text: "Andiamo ora a vedere come navigare nel Network. Apri il menu con il Pulsante Applicazioni e clicca sulla voce 'Apri Network Map'...",
		target: ["apps", "appsmenu"],
		until: (c) => c.netmapOpen,
	},
	{
		text: "Questa è la mappa mondiale del Network: i server che conosci compaiono come icone bianche. Passandoci sopra con il mouse vedi nome, indirizzo IP e tipo di macchina. L'icona fissa rappresenta il tuo computer, in una posizione fittizia per mascherare i tuoi dati.",
		target: ["netmap"],
	},
	{
		text: "Per collegarti a un server devi impostare il nodo di connessione: clicca su una delle icone sulla mappa. Cliccando su più server in sequenza crei una connessione multinodo, più difficile da rintracciare ma più costosa in banda.",
		target: ["netmap"],
		until: (c) => c.game.network.pendingNodes.length > 0,
	},
	{ text: "Ora clicca sul pulsante 'Connetti' e attendi la fine della procedura di connessione...", target: ["netmap-connect"], until: (c) => c.game.network.connection?.status === "connected" },
	{
		text: "Perfetto, ti sei collegato al server. Ti viene mostrata l'interfaccia del Terminal Server, diversa in base al tipo di macchina: potrai leggere news, scaricare file, acquistare software o accedere a caselle di posta.",
		target: ["terminal"],
	},
	{ text: "Ora chiudi la connessione cliccando sulla voce 'Disconnetti' dal menu del Pulsante Applicazioni...", target: ["apps", "appsmenu"], until: (c) => !c.game.network.connection },
	{
		text: "Passiamo alla posta elettronica. L'icona in basso a destra mostra quanti messaggi non hai ancora letto: cliccaci sopra per aprire la casella di posta...",
		target: ["mail"],
		until: (c) => c.inboxOpen,
	},
	{
		text: "Qui trovi tutte le mail ricevute, dalla più recente. È appena arrivato un messaggio da 1ronCh4ng (se non lo vedi ancora attendi qualche istante): aprilo cliccandoci sopra...",
		target: ["inbox", "mail"],
		until: (c) => openMail(c)?.from.toLowerCase() === IRON,
	},
	{
		text: "Il messaggio si apre in alto a destra. 1ronCh4ng sembra voglia offrirti un aiuto: proviamo a rispondere alla sua lettera. Clicca sul pulsante 'Rispondi'...",
		target: ["mailpanel"],
		until: (c) => c.right?.kind === "compose",
	},
	{
		text: "Il testo della risposta si compila da solo. Se hai letto attentamente la mail avrai capito che 1ronCh4ng non gradisce allegati: non allegare nulla e inoltra la risposta cliccando su 'Invia'...",
		target: ["mailpanel"],
		until: (c) => c.game.state.mails.some((m) => m.sent && m.subject.toLowerCase().includes("piccoli lamer")),
	},
	{
		text: "Ottimo! Ora abbi pazienza, riceverai una risposta tra qualche istante. Quando arriva, aprila dalla casella di posta...",
		target: ["inbox", "mail"],
		until: (c) => openMail(c)?.subject === "Ecco l'aiuto...",
	},
	{
		text: "Il tuo amico ha allegato alla mail un programma: tutti gli allegati vengono salvati automaticamente nella memoria, e nel menu del Pulsante Applicazioni troverai la voce 'tut_hack-1.0'. Avvialo quando vuoi: ti spiegherà i primi passi nel Network.",
		target: ["mailpanel"],
	},
	{
		text: "Accanto alla posta c'è il Diario: elenca le missioni in corso, cosa devi fare e un suggerimento per farlo. Le parole sottolineate, come Banda, si spiegano da sole passandoci sopra il mouse, e restano nella Guida del menu Applicazioni.",
		target: ["journal"],
	},
	{
		text: "Il tutorial base di Mother si conclude qui. Segui le mail e il Diario; 1ronCh4ng ti darà qualche consiglio quando incontrerai qualcosa di nuovo. Buon divertimento!",
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
				<div className="mb-1 flex items-center justify-between font-title text-[9.5px] tracking-[0.12em] text-mo-line uppercase">
					<span>Tutorial</span>
					<span>
						{index + 1}/{STEPS.length}
					</span>
				</div>
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
