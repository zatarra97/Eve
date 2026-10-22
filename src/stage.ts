// Larghezza logica del palco: l'altezza resta 768 come nell'originale, la larghezza segue
// le proporzioni della finestra (minimo 1024), così il desktop usa tutto lo schermo.

import { createContext, useContext } from "react"
import { STAGE_W } from "./assets"

export const StageWidth = createContext(STAGE_W)

export function useStageWidth() {
	return useContext(StageWidth)
}
