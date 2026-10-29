// Monitor di Sistema (in alto a destra): CPU, banda, flashram; espanso mostra anche l'account.

import type { ReactNode } from "react"
import { connectionBandwidth } from "@/engine/balance"
import { useGame } from "@/hooks/useGame"
import { useApp } from "@/store/app"
import { Term } from "./Glossary"
import { ExpandBar } from "./Icons"

function Meter({ label, pct, model, used, note, alert }: { label: ReactNode; pct: number; model: string; used: string; note?: string; alert?: boolean }) {
	const expanded = useApp((s) => s.sysmonExpanded)
	const p = Math.max(0, Math.min(100, Math.round(pct)))
	return (
		<div className="relative mt-[3px] border border-mo-line bg-mo-panel/80 px-1 leading-[13px]">
			<div className={`absolute inset-y-0 left-0 ${alert ? "bg-mo-ok/70" : "bg-[#1b5fb0]/70"}`} style={{ width: `${p}%` }} />
			<div className="relative">
				{label} {p}%
			</div>
			{expanded && (
				<div className="relative">
					<div>{model}</div>
					<div>{used}</div>
					{note && <div className="text-mo-accent">{note}</div>}
				</div>
			)}
		</div>
	)
}

export default function Sysmon() {
	const game = useGame()
	const expanded = useApp((s) => s.sysmonExpanded)
	const toggle = useApp((s) => s.toggleSysmon)
	const { hardware, ranking, credits } = game.state

	return (
		<div data-tut="sysmon" className="absolute top-0 right-0.5 w-[252px] text-[12px]">
			<div className="pl-0.5 leading-[13px] text-mo-accent">
				<div>Mother OS vers. 1.02</div>
				<div>{game.formatDate()}</div>
			</div>
			<Meter label={<>Utilizzo <Term id="cpu">CPU</Term></>} pct={(game.cpuUsed / hardware.cpu.value) * 100} model={hardware.cpu.name} used={`Usati ${Math.round(game.cpuUsed)}/${hardware.cpu.value} Mhz`} />
			<Meter
				label={<>Utilizzo <Term id="banda">Banda</Term></>}
				pct={(game.netUsed / game.netTotal) * 100}
				model={hardware.net.name}
				used={`Usati ${Math.round(game.netUsed)}/${game.netTotal} MBps`}
				note={`Connessione: ${[1, 2, 3].map((n) => `${n} nod${n > 1 ? "i" : "o"} ${connectionBandwidth(n)}`).join(", ")} MBps`}
				alert={game.netUsed / game.netTotal >= 0.5}
			/>
			<Meter
				label={<Term id="flashram">Spazio Occupato</Term>}
				pct={(game.flashramUsed / hardware.flashram.value) * 100}
				model={hardware.flashram.name}
				used={`Usati ${game.flashramUsed}/${hardware.flashram.value} Mb`}
			/>
			{expanded && (
				<div className="mt-[3px] border border-mo-line bg-mo-panel/80 px-1 pb-1 leading-[13px]">
					{/* Titolo con una linea che riempie lo spazio: non va mai a capo */}
					<div className="flex items-center gap-1.5 text-mo-accent">
						<span className="shrink-0">Info Utente</span>
						<span className="h-px flex-1 bg-gradient-to-r from-mo-line to-transparent" />
					</div>
					<div className="truncate">Account : {game.address}</div>
					<div className="truncate">
						<Term id="ranking">Ranking</Term> : {ranking}
					</div>
					<div className="truncate">Classe : {game.userClass}</div>
					<div className="truncate">
						<Term id="crediti">Crediti</Term> : {Math.round(credits * 100) / 100}
					</div>
				</div>
			)}
			{/* Nei contenuti non c'è un server con terminale Cluster: lo stato dei nodi sta qui */}
			{expanded && game.state.cluster.length > 0 && (
				<div className="mt-[3px] border border-mo-line bg-mo-panel/80 px-1 pb-1 leading-[13px]">
					<div className="flex items-center gap-1.5 text-mo-accent">
						<span className="shrink-0">Cluster</span>
						<span className="h-px flex-1 bg-gradient-to-r from-mo-line to-transparent" />
					</div>
					<div>Nodi : {game.state.cluster.length}</div>
					<div>Banda : {game.network.clusterBandwidth()} MBps</div>
					{game.state.cluster.map((ip) => {
						const srv = game.network.server(ip)
						return (
							<div key={ip} className="truncate text-mo-accent">
								- {srv?.name ?? ip} [{srv?.net ?? 0} MBps]
							</div>
						)
					})}
				</div>
			)}
			{game.tasks.length > 0 && (
				<div className="mt-[3px] flex flex-col gap-[3px]">
					{game.tasks.map((t) => {
						const pct = Math.min(100, (t.elapsed / t.total) * 100)
						return (
							<div key={t.id} className="relative overflow-hidden border border-mo-line bg-mo-panel/80 px-1 leading-[15px]">
								{/* Barra di avanzamento semitrasparente dietro al testo, con riflesso che scorre */}
								<div className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#1b5fb0]/50 to-[#3a8fe0]/70 transition-[width] duration-300 ease-linear" style={{ width: `${pct}%` }}>
									<div className="mo-shimmer absolute inset-0" />
								</div>
								<div className="relative flex justify-between gap-2">
									<span className="truncate">{t.label}</span>
									<span className="shrink-0">{Math.round(pct)}%</span>
								</div>
							</div>
						)
					})}
				</div>
			)}
			<button type="button" data-tut="sysmon-expand" className="mt-[3px] block cursor-pointer" onClick={toggle} title={expanded ? "Comprimi" : "Espandi"}>
				<ExpandBar expanded={expanded} />
			</button>
		</div>
	)
}
