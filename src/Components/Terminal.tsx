// Terminale del server connesso: WelcomeText in alto e sotto l'interfaccia del tipo di server
// (ServerState.terminal). I server protetti mostrano prima l'interfaccia di autenticazione.
// Il significato dei campi dei file dipende dal terminale (Modding HOW-TO §2.4, vedi shop.ts).

import { useState, type ReactNode } from "react"
import { asset } from "@/assets"
import type { Game } from "@/engine/game"
import { formatRemaining } from "@/engine/missgen"
import { acceptSubscription, buyHardware, buySoftware } from "@/engine/shop"
import type { GameFile, ServerState } from "@/engine/types"
import { useGame } from "@/hooks/useGame"
import { useApp } from "@/store/app"
import { Panel, Sprite, TabButton } from "./ui"

/** Lista con scrollbar e pulsanti sotto a destra (nell'originale x 8-760, y 60-362) */
function Frame({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
	return (
		<>
			<Panel className="mo-scroll mt-2 h-[302px] overflow-y-auto p-1.5">{children}</Panel>
			{actions && <div className="mt-1 flex justify-end gap-2">{actions}</div>}
		</>
	)
}

/** Voce di lista con l'icona a rombo; selezionabile con un clic */
function Item({ selected, onClick, children }: { selected?: boolean; onClick: () => void; children: ReactNode }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`flex w-full cursor-pointer items-start gap-1.5 text-left leading-[16px] hover:text-mo-accent ${selected ? "bg-[#123e80] text-white" : ""}`}
		>
			<Sprite name="list_item" w={12} h={12} frames={3} frame={selected ? 1 : 0} className="mt-0.5 shrink-0" />
			<span className="min-w-0 flex-1">{children}</span>
		</button>
	)
}

function Empty({ children }: { children: ReactNode }) {
	return <div className="text-mo-accent">{children}</div>
}

/** Testo di un file con il pulsante per tornare alla lista */
function Reader({ title, onBack, onDelete, children }: { title: string; onBack: () => void; onDelete?: () => void; children: ReactNode }) {
	return (
		<Frame
			actions={
				<>
					{onDelete && <TabButton onClick={onDelete}>Elimina...</TabButton>}
					<TabButton onClick={onBack}>Indietro</TabButton>
				</>
			}
		>
			<div className="mb-2 text-mo-accent">{title}</div>
			{children}
		</Frame>
	)
}

/** Selezione nella lista e file aperto in lettura */
function useSelection() {
	const [selected, setSelected] = useState<GameFile | null>(null)
	const [open, setOpen] = useState<GameFile | null>(null)
	return { selected, setSelected, open, setOpen }
}

/** Elimina un file del server connesso; se ci riesce richiama onDone (es. per tornare all'elenco) */
function useDeleteRemote() {
	const game = useGame()
	const showDialog = useApp((s) => s.showDialog)
	return (file: GameFile, onDone: () => void) => {
		if (game.act(() => game.network.deleteRemoteFile(file))) onDone()
		else showDialog("Impossibile eliminare un file di sistema.")
	}
}

/** Esegue un'azione del motore e mostra l'eventuale messaggio di errore (o di esito) */
function useRun() {
	const game = useGame()
	const showDialog = useApp((s) => s.showDialog)
	return (fn: (game: Game) => string | null, ok?: string) => {
		const err = game.act(() => fn(game))
		if (err) showDialog(err)
		else if (ok) showDialog(ok)
	}
}

// --- autenticazione ---

