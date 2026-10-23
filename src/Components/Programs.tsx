// Programmi in flashram aperti dal menu applicazioni o dal comando run della console.
// L'identificativo del programma è il FileContents del file (mompad, uavsys, momamp, tut_hack…).
//
// rootbreaker, wavehacker, backmirror, fileforce e nukelord sono "tool" di finzione del gioco originale: agiscono solo
// sui server simulati in memoria dal motore (vedi engine/network.ts).

import { useEffect, useState, type ReactNode } from "react"
import { twMerge } from "tailwind-merge"
import { asset } from "@/assets"
import { playTrack, stopTrack, trackTime } from "@/audio"
import type { Task } from "@/engine/game"
import { useGame } from "@/hooks/useGame"
import { useApp } from "@/store/app"
import { Panel, Sprite, SpriteButton, TabButton } from "./ui"

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

// --- rootbreaker, wavehacker, backmirror, fileforce, nukelord ---

/** Avanzamento (0..1) della prima operazione a tempo che corrisponde, o null se non ce n'è */
function taskProgress(tasks: Task[], match: (t: Task) => boolean): number | null {
	const t = tasks.find(match)
	return t ? Math.min(1, t.elapsed / t.total) : null
}

function ProgressBar({ value }: { value: number }) {
	return (
		<div className="mt-1 h-[6px] border border-mo-line">
			<div className="h-full bg-mo-ok" style={{ width: `${value * 100}%` }} />
		</div>
	)
}

/** Esegue un'azione del motore e mostra l'eventuale errore */
function useAction() {
	const game = useGame()
	const showDialog = useApp((s) => s.showDialog)
	return (fn: () => string | null) => {
		const err = game.act(fn)
		if (err) showDialog(err)
	}
}

/** Rootbreaker: cracking dell'interfaccia di login del server connesso */
export function RootBreaker({ name, onClose }: { name: string; onClose: () => void }) {
	const game = useGame()
	const run = useAction()
	const net = game.network
	const host = net.host
	const breach = net.breach?.program === "rootbreaker" ? net.breach : null
	const progress = breach ? taskProgress(game.tasks, (t) => t.id === breach.taskId) : null
	const ready = !!host && net.needsAuth() && host.protection === "Login"

	let status: ReactNode
	if (!host) status = "Nessuna connessione attiva."
	else if (progress !== null)
		status = (
			<>
				<div>
					Cracking dell'account {net.adminOf(host)?.username}... {Math.round(progress * 100)}%
				</div>
				<ProgressBar value={progress} />
			</>
		)
	else if (net.connection?.forced) status = <span className="text-mo-ok">Accesso ottenuto come {net.connection.logged}.</span>
	else if (ready) status = `Interfaccia di login rilevata su ${host.name}.`
	else status = "Nessuna interfaccia di login rilevata."

	return (
		<div className="absolute top-[200px] left-[calc(50%-148px)] z-40 flex h-[83px] w-[296px] flex-col px-2.5 pt-0.5 pb-1.5">
			<div className="pointer-events-none absolute inset-0" style={{ background: `url("${asset("graphics/root_breaker.png")}")` }} />
			<div className="relative font-title text-[11px] text-mo-accent">{name}</div>
			<div className="relative mt-2 min-h-0 flex-1 text-[12px] leading-[14px]">{status}</div>
			<div className="relative flex justify-end gap-2">
				{breach ? (
					<TabButton onClick={() => game.act(() => net.abortBreach())}>Interrompi</TabButton>
				) : (
					<TabButton disabled={!ready} onClick={() => run(() => net.startCrack(name))}>
						Avvia Cracking
					</TabButton>
				)}
				<TabButton onClick={onClose}>Chiudi</TabButton>
			</div>
		</div>
	)
}

