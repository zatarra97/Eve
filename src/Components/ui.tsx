// Componenti base nello stile di Mother OS: palco alto 768, riquadri, pulsanti, dialog.

import { useEffect, useState, type ReactNode } from "react"
import { twMerge } from "tailwind-merge"
import { STAGE_H, STAGE_W, asset } from "@/assets"
import { StageWidth } from "@/stage"

/** Dimensioni logiche e scala del palco per la finestra attuale */
function fitStage() {
	const ratio = window.innerWidth / window.innerHeight
	// Finestre più larghe del 4:3 allargano il palco; quelle più strette lo riducono in scala
	const width = Math.max(STAGE_W, Math.round(STAGE_H * ratio))
	const scale = Math.min(window.innerWidth / width, window.innerHeight / STAGE_H)
	return { width, scale }
}

/** Palco alto 768 come l'originale, largo quanto la finestra, riscalato per riempirla */
export function Stage({ children }: { children: ReactNode }) {
	const [fit, setFit] = useState(fitStage)
	useEffect(() => {
		const onResize = () => setFit(fitStage())
		window.addEventListener("resize", onResize)
		return () => window.removeEventListener("resize", onResize)
	}, [])
	return (
		<div className="flex h-full w-full items-center justify-center bg-black">
			<div style={{ width: fit.width * fit.scale, height: STAGE_H * fit.scale }}>
				<div
					className="relative overflow-hidden bg-mo-bg text-[13px] leading-[1.25] text-mo-text"
					style={{ width: fit.width, height: STAGE_H, transform: `scale(${fit.scale})`, transformOrigin: "top left" }}
				>
					<StageWidth.Provider value={fit.width}>{children}</StageWidth.Provider>
				</div>
			</div>
		</div>
	)
}

/** Fotogramma di uno sprite originale (strisce orizzontali di fotogrammi della stessa larghezza) */
export function Sprite({
	name,
	frame = 0,
	w,
	h,
	frames,
	className,
	onClick,
	title,
}: {
	name: string
	frame?: number
	w: number
	h: number
	frames: number
	className?: string
	onClick?: () => void
	title?: string
}) {
	return (
		<div
			title={title}
			onClick={onClick}
			className={className}
			style={{
				width: w,
				height: h,
				backgroundImage: `url("${asset(`graphics/${name}.png`)}")`,
				backgroundSize: `${w * frames}px ${h}px`,
				backgroundPosition: `${-frame * w}px 0`,
				imageRendering: "pixelated",
			}}
		/>
	)
}

/** Pulsante sprite a due fotogrammi (normale / mouse sopra) */
export function SpriteButton(props: { name: string; w: number; h: number; frames: number; className?: string; onClick?: () => void; title?: string; active?: boolean }) {
	const [hover, setHover] = useState(false)
	return (
		<div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} className={twMerge("cursor-pointer", props.className)}>
			<Sprite {...props} className="" frame={props.active || hover ? 1 : 0} />
		</div>
	)
}

/** Riquadro con bordo azzurro (Sysmon, terminali, console) */
export function Panel({ className, children, onClick }: { className?: string; children?: ReactNode; onClick?: () => void }) {
	return (
		<div onClick={onClick} className={twMerge("border border-mo-line bg-mo-panel/80", className)}>
			{children}
		</div>
	)
}

/** Pulsante "a linguetta" con l'angolo smussato */
export function TabButton({
	children,
	onClick,
	className,
	disabled,
}: {
	children: ReactNode
	onClick?: () => void
	className?: string
	disabled?: boolean
}) {
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={onClick}
			className={twMerge(
				"h-[18px] min-w-28 cursor-pointer border border-mo-line bg-mo-panel-2 px-1.5 text-left text-[12px] leading-none text-mo-accent",
				"hover:bg-[#123e80] hover:text-white disabled:cursor-default disabled:opacity-40",
				className,
			)}
			style={{ clipPath: "polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 0 100%)" }}
		>
			{children}
		</button>
	)
}

/** Dialog di sistema blu, centrato */
export function Dialog({ text, actions }: { text: ReactNode; actions: { label: string; onClick: () => void }[] }) {
	return (
		<div className="absolute inset-0 z-50 flex items-center justify-center">
			<div
				className="relative h-[162px] w-[396px] border-2 border-mo-line bg-[#0b2f6e] p-1.5 text-[12.5px] shadow-[0_0_24px_#3a8fe055]"
				style={{ clipPath: "polygon(0 0, 72% 0, 75% 6px, 100% 6px, 100% calc(100% - 10px), 96% 100%, 0 100%)" }}
			>
				<div className="whitespace-pre-wrap">{text}</div>
				<div className="absolute right-1.5 bottom-2 flex gap-2">
					{actions.map((a) => (
						<TabButton key={a.label} onClick={a.onClick}>
							{a.label}
						</TabButton>
					))}
				</div>
			</div>
		</div>
	)
}

/** Testo che compare carattere per carattere (effetto macchina da scrivere) */
export function Typewriter({ text, speed = 60, className }: { text: string; speed?: number; className?: string }) {
	// Il contatore è legato al testo: se il testo cambia si riparte da zero
	const [progress, setProgress] = useState({ text, shown: 0 })
	const shown = progress.text === text ? progress.shown : 0
	useEffect(() => {
		const id = setInterval(
			() => setProgress((p) => (p.text !== text ? { text, shown: 2 } : p.shown >= text.length ? p : { text, shown: p.shown + 2 })),
			1000 / speed,
		)
		return () => clearInterval(id)
	}, [text, speed])
	return <span className={className}>{text.slice(0, shown)}</span>
}
