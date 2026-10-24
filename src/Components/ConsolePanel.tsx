// Console in basso a sinistra: log della sessione e riga di comando.

import { useEffect, useRef, useState } from "react"
import { useGame } from "@/hooks/useGame"
import { Panel } from "./ui"

export default function ConsolePanel() {
	const game = useGame()
	const [line, setLine] = useState("")
	const [histIndex, setHistIndex] = useState<number | null>(null)
	const logRef = useRef<HTMLDivElement>(null)
	const lines = game.state.console

	// Scorre in fondo quando arrivano nuove righe
	useEffect(() => {
		logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
	}, [lines.length])

	return (
		<Panel className="absolute bottom-[50px] left-0 z-10 flex h-[132px] w-[542px] flex-col text-[12px] leading-[16px]">
			<div ref={logRef} className="mo-scroll min-h-0 flex-1 overflow-y-auto px-1 whitespace-pre-wrap" onClick={() => document.getElementById("mo-console")?.focus()}>
				{lines.map((l, i) => (
					<div key={i}>{l}</div>
				))}
				<form
					className="flex"
					onSubmit={(e) => {
						e.preventDefault()
						const cmd = line
						setLine("")
						setHistIndex(null)
						game.act(() => game.shell.exec(cmd, { interactive: true }))
					}}
				>
					<span>{game.shell.prompt}</span>
					<input
						id="mo-console"
						autoFocus
						value={line}
						onChange={(e) => setLine(e.target.value)}
						onKeyDown={(e) => {
							const h = game.shell.history
							if (e.key === "ArrowUp" && h.length) {
								e.preventDefault()
								const i = histIndex === null ? h.length - 1 : Math.max(0, histIndex - 1)
								setHistIndex(i)
								setLine(h[i])
							} else if (e.key === "ArrowDown" && histIndex !== null) {
								e.preventDefault()
								const i = histIndex + 1
								if (i >= h.length) {
									setHistIndex(null)
									setLine("")
								} else {
									setHistIndex(i)
									setLine(h[i])
								}
							}
						}}
						className="min-w-0 flex-1 bg-transparent text-white caret-white outline-none"
						autoComplete="off"
						spellCheck={false}
					/>
				</form>
			</div>
		</Panel>
	)
}
