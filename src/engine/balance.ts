// Costanti e formule di bilanciamento. Le formule originali sono nel codice cifrato dell'exe:
// queste sono ricostruite dai valori osservati (docs/riferimento-originale.md) e dalla documentazione.

import type { HardwarePart } from "./types"

export const START_RANKING = 100
export const START_CREDITS = 60

export const START_HARDWARE: { cpu: HardwarePart; net: HardwarePart; flashram: HardwarePart } = {
	cpu: { name: "Warbit Ecostar 1000", desc: "Warbit Ecostar 1000 10 Ghz", value: 1000 },
	net: { name: "Mill Comm Etherlord 8M", desc: "Mill Communication Etherlord 8M 80 MBit", value: 80 },
	flashram: { name: "47-Logic Ulisse 1 Gyga", desc: "47-Logic Ulisse 1 Gyga 1024 Mbyte", value: 1024 },
}

/** Spazio occupato dal sistema operativo in flashram (12% osservato su 1024 MB) */
export const SYSTEM_FLASHRAM_MB = 120

/** Banda occupata da una connessione: 20 MBps con un nodo, 40 con due (osservato), cresce esponenzialmente */
export function connectionBandwidth(nodes: number): number {
	return nodes <= 0 ? 0 : 20 * 2 ** (nodes - 1)
}

/** Classi di utenza in base al ranking (Manuale §2.4). Il lato "cracker" dipende dal karma. */
export function userClass(ranking: number, karma: number, admin: boolean): string {
	if (admin) return "Admin"
	if (karma <= -150) return "Master Cracker"
	if (karma <= -50) return "Cracker"
	if (ranking < 50) return "Fool Lamer"
	if (ranking < 250) return "Lamer"
	if (ranking < 600) return "Scripter"
	if (ranking < 1200) return "Coder"
	if (ranking < 2500) return "Code Hacker"
	if (ranking < 8000) return "Hacker"
	return "Master Hacker"
}

/** Velocità relativa delle versioni di rootbreaker (la 1.01 ha reso il cracking più veloce del 30%) */
export function crackerSpeed(version: string): number {
	const v = parseFloat(version) || 1
	if (v >= 3) return 2.4
	if (v >= 2) return 1.6
	return 1
}

/** Secondi per craccare un account con rootbreaker */
export function crackSeconds(adminRanking: number, serverCpu: number, playerCpu: number, speed: number): number {
	return (2 + 0.03 * adminRanking * Math.sqrt(serverCpu / Math.max(1, playerCpu))) / speed / 1.3
}

/**
 * Secondi che il server impiega a completare un backtrace durante un accesso forzato.
 * Più nodi (e i proxy contano doppio) e più banda dal cluster = più tempo.
 */
export function traceSeconds(serverNet: number, adminRanking: number, hops: number, clusterClients: number): number {
	const base = 30 + (4000 * Math.max(1, hops) ** 1.3) / (Math.sqrt(Math.max(1, serverNet)) * (1 + adminRanking / 1000))
	return base * 1.5 ** clusterClients
}

/** Velocità del backtrace con backmirror aperto: rallentato del 30% */
export const BACKMIRROR_TRACE_SPEED = 0.7

/** Secondi per trasferire un file (MB) con la banda libera (MBps) */
export function transferSeconds(dimMB: number, freeMBps: number): number {
	return Math.max(0.5, (dimMB * 8) / Math.max(1, freeMBps))
}

/** Ranking guadagnato la prima volta che si forza l'accesso a un server */
export function violationRanking(adminRanking: number): number {
	return Math.max(1, Math.round(adminRanking / 40))
}

/** Penalità quando Intrapol notifica un reato */
export function crimePenalty(adminRanking: number, caughtLive: boolean): { ranking: number; credits: number } {
	const ranking = 10 + Math.round(adminRanking / 100)
	return caughtLive ? { ranking: ranking * 2, credits: 50 } : { ranking, credits: 0 }
}

/** Ritardi (secondi di gioco) — CrimeNotificationSteps=2000 e RefreshingServerSteps=6000 a 30 fps */
export const CRIME_NOTIFICATION_S = 2000 / 30
export const SERVER_REFRESH_S = 6000 / 30
export const NUKE_DURATION_S = 180

/** Secondi dell'attacco di nukelord: più è larga la banda del server rispetto a quella impiegata, più dura */
export function nukeSeconds(serverNet: number, freeMBps: number): number {
	return 8 + (20 * Math.max(1, serverNet)) / Math.max(1, freeMBps)
}

/** Ritardo casuale di consegna delle mail (secondi) */
export const MAIL_DELAY_S: [number, number] = [4, 15]

/** Prelievo massimo "sicuro" da un Netbanking: oltre scatta il tracciamento immediato */
export const NETBANKING_SAFE_RATIO = 1

/** Karma perso a ogni trasferimento da un Netbanking: rubare crediti è da cracker (Manuale §2.6) */
export const NETBANKING_KARMA_PENALTY = 10
