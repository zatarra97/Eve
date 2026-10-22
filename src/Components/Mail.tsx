// Posta elettronica: icone dei messaggi in basso a destra, visualizzatore e risposta
// nell'angolo in alto a destra (al posto del Sysmon).

import { useState } from "react"
import { useGame } from "@/hooks/useGame"
import { useApp } from "@/store/app"
import { Sprite, TabButton, Typewriter } from "./ui"

/** Una icona per messaggio ricevuto, la più recente a sinistra */
export function MailBar() {
	const game = useGame()
	const right = useApp((s) => s.right)
	const setRight = useApp((s) => s.setRight)
	const inbox = game.state.mails.filter((m) => !m.sent).slice(-30)
	const openId = right?.kind === "mail" ? right.id : right?.kind === "compose" ? right.replyTo : null

	return (
		<div className="absolute right-0 bottom-0 z-20 flex flex-row-reverse">
			{inbox.map((m) => (
				<button
					key={m.id}
					type="button"
					className="cursor-pointer"
					title={`${m.from} — ${m.subject}`}
					onClick={() => {
						if (openId === m.id) setRight(null)
						else {
							game.act(() => game.markRead(m.id))
							setRight({ kind: "mail", id: m.id })
						}
					}}
				>
					<Sprite name={openId === m.id ? "mail_button_open" : "mail_button"} w={32} h={32} frames={2} frame={m.read ? 0 : 1} />
				</button>
			))}
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
			<div className={frame}>
				<div className="text-mo-accent">Da: {mail.from}</div>
				<div className="mb-2 text-mo-accent">Oggetto: {mail.subject}</div>
				{mail.attachment && <div className="mb-1 text-mo-accent">Allegato: {mail.attachment.name}</div>}
				<div className="mo-scroll min-h-0 flex-1 overflow-y-auto pr-1 whitespace-pre-wrap">{mail.body}</div>
				<div className="mt-1 flex justify-between">
					<TabButton onClick={() => setRight({ kind: "compose", replyTo: mail.id })}>Rispondi</TabButton>
					<TabButton
						onClick={() => {
							game.act(() => game.deleteMail(mail.id))
							setRight(null)
						}}
					>
						Elimina
					</TabButton>
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
		<div className={frame}>
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
