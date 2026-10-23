// Programmi in flashram aperti dal menu applicazioni o dal comando run della console.
// L'identificativo del programma è il FileContents del file (mompad, uavsys, momamp, tut_hack…).

import { useEffect, useState, type ReactNode } from "react"
import { twMerge } from "tailwind-merge"
import { asset } from "@/assets"
import { playTrack, stopTrack, trackTime } from "@/audio"
import { useGame } from "@/hooks/useGame"
import { Panel, SpriteButton, TabButton } from "./ui"

/** Finestra di un programma: titolo in alto, contenuto, pulsanti sotto a destra */
function Window({ title, className, actions, children }: { title: string; className?: string; actions: ReactNode; children: ReactNode }) {
	return (
		<Panel className={twMerge("absolute z-40 flex flex-col bg-[#071226]/95 p-1.5", className)}>
			<div className="mb-1 font-title text-[12px] text-mo-accent">{title}</div>
			<div className="flex min-h-0 flex-1 flex-col">{children}</div>
			<div className="mt-1 flex justify-end gap-2">{actions}</div>
		</Panel>
	)
}

/** MomPad: blocco note salvato con l'account */
export function MomPad({ onClose }: { onClose: () => void }) {
	const game = useGame()
	return (
		<Window title="MomPad" className="top-[120px] left-[calc(50%-250px)] h-[360px] w-[500px]" actions={<TabButton onClick={onClose}>Chiudi</TabButton>}>
			<textarea
				autoFocus
				value={game.state.notepad}
				onChange={(e) => game.act(() => (game.state.notepad = e.target.value))}
				className="mo-scroll min-h-0 flex-1 resize-none bg-transparent text-[12.5px] text-white outline-none"
				spellCheck={false}
			/>
		</Window>
	)
}

// --- UAVsys ---

/** Effetti dei virus sul sistema (Manuale §2.13, vedi engine/viruses.ts) */
const VIRUS_INFO: Record<string, string> = {
	virPitagora: "satura la banda della scheda di rete",
	virLupinVI: "sottrae crediti dal conto a intervalli casuali",
	virScreenHacker: "occupa parte della CPU",
	virMotherBreaker: "danneggia il modulo NETCONN e satura la banda",
	virMotherXucker: "danneggia il modulo NETCONN",
}

const SCAN_MS = 4000

type Scan = { phase: "idle" } | { phase: "scan"; progress: number } | { phase: "found"; viruses: string[] } | { phase: "clean"; removed: string[]; kept: string[] }