function LoginView({ host }: { host: ServerState }) {
	const game = useGame()
	const showDialog = useApp((s) => s.showDialog)
	const [user, setUser] = useState("")
	const [password, setPassword] = useState("")

	function submit() {
		if (!game.act(() => game.network.login(user, password))) showDialog("Accesso negato: credenziali non valide.")
	}

	function sendKey() {
		if (!game.act(() => game.network.loginWithKeyFile())) showDialog("Accesso negato: nessun file chiave valido presente in Flashram.")
	}

	if (host.protection === "VRLS")
		return (
			<div className="mt-2 w-[360px] border border-mo-line bg-[#071533]/90 p-2.5">
				<div className="font-title text-[11px] tracking-wide text-[#cfd8e6]">RICONOSCIMENTO VOCALE RICHIESTO</div>
				<div className="mt-3 text-mo-accent">L'accesso a questo server è protetto da un'interfaccia VRLS: è richiesta la voce di un utente autorizzato.</div>
			</div>
		)

	if (host.protection === "KeyFile")
		return (
			<div className="mt-2 w-[360px] border border-mo-line bg-[#071533]/90 p-2.5">
				<div className="font-title text-[11px] tracking-wide text-[#cfd8e6]">CHIAVE CIFRATA RICHIESTA</div>
				<div className="mt-3 text-mo-accent">L'accesso a questo server richiede l'invio di un file chiave presente in Flashram.</div>
				<div className="mt-3 flex justify-end">
					<TabButton onClick={sendKey}>Invia File Chiave...</TabButton>
				</div>
			</div>
		)

	return (
		<div className="mt-2 w-[249px]">
			<div className="h-[115px] border border-mo-line bg-[#071533]/90">
				<div className="mt-2 ml-2.5 font-title text-[11px] tracking-wide text-[#cfd8e6]">LOGIN RICHIESTO</div>
				<form
					className="mt-4 ml-4 grid grid-cols-[70px_1fr] items-center gap-y-1.5 pr-3 text-mo-accent"
					onSubmit={(e) => {
						e.preventDefault()
						submit()
					}}
				>
					<label htmlFor="mo-srv-user">Username:</label>
					<input
						id="mo-srv-user"
						autoFocus
						value={user}
						onChange={(e) => setUser(e.target.value)}
						className="bg-transparent text-white caret-white outline-none"
						autoComplete="off"
						spellCheck={false}
						// credenziali di gioco: niente suggerimenti dei password manager
						data-1p-ignore
						data-lpignore="true"
						data-bwignore
					/>
					<label htmlFor="mo-srv-pass">Password:</label>
					<input
						id="mo-srv-pass"
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						className="bg-transparent text-white caret-white outline-none"
						autoComplete="off"
						data-1p-ignore
						data-lpignore="true"
						data-bwignore
					/>
					<button type="submit" className="hidden" />
				</form>
			</div>
			<div className="mt-1 flex justify-end">
				<TabButton className="w-[114px]" onClick={submit}>
					Login...
				</TabButton>
			</div>
		</div>
	)
}

// --- caricamento con fileforce (File Server e Database Server) ---

/** Scelta del file da caricare aperta? Si chiude da sola se fileforce sparisce dalla flashram */
function useUploadPicker(): [boolean, (open: boolean) => void] {
	const game = useGame()
	const [picking, setPicking] = useState(false)
	return [picking && !!game.hasProgram("fileforce"), setPicking]
}

/** "Carica...": solo con fileforce in flashram */
function UploadButton({ onClick }: { onClick: () => void }) {
	const game = useGame()
	return game.hasProgram("fileforce") ? <TabButton onClick={onClick}>Carica...</TabButton> : null
}

/** Elenco della flashram da cui scegliere il file da caricare sul server connesso */
function UploadPicker({ onClose }: { onClose: () => void }) {
	const game = useGame()
	const run = useRun()
	const [local, setLocal] = useState<GameFile | null>(null)
	// Anche i file %SYSTEM% messi dalle missioni: exe.clustercore di A17 va caricato sui Personal Server
	const flashram = game.state.files
	const pick = local && flashram.includes(local) ? local : null
	return (
		<Frame
			actions={
				<>
					<TabButton onClick={onClose}>Annulla</TabButton>
					<TabButton disabled={!pick} onClick={() => pick && (onClose(), run((g) => g.network.upload(pick)))}>
						Carica
					</TabButton>
				</>
			}
		>
			<div className="mb-2 text-mo-accent">== Flashram: scegli il file da caricare ==</div>
			{flashram.length === 0 && <Empty>Nessun file in Flashram.</Empty>}
			{flashram.map((f, i) => (
				<Item key={`${f.name}-${i}`} selected={f === pick} onClick={() => setLocal(f)}>
					{f.name} [{f.dim} Mb]
				</Item>
			))}
		</Frame>
	)
}

// --- terminali ---

