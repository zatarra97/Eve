// Desktop di Mother: ciclo di gioco, eventi del motore e composizione dei pannelli.

import { useCallback, useEffect, useState, type ReactNode } from "react"
import { asset } from "@/assets"
import { Game } from "@/engine/game"
import { loadAccount, saveAccount } from "@/engine/save"
import { useGame } from "@/hooks/useGame"
import { useApp } from "@/store/app"
import { playSound, setMusic } from "@/audio"
import AppsMenu from "@/Components/AppsMenu"
import ConsolePanel from "@/Components/ConsolePanel"
import { MailBar, MailPanel } from "@/Components/Mail"
import NetworkMap from "@/Components/NetworkMap"
import { BackMirror, MomAmp, MomPad, RootBreaker, TutHack, UAVsys, WaveHacker } from "@/Components/Programs"
import Sysmon from "@/Components/Sysmon"
import Terminal from "@/Components/Terminal"
import { Dialog } from "@/Components/ui"

const TICK_MS = 250

/** Finestre dei programmi per identificativo (FileContents del file in flashram) */
const PROGRAMS: Record<string, (p: { name: string; onClose: () => void }) => ReactNode> = {
	mompad: MomPad,
	uavsys: UAVsys,
	momamp: MomAmp,
	tut_hack: TutHack,
	rootbreaker: RootBreaker,
	wavehacker: WaveHacker,
	backmirror: BackMirror,
}

interface OpenProgram {
	id: string
	name: string
}

/** Riga di stato in alto a sinistra: localhost, composizione dell'indirizzo, server connesso */
function StatusLine() {
	const game = useGame()
	const c = game.network.connection
	let text = "// connesso a localhost"
	if (c?.status === "dialing") text = `// chiamata remota...\n// ${c.target.slice(0, Math.ceil(c.target.length * c.dial))}`
	else if (c) text = `// connesso a ${game.network.server(c.target)?.name ?? c.target}`
	return <div className="absolute top-0 left-1 z-10 text-[12px] leading-[13px] whitespace-pre text-mo-accent">{text}</div>
}

