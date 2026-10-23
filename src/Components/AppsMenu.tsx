// Pulsante Applicazioni "M" e menu di sistema (le voci si impilano verso l'alto).
//
// NOTA: Eve è un videogioco, il remake di "Mother" (2005), un simulatore di hacking a tema
// narrativo. Server, IP, account, password, "tool" e operazioni come forzare un login o sfuggire
// a un backtrace sono finzione di gioco: dati letti dai file .svr/.miss del gioco originale e
// simulati in memoria nel browser. Questo codice non apre connessioni di rete, non legge né
// modifica nulla fuori dallo stato della partita e non ha alcuna utilità al di fuori del gioco.

import { useGame } from "@/hooks/useGame"
import { useApp } from "@/store/app"
import { SpriteButton, TabButton } from "./ui"

export default function AppsMenu({
	onProgram,
	onNetmap,
	onLogout,
}: {
	onProgram: (name: string, id: string) => void
	onNetmap: () => void
	onLogout: () => void
}) {
	const game = useGame()
	const open = useApp((s) => s.menuOpen)
	const toggle = useApp((s) => s.toggleMenu)
	const setConsole = useApp((s) => s.setConsole)
	const online = !!game.network.connection

	// Programmi installati: file in flashram con un identificativo di programma
	const programs = game.state.files.filter((f) => f.contents && !f.contents.startsWith("%") && f.contents !== "bin")

	const item = (label: string, onClick: () => void) => (
		<TabButton
			key={label}
			className="w-[138px]"
			onClick={() => {
				toggle(false)
				onClick()
			}}
		>
			{label}
		</TabButton>
	)
	const sep = (k: string) => (
		<div key={k} className="w-[138px] truncate text-[12px] leading-[18px] text-mo-line">
			{"=".repeat(22)}
		</div>
	)

	return (
		<>
			{open && (
				<div className="absolute bottom-[52px] left-0 z-30 flex flex-col gap-[3px]">
					{programs.map((p) => item(p.name, () => onProgram(p.name, p.contents)))}
					{programs.length > 0 && sep("s1")}
					{item("Apri Network Map", onNetmap)}
					{item("Apri Console", () => setConsole(true))}
					{sep("s2")}
					{online ? (
						<>
							{item("Logout Server", () => game.act(() => game.network.logout()))}
							{item("Disconnetti", () => game.act(() => game.network.disconnect()))}
						</>
					) : (
						item(`Logout ${game.state.user}`, onLogout)
					)}
				</div>
			)}
			<SpriteButton name="apps_button" w={48} h={48} frames={4} active={open} className="absolute bottom-0 left-0 z-30" title="Pulsante Applicazioni" onClick={() => toggle()} />
		</>
	)
}