/** Underground Antivirus System: analisi del sistema e rimozione dei virus */
export function UAVsys({ name, onClose }: { name: string; onClose: () => void }) {
	const game = useGame()
	const [scan, setScan] = useState<Scan>({ phase: "idle" })
	const scanning = scan.phase === "scan"

	useEffect(() => {
		if (!scanning) return
		const start = performance.now()
		const id = setInterval(() => {
			const progress = Math.min(1, (performance.now() - start) / SCAN_MS)
			setScan(progress < 1 ? { phase: "scan", progress } : { phase: "found", viruses: [...game.viruses.active] })
		}, 100)
		return () => clearInterval(id)
	}, [scanning, game])

	function clean() {
		const removed = game.act(() => game.viruses.clean())
		setScan({ phase: "clean", removed, kept: [...game.viruses.active] })
	}

	let body: ReactNode
	if (scan.phase === "idle") body = <div>Sistema pronto per l'analisi. Clicca su 'Analizza...' per controllare la flashram.</div>
	else if (scan.phase === "scan")
		body = (
			<>
				<div>Analisi del sistema in corso... {Math.round(scan.progress * 100)}%</div>
				<div className="mt-2 h-[10px] border border-mo-line">
					<div className="h-full bg-mo-ok" style={{ width: `${scan.progress * 100}%` }} />
				</div>
			</>
		)
	else if (scan.phase === "found")
		body = scan.viruses.length ? (
			<>
				<div className="text-mo-alert">Rilevati {scan.viruses.length} virus:</div>
				{scan.viruses.map((v) => (
					<div key={v}>
						- {v}: {VIRUS_INFO[v]}
					</div>
				))}
			</>
		) : (
			<div className="text-mo-ok">Nessun virus rilevato. Il sistema è pulito.</div>
		)
	else
		body = (
			<>
				{scan.removed.length > 0 && <div className="text-mo-ok">Virus rimossi: {scan.removed.join(", ")}.</div>}
				{scan.kept.map((v) => (
					<div key={v} className="text-mo-alert">
						{v}: danni irreversibili al sistema, impossibile rimuoverlo.
					</div>
				))}
				{!scan.removed.length && !scan.kept.length && <div className="text-mo-ok">Il sistema è pulito.</div>}
			</>
		)

	return (
		<div className="absolute top-[140px] left-[calc(50%-155px)] z-40 flex h-[165px] w-[310px] flex-col px-2.5 pt-1.5 pb-2">
			<div className="pointer-events-none absolute inset-0" style={{ background: `url("${asset("graphics/uavsys.png")}")` }} />
			<div className="relative font-title text-[11px] text-mo-accent">{name} - Underground Antivirus System</div>
			<div className="mo-scroll relative mt-1.5 min-h-0 flex-1 overflow-y-auto text-[12px] leading-[14px]">{body}</div>
			<div className="relative mt-1 flex justify-end gap-2">
				{scan.phase === "found" && scan.viruses.length > 0 ? (
					<TabButton onClick={clean}>Rimuovi Virus</TabButton>
				) : (
					<TabButton disabled={scanning} onClick={() => setScan({ phase: "scan", progress: 0 })}>
						Analizza...
					</TabButton>
				)}
				<TabButton onClick={onClose}>Chiudi</TabButton>
			</div>
		</div>
	)
}

// --- MomAMP ---