function FileServerView() {
	const game = useGame()
	const run = useRun()
	const showDialog = useApp((s) => s.showDialog)
	const { selected, setSelected, open, setOpen } = useSelection()
	const [picking, setPicking] = useUploadPicker()
	const files = game.network.visibleFiles()
	const sel = selected && files.includes(selected) ? selected : null

	if (open) return <Reader title={open.name} onBack={() => setOpen(null)}><div className="whitespace-pre-wrap">{open.contents}</div></Reader>

	if (picking) return <UploadPicker onClose={() => setPicking(false)} />

	return (
		<Frame
			actions={
				<>
					{game.network.isAdmin() && <TabButton onClick={() => run((g) => g.network.reboot())}>Riavvia Sistema</TabButton>}
					<UploadButton onClick={() => setPicking(true)} />
					<TabButton disabled={!sel} onClick={() => sel && (sel.contents === "%SYSTEM%" ? showDialog("File di sistema: impossibile visualizzarlo.") : setOpen(sel))}>
						Visualizza...
					</TabButton>
					<TabButton disabled={!sel} onClick={() => sel && run((g) => g.network.download(sel))}>
						Scarica...
					</TabButton>
					{/* Il file eliminato sparisce dalla lista e con lui la selezione */}
					<TabButton disabled={!sel} onClick={() => sel && run((g) => (g.network.deleteRemoteFile(sel) ? null : "Impossibile eliminare un file di sistema."))}>
						Elimina...
					</TabButton>
				</>
			}
		>
			{files.length === 0 && <Empty>Nessun file presente.</Empty>}
			{files.map((f, i) => (
				<Item key={`${f.name}-${i}`} selected={f === sel} onClick={() => setSelected(f)}>
					{f.name} [{f.dim} Mb]
				</Item>
			))}
		</Frame>
	)
}

/** News Server e Mail Server: elenco dei titoli e lettura (le mail hanno già l'intestazione nel testo); solo le mail si eliminano */
function ReadingView({ empty, deletable }: { empty: string; deletable?: boolean }) {
	const game = useGame()
	const remove = useDeleteRemote()
	const { open, setOpen } = useSelection()
	const files = game.network.visibleFiles()

	if (open)
		return (
			<Reader title={open.name} onBack={() => setOpen(null)} onDelete={deletable ? () => remove(open, () => setOpen(null)) : undefined}>
				<div className="whitespace-pre-wrap">{open.contents}</div>
			</Reader>
		)

	return (
		<Frame>
			{files.length === 0 && <Empty>{empty}</Empty>}
			{files.map((f, i) => (
				<Item key={`${f.name}-${i}`} onClick={() => setOpen(f)}>
					{f.name}
				</Item>
			))}
		</Frame>
	)
}

const HARDWARE_LABEL: Record<string, [string, string]> = {
	cpu: ["Cpu", "Mhz"],
	net: ["Scheda di Rete", "Mbps"],
	flashram: ["Flashram", "Mb"],
}

/** Commerce Server: name = modello, dim = MHz/MBps/MB, img = costo, contents = descrizione, owner = tipo */
function CommerceView() {
	const game = useGame()
	const run = useRun()
	const { selected, setSelected } = useSelection()
	const items = game.network.visibleFiles()

	return (
		<Frame
			actions={
				<TabButton disabled={!selected} onClick={() => selected && run((g) => buyHardware(g, selected), `Acquisto completato: ${selected.name}.`)}>
					Acquista...
				</TabButton>
			}
		>
			{items.length === 0 && <Empty>Nessun articolo in vendita.</Empty>}
			{items.map((f, i) => {
				const [label, unit] = HARDWARE_LABEL[String(f.owner).toLowerCase()] ?? [String(f.owner), ""]
				return (
					<Item key={`${f.name}-${i}`} selected={f === selected} onClick={() => setSelected(f)}>
						{label}: {f.name} [{f.dim} {unit}] Costo: {f.img} Crediti
						{f === selected && f.contents && <div className="whitespace-pre-wrap text-mo-accent">{f.contents}</div>}
					</Item>
				)
			})}
		</Frame>
	)
}

/** Software Server: name = nome-versione, dim = MB, img = costo, contents = programma, owner = descrizione */
function SoftwareView() {
	const game = useGame()
	const run = useRun()
	const { selected, setSelected } = useSelection()
	const items = game.network.visibleFiles()

	return (
		<Frame
			actions={
				<TabButton disabled={!selected} onClick={() => selected && run((g) => buySoftware(g, selected))}>
					Acquista...
				</TabButton>
			}
		>
			{items.length === 0 && <Empty>Nessun software in vendita.</Empty>}
			{items.map((f, i) => {
				const cost = Math.max(0, Number(f.img) || 0)
				return (
					<Item key={`${f.name}-${i}`} selected={f === selected} onClick={() => setSelected(f)}>
						{f.name} [{f.dim} Mb] Costo: {cost ? `${cost} Crediti` : "Gratuito"}
						{f === selected && <div className="whitespace-pre-wrap text-mo-accent">{String(f.owner)}</div>}
					</Item>
				)
			})}
		</Frame>
	)
}

