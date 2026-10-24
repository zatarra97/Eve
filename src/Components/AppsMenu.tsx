// Pulsante Applicazioni "M" e menu di sistema: un pannello unico semitrasparente sopra il pulsante,
// con i programmi in flashram, le componenti di sistema e la sessione.
//
// NOTA: Eve è un videogioco, il remake di "Mother" (2005), un simulatore di hacking a tema
// narrativo. Server, IP, account, password, "tool" e operazioni come forzare un login o sfuggire
// a un backtrace sono finzione di gioco: dati letti dai file .svr/.miss del gioco originale e
// simulati in memoria nel browser. Questo codice non apre connessioni di rete, non legge né
// modifica nulla fuori dallo stato della partita e non ha alcuna utilità al di fuori del gioco.

import { useEffect, type ReactNode } from "react"
import { useGame } from "@/hooks/useGame"
import { useApp } from "@/store/app"
import { AppsIcon } from "./Icons"

/** Riga del menu: rombo a sinistra, evidenziazione con barra azzurra al passaggio del mouse */
function Item({ label, hint, onClick }: { label: string; hint?: string; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="group relative flex h-[21px] w-full cursor-pointer items-center gap-1.5 pr-2 pl-2.5 text-left text-[12px] text-mo-text hover:bg-gradient-to-r hover:from-[#2b78d8]/70 hover:to-transparent hover:text-white"
		>
			<span className="absolute inset-y-0.5 left-0 w-[2px] bg-mo-accent opacity-0 group-hover:opacity-100" />
			<svg width="7" height="7" viewBox="0 0 7 7" className="shrink-0">
				<path d="M3.5 0.5 L6.5 3.5 L3.5 6.5 L0.5 3.5 Z" fill="none" stroke="#6fb8ff" strokeWidth="1" className="group-hover:fill-[#6fb8ff]" />
			</svg>
			<span className="min-w-0 flex-1 truncate">{label}</span>
			{hint && <span className="shrink-0 text-[10.5px] text-mo-line group-hover:text-mo-accent">{hint}</span>}
		</button>
	)
}

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div className="py-1">
			<div className="flex items-center gap-1.5 px-2.5 pb-0.5 font-title text-[9px] tracking-[0.12em] text-mo-line uppercase">
				{title}
				<span className="h-px flex-1 bg-gradient-to-r from-mo-line-dim to-transparent" />
			</div>
			{children}
		</div>
	)
}

export default function AppsMenu({
	onProgram,
	onNetmap,
	onSettings,
	onLogout,
}: {
	onProgram: (name: string, id: string) => void
	onNetmap: () => void
	onSettings: () => void
	onLogout: () => void
}) {
	const game = useGame()
	const open = useApp((s) => s.menuOpen)
	const toggle = useApp((s) => s.toggleMenu)
	const setConsole = useApp((s) => s.setConsole)
	const connection = game.network.connection
	const host = connection ? game.network.server(connection.target) : undefined

	// ESC chiude il menu
	useEffect(() => {
		if (!open) return
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && toggle(false)
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [open, toggle])

	// Programmi installati: file in flashram con un identificativo di programma
	const programs = game.state.files.filter((f) => f.contents && !f.contents.startsWith("%") && f.contents !== "bin")

	const run = (fn: () => void) => () => {
		toggle(false)
		fn()
	}

	return (
		<>
			{open && (
				<>
					{/* Click fuori dal pannello: chiude il menu */}
					<div className="absolute inset-0 z-20" onClick={() => toggle(false)} />
					<div
						data-tut="appsmenu"
						className="absolute bottom-[52px] left-0.5 z-30 w-[232px] border border-mo-line bg-[#06173a]/70 shadow-[0_0_18px_#3a8fe040] backdrop-blur-[3px]"
						style={{ clipPath: "polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)" }}
					>
						{/* Bordo sul lato dell'angolo smussato (il clip-path lo taglia) */}
						<svg className="pointer-events-none absolute top-0 right-0" width="14" height="14" viewBox="0 0 14 14">
							<line x1="0" y1="0.5" x2="13.5" y2="14" stroke="#3a8fe0" strokeWidth="1.5" />
						</svg>
						{/* Riflesso in alto, come sulle icone */}
						<div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/10 to-transparent" />

						<div className="relative border-b border-mo-line-dim/70 bg-gradient-to-r from-[#1d559f]/80 to-transparent px-2.5 py-1.5">
							<div className="font-title text-[11px] text-white">Mother OS</div>
							<div className="truncate text-[11px] leading-[14px] text-mo-accent">{game.address}</div>
						</div>

						<div className="relative">
							{programs.length > 0 && (
								<Section title="Programmi">
									<div className="mo-scroll max-h-[189px] overflow-y-auto">
										{programs.map((p) => (
											<Item key={p.name} label={p.name} hint={`${p.dim} Mb`} onClick={run(() => onProgram(p.name, p.contents))} />
										))}
									</div>
								</Section>
							)}
							<Section title="Sistema">
								<Item label="Apri Network Map" onClick={run(onNetmap)} />
								<Item label="Apri Console" onClick={run(() => setConsole(true))} />
								<Item label="Impostazioni" onClick={run(onSettings)} />
							</Section>
							<Section title={connection ? "Connessione" : "Sessione"}>
								{connection ? (
									<>
										<Item label="Logout Server" hint={host?.name} onClick={run(() => game.act(() => game.network.logout()))} />
										<Item label="Disconnetti" onClick={run(() => game.act(() => game.network.disconnect()))} />
									</>
								) : (
									<Item label={`Logout ${game.state.user}`} onClick={run(onLogout)} />
								)}
							</Section>
						</div>
					</div>
				</>
			)}
			<AppsIcon active={open} className="absolute bottom-0 left-0 z-30" onClick={() => toggle()} />
		</>
	)
}