export default function Desktop() {
	const game = useGame()
	const pack = useApp((s) => s.pack)
	const startGame = useApp((s) => s.startGame)
	const endGame = useApp((s) => s.endGame)
	const netmapOpen = useApp((s) => s.netmapOpen)
	const consoleOpen = useApp((s) => s.consoleOpen)
	const setConsole = useApp((s) => s.setConsole)
	const setNetmap = useApp((s) => s.setNetmap)
	const right = useApp((s) => s.right)
	const setRight = useApp((s) => s.setRight)
	const dialog = useApp((s) => s.dialog)
	const showDialog = useApp((s) => s.showDialog)
	const closeDialog = useApp((s) => s.closeDialog)
	const [askTutorial, setAskTutorial] = useState(!game.state.tutorialDone)
	// Programmi aperti; l'ultimo è in primo piano
	const [programs, setPrograms] = useState<OpenProgram[]>([])

	const openProgram = useCallback(
		(name: string, id: string) => {
			const key = id.toLowerCase()
			if (!PROGRAMS[key]) return showDialog(`'${name}': programma non ancora disponibile in Eve.`)
			setPrograms((list) => [...list.filter((p) => p.id !== key), { id: key, name }])
		},
		[showDialog],
	)
	const closeProgram = (id: string) => setPrograms((list) => list.filter((p) => p.id !== id))

	// Ciclo di gioco con il tempo reale trascorso (il desktop si rimonta a ogni partita)
	useEffect(() => {
		let last = performance.now()
		const id = setInterval(() => {
			const now = performance.now()
			game.tick(now - last)
			last = now
		}, TICK_MS)
		return () => clearInterval(id)
	}, [game])

	// Eventi del motore verso l'interfaccia
	useEffect(() => {
		return game.onEvent((e) => {
			switch (e.type) {
				case "sound":
					playSound(e.name)
					break
				case "mail":
					if (game.state.settings.openNewMail) setRight({ kind: "mail", id: e.mail.id })
					break
				case "message":
					showDialog(e.text, e.title)
					break
				case "program":
					openProgram(e.name, e.id)
					break
				case "disconnected":
					if (e.reason) showDialog(e.reason)
					break
				case "ui":
					if (e.action === "msgbox") showDialog(String(e.arg ?? ""))
					else if (e.action === "console") setConsole(!!e.arg)
					else if (e.action === "netmap") setNetmap(!!e.arg)
					break
			}
		})
	}, [game, setRight, showDialog, setConsole, setNetmap, openProgram])

	// Musica di sottofondo secondo le impostazioni dell'account
	useEffect(() => {
		setMusic(game.state.settings.music)
		return () => setMusic(false)
	}, [game, game.state.settings.music])

	// Salvataggio automatico ogni minuto e alla chiusura della pagina
	useEffect(() => {
		const save = () => game.state.settings.autosave && saveAccount(game.state)
		const id = setInterval(save, 60_000)
		window.addEventListener("beforeunload", save)
		return () => {
			clearInterval(id)
			window.removeEventListener("beforeunload", save)
		}
	}, [game])

	// F5 salvataggio veloce, F9 caricamento veloce, ESC chiude i pannelli
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "F5") {
				e.preventDefault()
				showDialog(saveAccount(game.state, "quick") ? "Salvataggio veloce completato." : "Impossibile salvare.")
			} else if (e.key === "F9") {
				e.preventDefault()
				const saved = loadAccount(game.state.user, "quick")
				if (saved && pack) startGame(Game.load(pack, saved))
				else showDialog("Nessun salvataggio veloce disponibile.")
			} else if (e.key === "Escape") {
				setNetmap(false)
				setRight(null)
			}
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [game, pack, startGame, showDialog, setNetmap, setRight])

	function logout() {
		game.network.disconnect()
		saveAccount(game.state)
		endGame()
	}

	function startTutorial() {
		game.act(() => {
			game.state.tutorialDone = true
			game.missions.load("def/tut0.miss")
		})
		setAskTutorial(false)
	}

	function openNetmap() {
		if (game.viruses.netmapBlocked())
			showDialog("Impossibile aprire NETCONN: Il Kernel ha rilevato un errore nel controllo di ridondanza ciclica dei dati. Il processo verrà terminato irreversibilmente. Rivolgersi al Supporto Tecnico")
		else setNetmap(true)
	}

	return (
		<div className="absolute inset-0" style={{ background: `url("${asset(`graphics/wallpaper_${game.state.settings.wallpaper}.jpg`)}") center / cover` }}>
			<StatusLine />
			<Terminal />
			{right ? <MailPanel /> : <Sysmon />}
			{netmapOpen && <NetworkMap />}
			{consoleOpen && <ConsolePanel />}
			{programs.map((p) => {
				const Program = PROGRAMS[p.id]
				return <Program key={p.id} name={p.name} onClose={() => closeProgram(p.id)} />
			})}
			<AppsMenu onProgram={openProgram} onNetmap={openNetmap} onLogout={logout} />
			<MailBar />

			{askTutorial && (
				<Dialog
					text="Giocare a Mother per la prima volta potrebbe risultare piuttosto difficile, soprattutto se non hai la minima idea di come funzioni l'ambiente operativo. Vuoi che venga eseguito il tutorial introduttivo sull'interfaccia utente di Mother?"
					actions={[
						{ label: "Esegui Tutorial", onClick: startTutorial },
						{ label: "Salta Tutorial", onClick: startTutorial },
					]}
				/>
			)}
			{dialog && !askTutorial && <Dialog text={dialog.text} actions={[{ label: "Ok", onClick: closeDialog }]} />}
		</div>
	)
}