/** Subscription Server: dim = ricompensa, img = file missione, contents = descrizione, owner = ranking minimo */
function SubscriptionView({ host }: { host: ServerState }) {
	const game = useGame()
	const run = useRun()
	const { selected, setSelected } = useSelection()
	// Offerta casuale selezionata (MissGen), per numero di sottoscrizione
	const [offerId, setOfferId] = useState<string | null>(null)
	const items = game.network.visibleFiles()
	// Le offerte casuali si aggiungono a quelle fisse; il tempo residuo si aggiorna a ogni tick
	const offers = game.missgen.offersOf(host.ip)
	const offer = offers.find((o) => o.id === offerId) ?? null
	const accepted = "Sottoscrizione accettata: riceverai a breve le istruzioni via mail."

	function accept() {
		if (selected) run((g) => acceptSubscription(g, selected), accepted)
		else if (offer) run((g) => g.missgen.accept(offer.id), accepted)
	}

	return (
		<Frame
			actions={
				<TabButton disabled={!selected && !offer} onClick={accept}>
					Accetta...
				</TabButton>
			}
		>
			{items.length === 0 && offers.length === 0 && <Empty>Nessuna sottoscrizione disponibile.</Empty>}
			{items.map((f, i) => (
				<Item
					key={`${f.name}-${i}`}
					selected={f === selected}
					onClick={() => {
						setSelected(f)
						setOfferId(null)
					}}
				>
					{f.name} — Ricompensa: {f.dim} Crediti — Ranking minimo: {String(f.owner) || 0}
					<div className="text-mo-accent">{f.contents}</div>
				</Item>
			))}
			{offers.map((o) => (
				<Item
					key={o.id}
					selected={o === offer}
					onClick={() => {
						setOfferId(o.id)
						setSelected(null)
					}}
				>
					Sottoscrizione No. {o.id} — Ricompensa: {o.def.credits} Crediti — Ranking minimo: {o.minRanking} — Scade tra{" "}
					{formatRemaining(o.expiresAt - game.now)}
					<div className="text-mo-accent">{game.missgen.objective(o)}</div>
				</Item>
			))}
		</Frame>
	)
}

/** "spr_portrait:24" → graphics/portrait_24.jpg: per il Modding HOW-TO §2.4 l'indice è il numero nel nome del file */
function portraitOf(img: GameFile["img"]): string | null {
	const m = /^spr_portrait:(\d+)$/.exec(String(img))
	return m ? asset(`graphics/portrait_${m[1].padStart(2, "0")}.jpg`) : null
}

/** Database Server: fascicoli con ritratto (img = global.spr_portrait[N]) */
function DatabaseView() {
	const game = useGame()
	const remove = useDeleteRemote()
	const { open, setOpen } = useSelection()
	const [picking, setPicking] = useUploadPicker()
	const files = game.network.visibleFiles()

	if (picking) return <UploadPicker onClose={() => setPicking(false)} />

	if (open) {
		const portrait = portraitOf(open.img)
		return (
			<Reader title={open.name} onBack={() => setOpen(null)} onDelete={() => remove(open, () => setOpen(null))}>
				<div className="flex gap-3">
					{portrait && <img src={portrait} alt="" className="h-fit w-[120px] shrink-0 border border-mo-line" draggable={false} />}
					<div className="min-w-0 flex-1 whitespace-pre-wrap">{open.contents}</div>
				</div>
			</Reader>
		)
	}

	return (
		<Frame actions={<UploadButton onClick={() => setPicking(true)} />}>
			{files.length === 0 && <Empty>Nessun fascicolo presente.</Empty>}
			{files.map((f, i) => (
				<Item key={`${f.name}-${i}`} onClick={() => setOpen(f)}>
					{f.name}
				</Item>
			))}
		</Frame>
	)
}

