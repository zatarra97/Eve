// Monitor di Sistema (in alto a destra): CPU, banda, flashram; espanso mostra anche l'account.

import { useGame } from "@/hooks/useGame"
import { useApp } from "@/store/app"
import { Sprite } from "./ui"

function Meter({ label, pct, model, used, alert }: { label: string; pct: number; model: string; used: string; alert?: boolean }) {
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
			<Meter label="Utilizzo CPU" pct={(game.cpuUsed / hardware.cpu.value) * 100} model={hardware.cpu.name} used={`Usati ${Math.round(game.cpuUsed)}/${hardware.cpu.value} Mhz`} />
			<Meter
				label="Utilizzo Banda"
				pct={(game.netUsed / game.netTotal) * 100}
				model={hardware.net.name}
				used={`Usati ${Math.round(game.netUsed)}/${game.netTotal} MBps`}
				alert={game.netUsed / game.netTotal >= 0.5}
			/>
			<Meter
				label="Spazio Occupato"
				pct={(game.flashramUsed / hardware.flashram.value) * 100}
				model={hardware.flashram.name}
				used={`Usati ${game.flashramUsed}/${hardware.flashram.value} Mb`}
			/>
			{expanded && (
				<div className="mt-[3px] border border-mo-line bg-mo-panel/80 px-1 pb-1 leading-[13px]">
					<div className="text-mo-accent">== Info Utente {"=".repeat(24)}</div>
					<div>Account : {game.address}</div>
					<div>Ranking : {ranking}</div>
					<div>Classe : {game.userClass}</div>
					<div>Crediti : {Math.round(credits * 100) / 100}</div>
				</div>
			)}
			{/* Nei contenuti non c'è un server con terminale Cluster: lo stato dei nodi sta qui */}
			{expanded && game.state.cluster.length > 0 && (
				<div className="mt-[3px] border border-mo-line bg-mo-panel/80 px-1 pb-1 leading-[13px]">
					<div className="text-mo-accent">== Cluster {"=".repeat(28)}</div>
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
				<div className="mt-[3px] border border-mo-line bg-mo-panel/80 px-1 leading-[13px]">
					{game.tasks.map((t) => (
						<div key={t.id}>
							{t.label} {Math.min(100, Math.round((t.elapsed / t.total) * 100))}%
						</div>
					))}
				</div>
			)}
			<button type="button" data-tut="sysmon-expand" className="mt-[3px] block cursor-pointer" onClick={toggle} title={expanded ? "Comprimi" : "Espandi"}>
				<Sprite name={expanded ? "expand_up" : "expand_down"} w={252} h={14} frames={2} />
			</button>
		</div>
	)
}