/** Wavehacker: registra la voce su una linea telefonica e la riproduce sulle interfacce VRLS */
export function WaveHacker({ name, onClose }: { name: string; onClose: () => void }) {
	const game = useGame()
	const run = useAction()
	const net = game.network
	const host = net.host
	const phone = !!net.phoneSample()
	const vrls = !!host && net.needsAuth() && host.protection === "VRLS"
	const breach = net.breach?.program === "wavehacker" ? net.breach : null
	const recording = taskProgress(game.tasks, (t) => t.kind === "call")
	const forging = breach ? taskProgress(game.tasks, (t) => t.id === breach.taskId) : null
	const samples = net.voiceSamples()

	let status: string
	if (recording !== null) status = `Registrazione della voce in corso... ${Math.round(recording * 100)}%`
	else if (forging !== null) status = `Riproduzione del campione vocale... ${Math.round(forging * 100)}%`
	else if (host && phone) status = `Linea telefonica attiva con ${host.name}: pronto a registrare.`
	else if (host && vrls) status = `Interfaccia di riconoscimento vocale (VRLS) rilevata su ${host.name}.`
	else if (net.connection?.forced) status = `Accesso ottenuto come ${net.connection.logged}.`
	else status = "Nessuna linea telefonica o interfaccia VRLS rilevata."

	return (
		<div className="absolute top-[180px] left-[calc(50%-204px)] z-40 h-[167px] w-[409px]">
			<div className="pointer-events-none absolute inset-0" style={{ background: `url("${asset("graphics/wavehacker_gui.png")}")` }} />
			<div className="absolute top-1 left-3 font-title text-[11px] text-mo-accent">{name}</div>
			<div className="absolute top-[22px] right-3 left-6 text-[12px] leading-[14px]">
				<div>{status}</div>
				<div className="truncate text-mo-accent">Campioni in Flashram: {samples.length ? samples.map((f) => f.name).join(", ") : "nessuno"}</div>
			</div>
			{/* Forma d'onda che si rivela con l'avanzamento */}
			<div className="absolute top-[69px] left-[20px] h-[68px] overflow-hidden" style={{ width: `${(recording ?? forging ?? 0) * 388}px` }}>
				<img src={asset("graphics/wavehacker_wav.png")} alt="" className="max-w-none" />
			</div>
			<div className="absolute right-2 bottom-1.5 flex gap-2">
				{vrls ? (
					<TabButton disabled={!!breach} onClick={() => run(() => net.startVoiceForge())}>
						Invia Campione
					</TabButton>
				) : (
					<TabButton disabled={!phone || recording !== null} onClick={() => run(() => net.recordVoice())}>
						Registra Voce
					</TabButton>
				)}
				<TabButton onClick={onClose}>Chiudi</TabButton>
			</div>
		</div>
	)
}

/** Fileforce: stato del server connesso e caricamenti in corso (si avviano con "Carica..." dal terminale) */
export function FileForce({ name, onClose }: { name: string; onClose: () => void }) {
	const game = useGame()
	const net = game.network
	const host = net.host
	const uploads = game.tasks.filter((t) => t.kind === "upload")

	let status: string
	if (!host) status = "Nessuna connessione attiva."
	else if (net.uploadTarget()) status = `${host.type ? `${host.type} ` : ""}${host.name} pronto: usa 'Carica...' dal terminale.`
	else if (net.needsAuth()) status = `${host.name}: autenticazione richiesta.`
	else status = `${host.name}: nessun File Server o Database Server rilevato.`

	return (
		<div className="absolute top-[150px] left-[calc(50%-148px)] z-40 flex h-[270px] w-[296px] flex-col px-2.5 pt-0.5 pb-1.5">
			<div className="pointer-events-none absolute inset-0" style={{ background: `url("${asset("graphics/fileforce.png")}")` }} />
			<div className="relative font-title text-[11px] text-mo-accent">{name} - Remote Upload</div>
			<div className="relative mt-2 text-[12px] leading-[14px]">{status}</div>
			<div className="mo-scroll relative mt-2 min-h-0 flex-1 overflow-y-auto text-[12px] leading-[14px]">
				{uploads.length === 0 && <div className="text-mo-accent">Nessun caricamento in corso.</div>}
				{uploads.map((t) => (
					<div key={t.id} className="mb-1.5">
						<div className="truncate">
							{t.label}... {Math.round(Math.min(1, t.elapsed / t.total) * 100)}%
						</div>
						<ProgressBar value={Math.min(1, t.elapsed / t.total)} />
					</div>
				))}
			</div>
			<div className="relative flex justify-end gap-2">
				<TabButton onClick={onClose}>Chiudi</TabButton>
			</div>
		</div>
	)
}

