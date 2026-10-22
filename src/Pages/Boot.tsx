// Schermata BIOS e caricamento dei contenuti. ESC la salta (appena i contenuti sono pronti).

import { useEffect, useState } from "react"
import { fetchPack } from "@/engine/content"
import { START_HARDWARE } from "@/engine/balance"
import { useApp } from "@/store/app"
import { asset } from "@/assets"

const LINES = [
	"Advanced Megabios Plug and Play BIOS Extension v2.02a",
	"Copyright (C) 2009, Advanced Megabios Corp.",
	`    Rilevamento CPU      ... ${START_HARDWARE.cpu.name} [ 1015 Mhz ]`,
	`    Rilevamento Flashram ... ${START_HARDWARE.flashram.name} [ 1024 MByte ]`,
	"    Rilevamento Rete     ... " + START_HARDWARE.net.name,
	"",
	"Avvio di Mother OS...",
]

export default function Boot() {
	const setPack = useApp((s) => s.setPack)
	const setScreen = useApp((s) => s.setScreen)
	const [shown, setShown] = useState(0)
	const [ready, setReady] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		fetchPack(asset(""))
			.then((pack) => {
				setPack(pack)
				setReady(true)
			})
			.catch((e: Error) => setError(e.message))
	}, [setPack])

	useEffect(() => {
		if (shown >= LINES.length) return
		const id = setTimeout(() => setShown((n) => n + 1), shown < 2 ? 300 : 700)
		return () => clearTimeout(id)
	}, [shown])

	// Finite le righe del BIOS e caricati i contenuti: schermata "Caricamento", poi login
	const loading = ready && shown >= LINES.length
	useEffect(() => {
		if (!loading) return
		const id = setTimeout(() => setScreen("login"), 1400)
		return () => clearTimeout(id)
	}, [loading, setScreen])

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape" && ready) setScreen("login")
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [ready, setScreen])

	if (loading) return <img src={asset("graphics/loading.jpg")} className="absolute inset-0 h-full w-full object-cover" alt="" />

	return (
		<div className="absolute inset-0 bg-black p-1 text-[12px] leading-[13px] text-[#c8c8c8]">
			<div className="flex gap-3">
				<img src={asset("graphics/bios.png")} alt="" className="h-[63px] w-[77px]" />
				<div className="pt-1">
					<div>Advanced Megabios v7.21.348 - Enerspec Certified Solution</div>
					<div>Copyright (C) 2009-2012 Advanced Megabios Corporation</div>
				</div>
			</div>
			<div className="mt-1">WM13PACR6293 V9.1 220612</div>
			<div className="mt-3 whitespace-pre">{LINES.slice(0, shown).join("\n")}</div>
			{error && (
				<div className="mt-4 text-red-400">
					Errore nel caricamento dei contenuti ({error}). Esegui `npm run import` con la cartella del gioco originale.
				</div>
			)}
		</div>
	)
}
