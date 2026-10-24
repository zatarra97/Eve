// Network Map (NETCONN): earth_map.jpg 1280x640 stirata su tutta la larghezza del palco, alta 384
// (y 50-434). Nell'originale, a 1024 di larghezza: x = MapX * 0.8, y = MapY * 0.6.

import { useEffect, useState } from "react"
import { asset } from "@/assets"
import { useGame } from "@/hooks/useGame"
import { useStageWidth } from "@/stage"
import { useApp } from "@/store/app"
import type { ServerState } from "@/engine/types"
import { Sprite, TabButton } from "./ui"

const MAP_TOP = 50
const MAP_H = 384
const MAP_IMG_W = 1280
const SY = 0.6
/** Posizione fittizia del computer del giocatore (in coordinate dell'immagine) */
const LOCALHOST_MAP = { x: 914, y: 42 }

export default function NetworkMap() {
	const game = useGame()
	const setNetmap = useApp((s) => s.setNetmap)
	const showDialog = useApp((s) => s.showDialog)
	const [hover, setHover] = useState<ServerState | null>(null)
	const [frame, setFrame] = useState(0)
	const width = useStageWidth()
	const sx = width / MAP_IMG_W
	const pos = (s: { mapX: number; mapY: number }) => ({ x: s.mapX * sx, y: s.mapY * SY })
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
			<div data-tut="netmap" className="absolute left-0 z-20 border-y border-mo-line" style={{ top: MAP_TOP, height: MAP_H, width }}>
				<img src={asset("graphics/earth_map.jpg")} alt="" className="absolute inset-0 h-full w-full" draggable={false} />
				<svg className="pointer-events-none absolute inset-0" width={width} height={MAP_H}>
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
						className="pointer-events-none absolute z-10 w-[163px] border border-mo-line bg-[#0b2f6e] px-0.5 text-[12px] leading-[13px] text-mo-accent"
						style={{ left: Math.max(0, Math.min(pos(hover).x - 82, width - 165)), top: pos(hover).y + 22 }}
					>
						<div>{hover.name}</div>
						<div>[{hover.ip}]</div>
						<div>{hover.type}</div>
					</div>
				)}
			</div>
			<TabButton className="absolute top-[438px] left-0.5 z-20" onClick={() => setNetmap(false)}>
				Chiudi
			</TabButton>
			<TabButton className="absolute top-[438px] right-[118px] z-20" onClick={() => game.act(() => net.removeLastNode())} disabled={nodes.length === 0}>
				Annulla Nodo
			</TabButton>
			<TabButton tut="netmap-connect" className="absolute top-[438px] right-0.5 z-20" onClick={connect} disabled={nodes.length === 0}>
				Connetti
			</TabButton>
		</>
	)
}
