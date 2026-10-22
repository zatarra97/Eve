// Conversione dei record GML (file .svr / .miss) nei tipi del motore.

import { toNumber, toStr, type Value } from "./gml/interpreter"
import { evalDefinition, GmlRecord, type RecordEnvOptions } from "./gml/record"
import { normPath } from "./content"
import {
	TERMINALS,
	type GameFile,
	type MailMessage,
	type MissionDef,
	type MissionType,
	type NewsItem,
	type Prim,
	type ProtectionKind,
	type ServerDef,
	type ServerUser,
	type TerminalKind,
} from "./types"

const prim = (v: Value | undefined, fallback: Prim = ""): Prim => (v === undefined ? fallback : typeof v === "object" ? v.gmlName : v)
const str = (v: Value | undefined) => (v === undefined ? "" : toStr(v))
const num = (v: Value | undefined, fallback = 0) => (v === undefined ? fallback : toNumber(v))
const bool = (v: Value | undefined) => v !== undefined && (typeof v === "number" ? v > 0.5 : v === "true")

/** Testo dei file: CRLF del gioco → \n */
const text = (v: Value | undefined) => str(v).replace(/\r\n?/g, "\n")

function terminalOf(v: Value | undefined): TerminalKind | null {
	const s = str(v)
	return (TERMINALS as readonly string[]).includes(s) ? (s as TerminalKind) : null
}

function protectionOf(v: Value | undefined): ProtectionKind | null {
	const s = str(v)
	return s === "Login" || s === "KeyFile" || s === "VRLS" ? s : null
}

export function filesOf(r: GmlRecord, countVar = "TotFiles"): GameFile[] {
	const count = num(r.get(countVar))
	const files: GameFile[] = []
	for (let i = 1; i <= count; i++) {
		const name = r.get("FileName", [i])
		if (name === undefined) continue
		files.push({
			name: str(name),
			dim: num(r.get("FileDim", [i])),
			img: prim(r.get("FileImg", [i]), -1),
			contents: text(r.get("FileContents", [i])),
			owner: prim(r.get("FileOwner", [i]), ""),
		})
	}
	return files
}

function usersOf(r: GmlRecord): ServerUser[] {
	const count = num(r.get("Users"))
	const users: ServerUser[] = []
	for (let i = 1; i <= count; i++) {
		const username = r.get("Username", [i])
		if (username === undefined) continue
		users.push({
			username: str(username),
			password: str(r.get("Password", [i])),
			userClass: str(r.get("UserClass", [i])),
			ranking: num(r.get("UserRanking", [i])),
			credits: num(r.get("UserCredits", [i])),
		})
	}
	return users
}

export function serverFromRecord(r: GmlRecord, source: string): ServerDef {
	return {
		ip: str(r.get("IP")),
		name: str(r.get("ServerName")),
		type: str(r.get("ServerType")),
		welcome: text(r.get("WelcomeText")),
		mapX: num(r.get("MapX")),
		mapY: num(r.get("MapY")),
		terminal: terminalOf(r.get("TerminalInterface")),
		protection: protectionOf(r.get("Protection")),
		firewall: bool(r.get("Firewall")),
		firewallMask: str(r.get("FirewallMask")) || "*.*.*.*",
		hacked: bool(r.get("Hacked")),
		background: prim(r.get("Background"), -1),
		cpu: num(r.get("Cpu"), 1000),
		net: num(r.get("Net"), 100),
		cantBeHacked: bool(r.get("CantBeHacked")),
		cantBeNuked: bool(r.get("CantBeNuked")),
		cantBeDestroyed: bool(r.get("CantBeDestroyed")),
		allowRandomMission: bool(r.get("AllowRandomMission")),
		missGenFaction: str(r.get("MissGenFaction")),
		users: usersOf(r),
		files: filesOf(r),
		source,
	}
}

export function loadServer(source: string, path: string, opts: RecordEnvOptions = {}): ServerDef {
	return serverFromRecord(evalDefinition(source, opts), path)
}

function mailsOf(r: GmlRecord, prefix: "MissionBegin" | "MissionEnd"): MailMessage[] {
	const count = num(r.get(`${prefix}Messages`))
	const mails: MailMessage[] = []
	for (let i = 1; i <= count; i++) {
		const from = r.get(`${prefix}From`, [i])
		if (from === undefined) continue
		mails.push({ from: str(from), subject: str(r.get(`${prefix}Subject`, [i])), body: text(r.get(`${prefix}Body`, [i])) })
	}
	return mails
}

function newsOf(r: GmlRecord): NewsItem[] {
	const count = num(r.get("MissionEndNews"))
	const news: NewsItem[] = []
	for (let i = 1; i <= count; i++) {
		const server = r.get("MissionEndNewsServerName", [i])
		if (server === undefined) continue
		news.push({ server: str(server), title: str(r.get("MissionEndNewsTitle", [i])), body: text(r.get("MissionEndNewsBody", [i])) })
	}
	return news
}

export function missionFromRecord(r: GmlRecord, path: string): MissionDef {
	return {
		path: normPath(path),
		id: str(r.get("ID")),
		name: str(r.get("Name")),
		type: str(r.get("MissionType")) as MissionType,
		begin: mailsOf(r, "MissionBegin"),
		targetMailFrom: str(r.get("TargetMailFrom")),
		targetMailSubject: str(r.get("TargetMailSubject")),
		targetMailAttachment: str(r.get("TargetMailAttachment")),
		noMailNeeded: bool(r.get("NoMailNeeded")),
		refServerIP: str(r.get("RefServerIP")),
		refRemoteFileToDelete: str(r.get("RefRemoteFileToDelete")),
		refRemoteFileUploaded: str(r.get("RefRemoteFileUploaded")),
		targetChatServerIP: str(r.get("TargetChatServerIP")),
		rankingToGet: num(r.get("RankingToGet")),
		localFileName: str(r.get("LocalFileName")),
		clusterExeName: str(r.get("ClusterExeName")),
		clusterMaxClients: num(r.get("ClusterMaxClients")),
		credits: num(r.get("Credits")),
		extraRanking: num(r.get("ExtraRanking")),
		nextMission: normPath(str(r.get("NextMission"))),
		serverIPToRemove: str(r.get("ServerIPToRemove")),
		replyMailText: text(r.get("ReplyMailText")),
		end: mailsOf(r, "MissionEnd"),
		endNews: newsOf(r),
	}
}

/**
 * Carica una missione eseguendone il file: le chiamate presenti (AddToNetworkMap, AddFile…)
 * vengono eseguite subito tramite opts.call, come nel gioco originale.
 */
export function loadMission(source: string, path: string, opts: RecordEnvOptions = {}): MissionDef {
	return missionFromRecord(evalDefinition(source, opts), path)
}

/** Righe della chat: utenti, messaggi casuali e log pubblici (espressioni da rivalutare a ogni uso) */
export interface ChatDef {
	users: string[]
	/** Sorgente GML completo: i messaggi si rigenerano rivalutandolo */
	source: string
	messages: number
	logs: number
}
