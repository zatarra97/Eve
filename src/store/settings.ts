// Impostazioni generali di Eve, valide per tutti gli account di questo browser (localStorage).
// Riprendono il Pannello di Controllo dell'originale (Manuale §1.8), senza risoluzione e
// profondità di colore, che in un browser non servono. Lo sfondo del desktop resta invece
// nello stato di ogni partita, perché anche gli script del gioco lo cambiano.

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export interface Settings {
	/** Tema sonoro: musiche di sottofondo */
	music: boolean
	/** Suoni dell'interfaccia (click, mail in arrivo, connessioni…) */
	sounds: boolean
	/** Apre automaticamente le nuove mail alla ricezione */
	openNewMail: boolean
	/** Mostra un riquadro di anteprima quando arriva una mail */
	mailPreview: boolean
	/** Salva la partita ogni minuto e alla chiusura della pagina */
	autosave: boolean
	/** Ripropone l'ultimo account (e la sua password) nella schermata di login */
	rememberPassword: boolean
	/** Ultimo account usato, per rememberPassword */
	lastUser: string
}

interface SettingsState extends Settings {
	set: (patch: Partial<Settings>) => void
}

export const DEFAULT_SETTINGS: Settings = {
	music: true,
	sounds: true,
	openNewMail: false,
	mailPreview: true,
	autosave: true,
	rememberPassword: true,
	lastUser: "",
}

/** localStorage può non essere disponibile (navigazione privata, dati bloccati): si va avanti senza */
const safeStorage = createJSONStorage(() => {
	try {
		const s = window.localStorage
		s.getItem("eve.test")
		return s
	} catch {
		const mem = new Map<string, string>()
		return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) }
	}
})

export const useSettings = create<SettingsState>()(
	persist(
		(set) => ({
			...DEFAULT_SETTINGS,
			set: (patch) => set(patch),
		}),
		{ name: "eve.settings", storage: safeStorage, partialize: ({ set: _set, ...rest }) => rest },
	),
)