/** Netbanking Server: conto dell'utente autenticato (name = intestatario, dim = saldo, img = limite per trasferimento) */
function NetbankingView() {
	const game = useGame()
	const run = useRun()
	const [amount, setAmount] = useState("")
	const account = game.network.bankAccount()

	if (!account)
		return (
			<Frame>
				<Empty>Nessun conto associato a questo utente.</Empty>
			</Frame>
		)

	const value = Number(amount)
	const limit = game.network.transferLimit(account)
	const valid = Number.isInteger(value) && value > 0 && value <= account.dim
	function submit() {
		if (!valid) return
		run((g) => g.network.transfer(value), `Trasferimento completato: ${value} crediti accreditati sul tuo conto.`)
		setAmount("")
	}

	return (
		<Frame
			actions={
				<TabButton disabled={!valid} onClick={submit}>
					Trasferisci...
				</TabButton>
			}
		>
			<div className="mb-2 text-mo-accent">== Conto corrente ==</div>
			<div>Intestatario : {account.name}</div>
			<div>Titolare : {String(account.owner)}</div>
			<div>Saldo : {account.dim} Crediti</div>
			<div>Limite per trasferimento : {limit} Crediti</div>
			<form
				className="mt-3 flex items-center gap-2"
				onSubmit={(e) => {
					e.preventDefault()
					submit()
				}}
			>
				<label htmlFor="mo-bank-amount" className="text-mo-accent">
					Importo da trasferire:
				</label>
				<input
					id="mo-bank-amount"
					inputMode="numeric"
					value={amount}
					onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
					className="w-[120px] border border-mo-line bg-transparent px-1 text-white caret-white outline-none"
					autoComplete="off"
				/>
				<span className="text-mo-accent">Crediti</span>
			</form>
			{valid && value > limit && <div className="mt-2 text-mo-alert">Attenzione: l'importo supera il limite del conto, il server avvierà il backtrace.</div>}
		</Frame>
	)
}

/** Chat Server: log pubblici (texts/chats.text) più le righe aggiunte dalle missioni */
function ChatView({ host }: { host: ServerState }) {
	const game = useGame()
	const logs = game.chat.logs(host.ip)
	return (
		<Frame>
			<div className="mb-2 text-mo-accent">== Log pubblici ==</div>
			{logs.length === 0 && <Empty>Nessun log disponibile.</Empty>}
			{logs.map((line, i) => (
				<div key={i} className="whitespace-pre-wrap">
					{line}
				</div>
			))}
		</Frame>
	)
}

function TerminalView({ host }: { host: ServerState }) {
	switch (host.terminal) {
		case "FileServer":
			return <FileServerView />
		case "NewsServer":
			return <ReadingView empty="Nessuna notizia pubblicata." />
		case "MailServer":
			return <ReadingView empty="Nessun messaggio nella casella di posta." deletable />
		case "CommerceServer":
			return <CommerceView />
		case "SoftwareServer":
			return <SoftwareView />
		case "SubscriptionServer":
			return <SubscriptionView host={host} />
		case "DatabaseServer":
			return <DatabaseView />
		case "ChatServer":
			return <ChatView host={host} />
		case "NetbankingServer":
			return <NetbankingView />
		case "Phone":
			return <Panel className="mt-2 w-[360px] p-2 text-mo-accent">Linea telefonica aperta con {host.ip}.</Panel>
		default:
			return <Panel className="mt-2 p-2 text-mo-accent">{host.type || "Server"} — terminale non ancora disponibile in Eve.</Panel>
	}
}

export default function Terminal() {
	const game = useGame()
	const host = game.network.host
	if (!host) return null
	const logged = game.network.connection?.logged ?? ""
	return (
		<div data-tut="terminal" className="absolute top-4 left-2 z-10 w-[752px]">
			<div className="pl-0.5 font-title text-[15px] leading-[21px] whitespace-pre-wrap text-[#cfd8e6]">{host.welcome}</div>
			{/* Selezioni e file aperti ripartono da zero cambiando server o utente */}
			{/* Server sotto sequestro (modello hackedsys.fak): solo il comunicato Intrapol */}
			{host.seizedUntil ? null : game.network.needsAuth() ? (
				<LoginView key={host.ip} host={host} />
			) : (
				<TerminalView key={`${host.ip}/${logged}`} host={host} />
			)}
		</div>
	)
}
