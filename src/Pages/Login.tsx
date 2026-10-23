// Schermata iniziale: autenticazione, registrazione di nuovi account, elenco account salvati.

import { useRef, useState } from "react"
import { Game } from "@/engine/game"
import { deleteAccount, listAccounts, loadAccount, saveAccount } from "@/engine/save"
import { useApp } from "@/store/app"
import { playSound } from "@/audio"
import { Dialog, SpriteButton, TabButton } from "@/Components/ui"
import { asset } from "@/assets"

type Prompt = { kind: "create" } | { kind: "error"; text: string } | { kind: "info" } | { kind: "delete"; user: string } | null

export default function Login() {
	const pack = useApp((s) => s.pack)
	const startGame = useApp((s) => s.startGame)
	const [user, setUser] = useState("")
	const [password, setPassword] = useState("")
	const [prompt, setPrompt] = useState<Prompt>(null)
	// Incrementato per rileggere l'elenco account dopo un'eliminazione
	const [, setRefresh] = useState(0)
	const passRef = useRef<HTMLInputElement>(null)
	const accounts = listAccounts()

	const valid = /^[A-Za-z0-9_.-]{2,20}$/

	function submit() {
		if (!pack) return
		if (!valid.test(user)) {
			setPrompt({ kind: "error", text: "Nome utente non valido: usa da 2 a 20 caratteri tra lettere, numeri, '.', '_' e '-'." })
			return
		}
		const saved = loadAccount(user)
		if (!saved) {
			setPrompt({ kind: "create" })
			return
		}
		if (saved.password !== password) {
			playSound("login_error")
			setPrompt({ kind: "error", text: "Password errata." })
			return
		}
		startGame(Game.load(pack, saved))
	}

	function create() {
		if (!pack) return
		const game = Game.newGame(pack, user, password)
		saveAccount(game.state)
		startGame(game)
	}

	return (
		<div className="absolute inset-0" style={{ background: `url("${asset("graphics/wallpaper_1.jpg")}") center / cover` }}>
			<div className="absolute top-0 left-1 text-[12px] text-mo-accent">// connesso a localhost</div>
			<div className="absolute top-4 left-2.5 right-2 font-title text-[15px] leading-[21px] text-[#cfd8e6]">
				Benvenuto in Mother,
				<br />
				Sei pregato di autenticarti con le tue credenziali. Nel caso in cui tu ne sia sprovvisto, puoi registrare un nuovo account.
			</div>

			<div className="absolute top-[310px] left-[calc(50%-124px)] h-[115px] w-[249px] border border-mo-line bg-[#071533]/90">
				<div className="mt-2 ml-2.5 font-title text-[11px] tracking-wide text-[#cfd8e6]">LOGIN RICHIESTO</div>
				<form
					className="mt-4 ml-4 grid grid-cols-[70px_1fr] items-center gap-y-1.5 pr-3 text-mo-accent"
					onSubmit={(e) => {
						e.preventDefault()
						submit()
					}}
				>
					<label htmlFor="mo-user">Username:</label>
					<input
						id="mo-user"
						autoFocus
						value={user}
						onChange={(e) => setUser(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !password) {
								e.preventDefault()
								passRef.current?.focus()
							}
						}}
						className="bg-transparent text-white caret-white outline-none"
						autoComplete="off"
						spellCheck={false}
						// account di gioco: niente suggerimenti dei password manager
						data-1p-ignore
						data-lpignore="true"
						data-bwignore
					/>
					<label htmlFor="mo-pass">Password:</label>
					<input
						id="mo-pass"
						ref={passRef}
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
			<TabButton className="absolute top-[428px] left-[calc(50%+8px)] w-[114px]" onClick={submit}>
				Login...
			</TabButton>

			{accounts.length > 0 && (
				<div className="absolute top-[460px] left-[calc(50%-124px)] w-[249px] text-[12px]">
					<div className="mb-1 text-mo-accent">Account disponibili:</div>
					{accounts.map((a) => (
						<div key={a.user} className="flex items-center justify-between">
							<button
								type="button"
								className="cursor-pointer text-left text-white hover:text-mo-accent"
								onClick={() => {
									setUser(a.user)
									setPassword("")
									passRef.current?.focus()
								}}
							>
								{a.user}@mother
							</button>
							<button type="button" className="cursor-pointer text-mo-line-dim hover:text-mo-alert" onClick={() => setPrompt({ kind: "delete", user: a.user })}>
								elimina
							</button>
						</div>
					))}
				</div>
			)}

			<SpriteButton name="credits_button" w={32} h={32} frames={2} className="absolute right-8 bottom-0" title="Informazioni" onClick={() => setPrompt({ kind: "info" })} />
			<SpriteButton name="settings_button" w={32} h={32} frames={2} className="absolute right-0 bottom-0" title="Impostazioni" onClick={() => setPrompt({ kind: "info" })} />

			{prompt?.kind === "create" && (
				<Dialog
					text="Le credenziali specificate non esistono, vuoi registrare questi dati come un nuovo utente?"
					actions={[
						{ label: "Annulla", onClick: () => setPrompt(null) },
						{ label: "Conferma", onClick: create },
					]}
				/>
			)}
			{prompt?.kind === "error" && <Dialog text={prompt.text} actions={[{ label: "Ok", onClick: () => setPrompt(null) }]} />}
			{prompt?.kind === "delete" && (
				<Dialog
					text={`Vuoi eliminare definitivamente l'account ${prompt.user}@mother e tutti i suoi salvataggi?`}
					actions={[
						{ label: "Annulla", onClick: () => setPrompt(null) },
						{
							label: "Elimina",
							onClick: () => {
								deleteAccount(prompt.user)
								setPrompt(null)
								setRefresh((n) => n + 1)
							},
						},
					]}
				/>
			)}
			{prompt?.kind === "info" && (
				<Dialog
					text={`Eve v${__APP_VERSION__} — remake web di Mother 1.02.\n\nMother è stato ideato e realizzato da Massimo 'v4ldemar' Pinzaglia (Valdemar Indie Software). Contenuti originali rilasciati sotto licenza CC BY-NC-SA 3.0.`}
					actions={[{ label: "Chiudi", onClick: () => setPrompt(null) }]}
				/>
			)}
		</div>
	)
}
