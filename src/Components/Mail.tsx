// Posta elettronica: un'icona in basso a destra con il contatore delle mail non lette, la casella
// con tutte le mail (dalla più recente) sopra l'icona, il visualizzatore e la risposta nell'angolo
// in alto a destra (al posto del Sysmon). Le mail non si eliminano: restano tutte consultabili.

import { useState } from "react"
import { useGame } from "@/hooks/useGame"
import { useApp } from "@/store/app"
import type { Mail } from "@/engine/types"
import { GlossaryText } from "./Glossary"
import { MailIcon } from "./Icons"
import { TabButton, Typewriter } from "./ui"

const p2 = (n: number) => String(n).padStart(2, "0")

/** Data breve per l'elenco: gg/mm hh:mm */
function shortDate(ms: number) {
	const d = new Date(ms)
	return `${p2(d.getDate())}/${p2(d.getMonth() + 1)} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}

/** Mail ricevute, dalla più recente */
function inboxOf(mails: Mail[]) {
	return mails.filter((m) => !m.sent).sort((a, b) => b.date - a.date || b.id - a.id)
}

/** Icona della posta con contatore e casella dei messaggi */
export function MailBar() {
	const game = useGame()
	const inboxOpen = useApp((s) => s.inboxOpen)
	const setInbox = useApp((s) => s.setInbox)
	const unread = game.state.mails.filter((m) => !m.sent && !m.read).length

	return (
		<>
			{inboxOpen && <Inbox />}
			<MailIcon unread={unread} active={inboxOpen} onClick={() => setInbox(!inboxOpen)} className="absolute right-0 bottom-0 z-20" />
		</>
	)
}

function Inbox() {
	const game = useGame()
	const right = useApp((s) => s.right)
	const setRight = useApp((s) => s.setRight)
	const setInbox = useApp((s) => s.setInbox)
	const inbox = inboxOf(game.state.mails)
	const unread = inbox.filter((m) => !m.read).length
	const openId = right?.kind === "mail" ? right.id : right?.kind === "compose" ? right.replyTo : null

	return (
		<div data-tut="inbox" className="absolute right-0.5 bottom-[36px] z-20 flex h-[270px] w-[300px] flex-col border-2 border-mo-line bg-[#0b2f6e]/95 p-1 text-[12px] leading-[15px]">
			<div className="mb-1 flex items-baseline justify-between text-mo-accent">
				<span className="font-title text-[11px]">Posta in arrivo</span>
				<span>{inbox.length ? `${inbox.length} messaggi, ${unread} da leggere` : "nessun messaggio"}</span>
			</div>
			<div className="mo-scroll min-h-0 flex-1 overflow-y-auto border border-mo-line-dim bg-[#071226]/60">
				{inbox.map((m) => (
					<button
						key={m.id}
						type="button"
						onClick={() => {
							game.act(() => game.markRead(m.id))
							setRight({ kind: "mail", id: m.id })
						}}
						className={`block w-full cursor-pointer border-b border-mo-line-dim/50 px-1 py-[2px] text-left ${
							openId === m.id ? "bg-[#1b5fb0]/70" : "hover:bg-[#123e80]/60"
						}`}
					>
						<div className="flex items-center gap-1">
							<span className={`inline-block h-[6px] w-[6px] shrink-0 rounded-full ${m.read ? "bg-transparent" : "bg-mo-alert shadow-[0_0_4px_#d8252c]"}`} />
							<span className={`min-w-0 flex-1 truncate ${m.read ? "text-mo-accent" : "font-bold text-white"}`}>{m.from}</span>
							<span className="shrink-0 text-[11px] text-mo-line">{shortDate(m.date)}</span>
						</div>
						<div className={`truncate pl-[10px] ${m.read ? "text-mo-text/80" : "text-white"}`}>
							{m.attachment ? "[+] " : ""}
							{m.subject}
						</div>
					</button>
				))}
			</div>
			<div className="mt-1 flex justify-end">
				<TabButton onClick={() => setInbox(false)}>Chiudi</TabButton>
			</div>
		</div>
	)
}

const frame = "absolute top-0 right-0.5 z-20 flex h-[350px] w-[250px] flex-col border-2 border-mo-line bg-[#0b2f6e]/95 p-1 text-[12px] leading-[16px]"

export function MailPanel() {
	const game = useGame()
	const right = useApp((s) => s.right)
	const setRight = useApp((s) => s.setRight)
	if (!right) return null

	if (right.kind === "mail") {
		const mail = game.state.mails.find((m) => m.id === right.id)
		if (!mail) return null
		return (
			<div data-tut="mailpanel" className={frame}>
				<div className="text-mo-accent">Da: {mail.from}</div>
				<div className="mb-2 text-mo-accent">Oggetto: {mail.subject}</div>
				{mail.attachment && <div className="mb-1 text-mo-accent">Allegato: {mail.attachment.name}</div>}
				<div className="mo-scroll min-h-0 flex-1 overflow-y-auto pr-1 whitespace-pre-wrap">
					<GlossaryText text={mail.body} />
				</div>
				<div className="mt-1 flex justify-between">
					<TabButton onClick={() => setRight({ kind: "compose", replyTo: mail.id })}>Rispondi</TabButton>
					<TabButton onClick={() => setRight(null)}>Chiudi</TabButton>
				</div>
			</div>
		)
	}

	return <Compose replyTo={right.replyTo} />
}

function Compose({ replyTo }: { replyTo: number }) {
	const game = useGame()
	const setRight = useApp((s) => s.setRight)
	const [attachment, setAttachment] = useState<string>("")
	const [picking, setPicking] = useState(false)
	const mail = game.state.mails.find((m) => m.id === replyTo)
	if (!mail) return null
	const text = game.replyText(mail.id)
	const files = game.state.files.filter((f) => f.contents !== "%SYSTEM%")

	return (
		<div data-tut="mailpanel" className={frame}>
			<div className="text-mo-accent">Per: {mail.from}</div>
			<div className="text-mo-accent">RE: {mail.subject}</div>
			<div className="mt-2 mb-2 text-mo-accent">Allegato: {attachment}</div>
			{picking ? (
				<div className="mo-scroll min-h-0 flex-1 overflow-y-auto">
					<button type="button" className="block w-full cursor-pointer text-left hover:text-mo-accent" onClick={() => (setAttachment(""), setPicking(false))}>
						(nessun allegato)
					</button>
					{files.map((f) => (
						<button
							key={f.name}
							type="button"
							className="block w-full cursor-pointer text-left hover:text-mo-accent"
							onClick={() => {
								setAttachment(f.name)
								setPicking(false)
							}}
						>
							{f.name} [{f.dim} Mb]
						</button>
					))}
				</div>
			) : (
				<div className="mo-scroll min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap">
					<Typewriter text={text} />
				</div>
			)}
			<div className="mt-1 flex justify-between">
				<TabButton onClick={() => setPicking((p) => !p)}>Allega File...</TabButton>
				<TabButton
					onClick={() => {
						game.act(() => game.reply(mail.id, attachment || undefined))
						setRight(null)
					}}
				>
					Invia...
				</TabButton>
			</div>
		</div>
	)
}
