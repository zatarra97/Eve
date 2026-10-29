// Network Map (NETCONN): mappa equirettangolare (coordinate MapX/MapY riferite a earth_map.jpg,
// 1280x640) dal bordo superiore fino a metà schermo in altezza, larga quanto il palco.
// Nell'originale era alta 384 da y=50.

import { useEffect, useState } from "react"
import { useGame } from "@/hooks/useGame"
import { STAGE_H } from "@/assets"
import { useStageWidth } from "@/stage"
import { useApp } from "@/store/app"
import type { ServerState } from "@/engine/types"
import { findTerms, glossaryEntry } from "@/content/glossary"
import { Sprite, TabButton } from "./ui"
import WorldMap from "./WorldMap"

const MAP_IMG_W = 1280
const MAP_IMG_H = 640
/** Al massimo metà schermo in altezza */
const MAP_H = STAGE_H / 2
/** Posizione fittizia del computer del giocatore (in coordinate dell'immagine) */
const LOCALHOST_MAP = { x: 914, y: 42 }

export default function NetworkMap() {
	const game = useGame()
	const setNetmap = useApp((s) => s.setNetmap)
	const showDialog = useApp((s) => s.showDialog)
	const [hover, setHover] = useState<ServerState | null>(null)
	const [frame, setFrame] = useState(0)
	const width = useStageWidth()
	const mapH = MAP_H
	const sx = width / MAP_IMG_W
	const sy = mapH / MAP_IMG_H
	const pos = (s: { mapX: number; mapY: number }) => ({ x: s.mapX * sx, y: s.mapY * sy })
	const buttonsTop = mapH + 4
	const LOCALHOST = pos({ mapX: LOCALHOST_MAP.x, mapY: LOCALHOST_MAP.y })

	useEffect(() => {
		const id = setInterval(() => setFrame((f) => (f + 1) % 7), 120)
		return () => clearInterval(id)
	}, [])

	const net = game.network
	const servers = net.knownServers().filter((s) => net.isOnline(s))
	const nodes = net.pendingNodes.map((ip) => net.server(ip)).filter((s): s is ServerState => !!s)
	const points = [LOCALHOST, ...nodes.map(pos)]

	function connect() {
		const err = game.act(() => net.connect())
		if (err) showDialog(err)
		else setNetmap(false)
	}

	return (
		<>
			<div data-tut="netmap" className="absolute top-0 left-0 z-20 border-b border-mo-line" style={{ height: mapH, width }}>
				<WorldMap width={width} height={mapH} />
				<svg className="pointer-events-none absolute inset-0" width={width} height={mapH}>
					{points.slice(1).map((p, i) => (
						<line key={i} x1={points[i].x} y1={points[i].y} x2={p.x} y2={p.y} stroke="#6fb8ff" strokeWidth={1} />
					))}
				</svg>
				<div className="absolute" style={{ left: LOCALHOST.x - 5, top: LOCALHOST.y - 5 }}>
					<Sprite name="dot_localhost" w={10} h={10} frames={1} />
				</div>
				{servers.map((s) => {
					const p = pos(s)
					const proxy = s.type === "Proxy Server"
					return (
						<button
							key={s.ip}
							type="button"
							className="absolute cursor-pointer"
							style={{ left: p.x - 5, top: p.y - 5 }}
							onMouseEnter={() => setHover(s)}
							onMouseLeave={() => setHover(null)}
							onClick={() => game.act(() => net.addNode(s.ip))}
						>
							<Sprite name={proxy ? "dot_proxy" : "dot_server"} w={10} h={10} frames={proxy ? 4 : 7} frame={proxy ? frame % 4 : frame} />
						</button>
					)
				})}
				{hover && (
					<div
						className="pointer-events-none absolute z-10 w-[210px] border border-mo-line bg-[#0b2f6e] px-0.5 text-[12px] leading-[13px] text-mo-accent"
						// Sotto l'icona, oppure sopra se è vicina al bordo inferiore della mappa
						style={{
							left: Math.max(0, Math.min(pos(hover).x - 105, width - 212)),
							top: pos(hover).y + (pos(hover).y + 110 > mapH ? -8 : 22),
							transform: pos(hover).y + 110 > mapH ? "translateY(-100%)" : undefined,
						}}
					>
						<div>{hover.name}</div>
						<div>[{hover.ip}]</div>
						<div>{hover.type}</div>
						{/* Cosa fa questo tipo di server, in una riga */}
						{(() => {
							const id = findTerms(hover.type)[0]?.id
							const entry = id && glossaryEntry(id)
							return entry ? <div className="mt-0.5 border-t border-mo-line-dim pt-0.5 text-[11px] leading-[13px] text-white/85">{entry.short}</div> : null
						})()}
					</div>
				)}
			</div>
			{/* Pulsanti subito sotto la mappa */}
			<div className="pointer-events-none absolute right-0.5 left-0.5 z-20 flex items-center gap-2 [&>button]:pointer-events-auto" style={{ top: buttonsTop }}>
				<TabButton onClick={() => setNetmap(false)}>Chiudi</TabButton>
				<div className="flex-1" />
				<TabButton onClick={() => game.act(() => net.removeLastNode())} disabled={nodes.length === 0}>
					Annulla Nodo
				</TabButton>
				<TabButton tut="netmap-connect" onClick={connect} disabled={nodes.length === 0}>
					Connetti
				</TabButton>
			</div>
		</>
	)
}
