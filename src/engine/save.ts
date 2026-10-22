// Salvataggi degli account nel browser (localStorage). Ogni account ha il suo stato di partita;
// lo slot "quick" è il salvataggio veloce (F5/F9).

import { SAVE_VERSION, type GameState } from "./state"

const PREFIX = "eve.account."

export interface AccountInfo {
	user: string
	savedAt: number
}

function storage(): Storage | null {
	try {
		return window.localStorage
	} catch {
		return null
	}
}

function keyOf(user: string, slot: "auto" | "quick") {
	return `${PREFIX}${user.toLowerCase()}.${slot}`
}

export function listAccounts(): AccountInfo[] {
	const s = storage()
	if (!s) return []
	const out: AccountInfo[] = []
	for (let i = 0; i < s.length; i++) {
		const k = s.key(i)
		if (!k?.startsWith(PREFIX) || !k.endsWith(".auto")) continue
		const state = readState(k)
		if (state) out.push({ user: state.user, savedAt: state.clock })
	}
	return out.sort((a, b) => a.user.localeCompare(b.user))
}

function readState(key: string): GameState | null {
	try {
		const raw = storage()?.getItem(key)
		if (!raw) return null
		const state = JSON.parse(raw) as GameState
		return state.version === SAVE_VERSION ? state : null
	} catch {
		return null
	}
}

export function loadAccount(user: string, slot: "auto" | "quick" = "auto"): GameState | null {
	return readState(keyOf(user, slot))
}

export function saveAccount(state: GameState, slot: "auto" | "quick" = "auto"): boolean {
	try {
		storage()?.setItem(keyOf(state.user, slot), JSON.stringify(state))
		return true
	} catch {
		return false
	}
}

export function deleteAccount(user: string) {
	const s = storage()
	s?.removeItem(keyOf(user, "auto"))
	s?.removeItem(keyOf(user, "quick"))
}
