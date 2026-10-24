// Finestre dei programmi trascinabili: ogni programma sta in un livello grande quanto il desktop che si
// sposta con transform, così le posizioni iniziali dei programmi restano quelle scritte nei loro className.
// Il programma indica la propria barra del titolo con useDragHandle().

import { useRef, useState, type ReactNode } from "react"
import { DragContext, type DragHandle } from "@/hooks/useDragHandle"

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export type Offset = { x: number; y: number }

export function Draggable({
	initial,
	onMove,
	onFocus,
	children,
}: {
	/** Spostamento rispetto alla posizione iniziale del programma */
	initial?: Offset
	onMove: (offset: Offset) => void
	onFocus: () => void
	children: ReactNode
}) {
	const layer = useRef<HTMLDivElement>(null)
	const [offset, setOffset] = useState(initial ?? { x: 0, y: 0 })
	const current = useRef(offset)

	const [handle] = useState<DragHandle>(() => ({
		onPointerDown(e) {
			const el = layer.current
			const area = el?.parentElement
			if (e.button !== 0 || !el || !area) return
			e.preventDefault()
			// Il palco è riscalato per riempire la finestra: gli spostamenti del mouse vanno riportati in pixel logici
			const scale = el.getBoundingClientRect().width / el.offsetWidth || 1
			// Il puntatore resta dentro il desktop, così la barra del titolo non può finire fuori schermo
			const bounds = area.getBoundingClientRect()
			const from = { x: e.clientX, y: e.clientY }
			const base = current.current
			const move = (ev: PointerEvent) => {
				const next = {
					x: base.x + (clamp(ev.clientX, bounds.left, bounds.right) - from.x) / scale,
					y: base.y + (clamp(ev.clientY, bounds.top, bounds.bottom) - from.y) / scale,
				}
				current.current = next
				setOffset(next)
			}
			const stop = () => {
				onMove(current.current)
				window.removeEventListener("pointermove", move)
				window.removeEventListener("pointerup", stop)
				window.removeEventListener("pointercancel", stop)
			}
			window.addEventListener("pointermove", move)
			window.addEventListener("pointerup", stop)
			window.addEventListener("pointercancel", stop)
		},
	}))

	return (
		<div
			ref={layer}
			className="pointer-events-none absolute inset-0 z-40 [&>*]:pointer-events-auto"
			style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
			onPointerDownCapture={onFocus}
		>
			<DragContext.Provider value={handle}>{children}</DragContext.Provider>
		</div>
	)
}
