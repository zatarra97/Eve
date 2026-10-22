// Stato dell'interfaccia (non del gioco): schermata corrente, partita attiva, pannelli aperti.

import { create } from "zustand"
import type { ContentPack } from "@/engine/content"
import type { Game } from "@/engine/game"

export type Screen = "boot" | "login" | "desktop"

/** Pannello che occupa l'angolo in alto a destra (al posto del Sysmon) */
export type RightPanel = { kind: "mail"; id: number } | { kind: "compose"; replyTo: number } | null

interface AppState {
	screen: Screen
	pack: ContentPack | null
	game: Game | null
	/** Cambia a ogni partita avviata: rimonta il desktop (es. dopo un caricamento veloce) */
	gameId: number
	menuOpen: boolean
	sysmonExpanded: boolean
	netmapOpen: boolean
	consoleOpen: boolean
	right: RightPanel
	/** Messaggio di sistema modale (dialog blu) */
	dialog: { text: string; title?: string } | null

	setScreen: (s: Screen) => void
	setPack: (p: ContentPack) => void
	startGame: (g: Game) => void
	endGame: () => void
	toggleMenu: (open?: boolean) => void
	toggleSysmon: () => void
	setNetmap: (open: boolean) => void
	setConsole: (open: boolean) => void
	setRight: (r: RightPanel) => void
	showDialog: (text: string, title?: string) => void
	closeDialog: () => void
}

// In sviluppo la partita attiva è raggiungibile dalla console del browser come window.__eve
if (import.meta.env.DEV) {
	queueMicrotask(() =>
		useApp.subscribe((s) => {
			;(window as unknown as { __eve?: Game | null }).__eve = s.game
		}),
	)
}

export const useApp = create<AppState>((set) => ({
	screen: "boot",
	pack: null,
	game: null,
	gameId: 0,
	menuOpen: false,
	sysmonExpanded: false,
	netmapOpen: false,
	consoleOpen: false,
	right: null,
	dialog: null,

	setScreen: (screen) => set({ screen }),
	setPack: (pack) => set({ pack }),
	startGame: (game) => set((s) => ({ game, gameId: s.gameId + 1, screen: "desktop", menuOpen: false, netmapOpen: false, consoleOpen: false, right: null })),
	endGame: () => set({ game: null, screen: "login", menuOpen: false, netmapOpen: false, consoleOpen: false, right: null, dialog: null }),
	toggleMenu: (open) => set((s) => ({ menuOpen: open ?? !s.menuOpen })),
	toggleSysmon: () => set((s) => ({ sysmonExpanded: !s.sysmonExpanded })),
	setNetmap: (netmapOpen) => set({ netmapOpen, menuOpen: false }),
	setConsole: (consoleOpen) => set({ consoleOpen, menuOpen: false }),
	setRight: (right) => set({ right }),
	showDialog: (text, title) => set({ dialog: { text, title } }),
	closeDialog: () => set({ dialog: null }),
}))
