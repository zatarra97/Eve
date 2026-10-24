import { createContext, useContext, type PointerEvent } from "react"

export type DragHandle = { onPointerDown: (e: PointerEvent) => void }

/** Fornito da Draggable a ogni finestra di programma */
export const DragContext = createContext<DragHandle | undefined>(undefined)

/** Proprietà da mettere sulla barra del titolo: tenendola premuta si sposta il programma */
export function useDragHandle(): DragHandle | undefined {
	return useContext(DragContext)
}