/** Nukelord: satura la banda del Web Server connesso (nukelord.png: titolo in alto, due righe chiare per stato e avanzamento) */
export function NukeLord({ name, onClose }: { name: string; onClose: () => void }) {
	const game = useGame()
	const run = useAction()
	const net = game.network
	const target = net.nukeTarget()
	const nuke = net.nuke
	const progress = nuke ? taskProgress(game.tasks, (t) => t.id === nuke.taskId) : null

	let status: string
	if (progress !== null) status = `Attacco in corso... ${Math.round(progress * 100)}%`
	else if (target) status = `${target.name}: ${target.net} MBps, liberi ${Math.round(game.netFree)} MBps`
	else if (net.host) status = "Il server connesso non è un Web Server."
	else status = "Nessuna connessione attiva."

	return (
		<div className="absolute top-[220px] left-[calc(50%-110px)] z-40 h-[145px] w-[220px]">
			<div className="pointer-events-none absolute inset-x-0 top-0 h-[119px]" style={{ background: `url("${asset("graphics/nukelord.png")}")` }} />
			<div className="absolute top-1 left-2.5 font-title text-[11px] text-mo-accent">{name}</div>
			<div className="absolute top-[57px] right-2 left-[24px] truncate text-[11px] leading-[19px] text-[#0b2a5e]" title={status}>
				{status}
			</div>
			<div className="absolute top-[90px] right-2 left-[24px] h-[19px] p-[5px]">
				<div className="h-full bg-mo-alert" style={{ width: `${(progress ?? 0) * 100}%` }} />
			</div>
			<div className="absolute right-0 bottom-0 flex gap-2">
				{nuke ? (
					<TabButton onClick={() => game.act(() => net.abortNuke())}>Interrompi</TabButton>
				) : (
					<TabButton disabled={!target} onClick={() => run(() => net.startNuke())}>
						Avvia Nuke
					</TabButton>
				)}
				<TabButton onClick={onClose}>Chiudi</TabButton>
			</div>
		</div>
	)
}

/** backmirror_led.png: 10 fotogrammi da 194 px, 0-5 spento, 6-9 rosso sempre più acceso */
const LED_FRAMES = 10

/** Backmirror: mostra l'avanzamento del backtrace sulla sessione in corso */
export function BackMirror({ name, onClose }: { name: string; onClose: () => void }) {
	const game = useGame()
	// Finché è aperto il backtrace rallenta (BACKMIRROR_TRACE_SPEED)
	useEffect(() => {
		const network = game.network
		network.setBackmirror(true)
		return () => network.setBackmirror(false)
	}, [game])
	const trace = game.network.connection?.trace
	const progress = trace ? Math.min(1, trace.elapsed / trace.total) : 0
	const frame = trace ? 6 + Math.min(3, Math.floor(progress * 4)) : 0
	const label = trace ? `Backtrace ${Math.round(progress * 100)}% - ${Math.ceil(trace.total - trace.elapsed)} s` : "Nessun backtrace rilevato"

	return (
		<div className="absolute top-[60px] left-[calc(50%-110px)] z-40 h-[39px] w-[220px]">
			<div className="pointer-events-none absolute inset-0" style={{ background: `url("${asset("graphics/backmirror.png")}")` }} />
			<div className="absolute top-[2px] left-2 font-title text-[10px] text-mo-accent">{name}</div>
			<button type="button" title="Chiudi" onClick={onClose} className="absolute top-0 right-3 cursor-pointer text-[11px] text-mo-accent hover:text-white">
				x
			</button>
			<Sprite name="backmirror_led" w={194} h={16} frames={LED_FRAMES} frame={frame} className="absolute top-[20px] left-[22px]" />
			<div className="absolute top-[21px] left-[22px] w-[194px] text-center text-[11px] leading-[14px] text-white">{label}</div>
		</div>
	)
}