const NO_TRACKS: string[] = []
const trackTitle = (path: string) => path.split("/").pop()!.replace(/\.[^.]+$/, "")
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`

/** Lettore delle musiche del gioco (public/game/sounds) */
export function MomAmp({ name, onClose }: { name: string; onClose: () => void }) {
	const game = useGame()
	const tracks = game.content.music ?? NO_TRACKS
	const [current, setCurrent] = useState(0)
	const [playing, setPlaying] = useState(false)
	const [time, setTime] = useState({ pos: 0, dur: 0 })

	// Il brano suona finché la finestra è aperta; a fine brano si passa al successivo
	useEffect(() => {
		if (!playing || !tracks.length) return
		const path = tracks[current]
		playTrack(game.content.assetsBase + path.split("/").map(encodeURIComponent).join("/"), () => setCurrent((i) => (i + 1) % tracks.length))
		const id = setInterval(() => setTime(trackTime()), 500)
		return () => {
			clearInterval(id)
			stopTrack()
			setTime({ pos: 0, dur: 0 })
		}
	}, [playing, current, tracks, game])

	const step = (d: number) => setCurrent((i) => (i + d + tracks.length) % tracks.length)
	const display = tracks.length ? `${current + 1}. ${trackTitle(tracks[current])}` : "nessun brano"

	return (
		<Window title={name} className="top-[120px] left-[calc(50%+180px)] w-[226px]" actions={<TabButton onClick={onClose}>Chiudi</TabButton>}>
			<div className="relative h-[27px] w-[200px] self-center" style={{ background: `url("${asset("graphics/momamp_display.png")}")` }}>
				<div className="absolute inset-x-1.5 top-[1px] truncate text-[11px] leading-[13px] text-mo-ok" title={display}>
					{display}
				</div>
				<div className="absolute right-1.5 bottom-[1px] text-[10px] leading-[11px] text-mo-accent">
					{playing ? `${mmss(time.pos)} / ${mmss(time.dur)}` : "stop"}
				</div>
			</div>
			<div className="mt-1.5 flex items-center justify-center gap-0.5">
				<SpriteButton name="momamp_prev" w={39} h={22} frames={2} title="Precedente" onClick={() => step(-1)} />
				<SpriteButton name="momamp_play" w={41} h={39} frames={2} active={playing} title="Play" onClick={() => setPlaying(true)} />
				<SpriteButton name="momamp_stop" w={39} h={22} frames={2} title="Stop" onClick={() => setPlaying(false)} />
				<SpriteButton name="momamp_next" w={39} h={22} frames={2} title="Successivo" onClick={() => step(1)} />
			</div>
			<div className="mo-scroll mt-1.5 max-h-[90px] overflow-y-auto border border-mo-line-dim text-[11.5px] leading-[15px]">
				{tracks.map((t, i) => (
					<button
						key={t}
						type="button"
						onDoubleClick={() => {
							setCurrent(i)
							setPlaying(true)
						}}
						onClick={() => setCurrent(i)}
						className={`block w-full cursor-pointer truncate px-1 text-left hover:text-mo-accent ${i === current ? "bg-[#123e80] text-white" : ""}`}
					>
						{i + 1}. {trackTitle(t)}
					</button>
				))}
			</div>
		</Window>
	)
}

// --- tut_hack ---

/** Istruzioni del programma allegato da 1ronCh4ng a fine tutorial (missione tut1) */
const TUT_HACK_PAGES = [
	"Ciao! Se stai leggendo queste righe vuol dire che hai seguito il mio consiglio. Questo programmino ti spiega come muovere i primi passi nel Network. Clicca su 'Avanti' per proseguire...",
	"Le informazioni sono tutto. Il modo più semplice per trovarle è collegarti a un Chat Server e leggere i log pubblici: lì la gente parla di server, indirizzi e, a volte, di credenziali dimenticate in giro. Annota tutto nel MomPad.",
	"Molti server sono protetti da un'interfaccia di autenticazione. Se conosci username e password puoi accedere normalmente; alcuni server usano invece una chiave cifrata, che deve trovarsi nella tua flashram al momento della connessione.",
	"Ogni accesso non autorizzato è un reato, e Intrapol non dorme mai: più nodi metti tra te e il server di destinazione, più sarà difficile rintracciarti. Ricorda però che la banda consumata cresce con ogni nodo, quindi non saturarla!",
	"Dalla console puoi fare cose che la Network Map non permette: 'resolve <servername>' aggiunge alla mappa un server di cui conosci il nome, 'connect <ip>' ti collega direttamente a un indirizzo, 'ls' e 'run' gestiscono i programmi in flashram. Scrivi 'help' per l'elenco completo.",
	"Sui Software Server dell'Underground trovi strumenti utili, e anche qualche brutta sorpresa: i download poco sicuri possono contenere virus. Procurati un antivirus come UAVsys e usalo spesso.",
	"Per ora è tutto. Il resto lo imparerai sul campo: rispondi alle mail, accetta i lavori che ti vengono proposti e fatti un nome. Buona fortuna! -- 1ronCh4ng",
]

export function TutHack({ name, onClose }: { name: string; onClose: () => void }) {
	const [page, setPage] = useState(0)
	const last = page === TUT_HACK_PAGES.length - 1
	return (
		<Window
			title={`${name} [${page + 1}/${TUT_HACK_PAGES.length}]`}
			className="top-[300px] left-[calc(50%-200px)] h-[150px] w-[400px]"
			actions={
				<>
					<TabButton disabled={page === 0} onClick={() => setPage(page - 1)}>
						Indietro
					</TabButton>
					<TabButton onClick={last ? onClose : () => setPage(page + 1)}>{last ? "Chiudi" : "Avanti"}</TabButton>
				</>
			}
		>
			<div className="mo-scroll min-h-0 flex-1 overflow-y-auto text-[12.5px] leading-[16px] whitespace-pre-wrap">{TUT_HACK_PAGES[page]}</div>
		</Window>
	)
}
