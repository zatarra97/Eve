// Runtime API di Mother (Scripting HOW-TO §2): gli oggetti System e Host e le funzioni dedicate,
// disponibili negli script (.script) e nel codice eseguito al caricamento delle missioni.

import { ExitSignal, isObject, toNumber, toStr, type GmlObject, type Value } from "./gml/interpreter"
import { RESOURCE_GLOBAL, type RecordEnvOptions } from "./gml/record"
import { connectionBandwidth } from "./balance"
import type { Game } from "./game"
import type { GameFile, ServerState } from "./types"

/** Oggetto GML che rappresenta un server del Network (restituito da FindServer) */
export interface ServerObject extends GmlObject {
	readonly server: ServerState
}

const at = <T>(list: T[], index?: number[]): T | undefined => (index ? list[index[0] - 1] : undefined)

export class Runtime {
	private game: Game
	readonly System: GmlObject
	readonly Host: GmlObject

	constructor(game: Game) {
		this.game = game
		this.System = this.makeSystem()
		this.Host = this.makeHost()
	}

	/** Opzioni d'ambiente per eseguire file di definizione e script con accesso al motore */
	envOptions(): RecordEnvOptions {
		return {
			objects: { System: this.System, Host: this.Host, global: RESOURCE_GLOBAL },
			call: (name, args, line) => this.call(name, args, line),
		}
	}

	private makeSystem(): GmlObject {
		const g = this.game
		return {
			gmlName: "System",
			get: (prop, index) => {
				const s = g.state
				const known = s.known.map((ip) => g.network.server(ip)).filter(Boolean) as ServerState[]
				const nodes = g.network.connection?.nodes ?? []
				switch (prop) {
					case "Version":
						return "1.02"
					case "IP":
						return g.network.localIP
					case "CurrUser":
						return s.user
					case "UserClass":
						return g.userClass
					case "UserRanking":
						return s.ranking
					case "UserCredits":
						return s.credits
					case "CpuDesc":
						return s.hardware.cpu.desc
					case "CpuUsed":
						return g.cpuUsed
					case "FlashramDesc":
						return s.hardware.flashram.desc
					case "FlashramUsed":
						return g.flashramUsed
					case "NetDesc":
						return s.hardware.net.desc
					case "NetUsed":
						return g.netUsed
					case "TotFiles":
						return s.files.length
					case "FileName":
						return at(s.files, index)?.name ?? ""
					case "FileDim":
						return at(s.files, index)?.dim ?? 0
					case "TotMails":
						return s.mails.length
					case "MailFrom":
						return at(s.mails, index)?.from ?? ""
					case "MailSubject":
						return at(s.mails, index)?.subject ?? ""
					case "MailBody":
						return at(s.mails, index)?.body ?? ""
					case "OnLine":
						return g.network.connection?.status === "connected" ? 1 : 0
					case "WallpaperIndex":
						return s.settings.wallpaper
					case "TotKnownServers":
						return known.length
					case "KnownServerName":
						return at(known, index)?.name ?? ""
					case "KnownIP":
						return at(known, index)?.ip ?? ""
					case "TotNodes":
						return nodes.length
					case "NodeIP":
						return at(nodes, index) ?? ""
				}
				return 0
			},
			set: (prop, value) => {
				if (prop === "WallpaperIndex") {
					g.state.settings.wallpaper = Math.min(4, Math.max(1, Math.round(toNumber(value))))
					g.changed()
				}
			},
		}
	}

	private makeHost(): GmlObject {
		const g = this.game
		return {
			gmlName: "Host",
			get: (prop, index) => {
				const c = g.network.connection
				const srv = c?.status === "connected" ? g.network.server(c.target) : undefined
				if (!srv || !c) return prop === "TotFiles" || prop === "Users" ? 0 : ""
				const files = g.network.visibleFiles()
				switch (prop) {
					case "ServerName":
						return srv.name
					case "IP":
						return srv.ip
					case "ServerType":
						return srv.type
					case "WelcomeText":
						return srv.welcome
					case "Firewall":
						return srv.firewall ? 1 : 0
					case "FirewallMask":
						return srv.firewallMask
					case "Hacked":
						return srv.seizedUntil ? 1 : 0
					case "Forced":
						return c.forced ? 1 : 0
					case "Logged":
						return c.logged !== undefined ? 1 : 0
					case "Users":
						return srv.users.length
					case "Username":
						return at(srv.users, index)?.username ?? ""
					case "TotFiles":
						return files.length
					case "FileName":
						return at(files, index)?.name ?? ""
					case "FileDim":
						return at(files, index)?.dim ?? 0
					case "FileOwner":
						return at(files, index)?.owner ?? ""
				}
				return 0
			},
			set: () => {},
		}
	}

	serverObject(server: ServerState): ServerObject {
		return {
			gmlName: server.name,
			server,
			get: (prop, index) => {
				switch (prop) {
					case "ServerName":
						return server.name
					case "IP":
						return server.ip
					case "TotFiles":
						return server.files.length
					case "FileName":
						return at(server.files, index)?.name ?? ""
				}
				return 0
			},
			set: () => {},
		}
	}

	/** Risolve la destinazione di AddFile/DownloadFile: System, Host o un server */
	private target(v: Value): { local: true } | { local: false; server: ServerState } | null {
		if (!isObject(v)) {
			const srv = this.game.network.server(toStr(v))
			return srv ? { local: false, server: srv } : null
		}
		if (v === this.System) return { local: true }
		if (v === this.Host) {
			const c = this.game.network.connection
			const srv = c ? this.game.network.server(c.target) : undefined
			return srv ? { local: false, server: srv } : null
		}
		if ("server" in v) return { local: false, server: (v as ServerObject).server }
		return null
	}

	/** Funzioni dedicate; undefined = non è una funzione della Runtime API */
	call(name: string, a: Value[], _line: number): Value | undefined {
		const g = this.game
		const net = g.network
		const s = (i: number) => (a[i] === undefined ? "" : toStr(a[i]))
		const n = (i: number) => (a[i] === undefined ? 0 : toNumber(a[i]))

		switch (name.toLowerCase()) {
			// --- sistema ---
			case "addtolog":
				g.debug(s(0))
				return 0
			case "execcommand":
				g.shell.exec(s(0), { silent: false })
				return 0
			case "consolestdout":
				g.log(s(0))
				return 0
			case "msgbox":
				g.emit({ type: "ui", action: "msgbox", arg: s(0) })
				return 0
			case "hideconsole":
				g.emit({ type: "ui", action: "console", arg: n(0) })
				return 0
			case "hidesysmon":
				g.emit({ type: "ui", action: "sysmon", arg: n(0) })
				return 0
			case "exitscript":
				throw new ExitSignal()
			case "loadscriptobject":
				g.scripts.start(s(0))
				return 0

			// --- posta ---
			case "receivemail":
				g.receiveMail({ from: s(0), subject: s(1), body: s(2).replace(/\r\n?/g, "\n") })
				return 0
			case "deletemessage": {
				const mail = g.state.mails[n(0) - 1]
				if (mail) g.deleteMail(mail.id)
				return 0
			}

			// --- file ---
			case "findlocalfile": {
				const i = g.findLocalFile(s(0))
				return i < 0 ? -1 : i + 1
			}
			case "deletelocalfile":
				g.deleteLocalFile(n(0) - 1, true)
				return 0
			case "findremotefile": {
				const i = net.visibleFiles().findIndex((f) => f.name.toLowerCase() === s(0).toLowerCase())
				return i < 0 ? -1 : i + 1
			}
			case "findremotefileglobal": {
				const srv = net.connection ? net.server(net.connection.target) : undefined
				const i = srv ? srv.files.findIndex((f) => f.name.toLowerCase() === s(0).toLowerCase()) : -1
				return i < 0 ? -1 : i + 1
			}
			case "deleteremotefile": {
				const f = net.visibleFiles()[n(0) - 1]
				if (f) net.deleteRemoteFile(f, true)
				return 0
			}
			case "downloadfile": {
				const src = this.target(a[0])
				const dst = this.target(a[1])
				if (!src || !dst) return 0
				const file = src.local ? g.state.files[n(2) - 1] : net.visibleFilesOf(src.server)[n(2) - 1]
				if (!file) return 0
				if (dst.local) g.addLocalFile({ ...file, owner: g.state.user })
				else net.putFile(dst.server, { ...file, owner: net.connection?.logged ?? "" })
				return 0
			}
			case "addfile": {
				// AddFile(destinazione, nome, dim, img, contenuti, proprietario)
				const dst = this.target(a[0])
				if (!dst) return 0
				const file: GameFile = {
					name: s(1),
					dim: n(2),
					img: a[3] === undefined ? -1 : isObject(a[3]) ? a[3].gmlName : a[3],
					contents: s(4).replace(/\r\n?/g, "\n"),
					owner: a[5] === undefined ? "" : isObject(a[5]) ? a[5].gmlName : a[5],
				}
				if (dst.local) g.addLocalFile(file)
				else net.putFile(dst.server, file)
				return 0
			}

			// --- rete ---
			case "findserver": {
				const srv = net.server(s(0))
				return srv ? this.serverObject(srv) : -1
			}
			case "addtonetworkmap":
				net.addKnown(s(0))
				return 0
			case "setnode":
				net.addNode(s(0))
				return 0
			case "removelastnode":
				net.removeLastNode()
				return 0
			case "connecttohost":
			case "composeip":
				net.connectDirect(s(0))
				return 0
			case "disconnect":
				net.disconnect()
				return 0
			case "logout":
				net.logout()
				return 0
			case "offlineremoveserver":
				net.removeServer(s(0))
				return 0
			case "addtochatlog":
				net.addChatLine(s(0), s(1))
				return 0
			case "addtonewsserver":
				net.addNews(s(0), s(1), s(2))
				return 0

			// --- missioni ---
			case "loadmission":
			case "addmission":
				g.missions.load(s(0))
				return 0

			// --- virus e oggetti GM ---
			case "instance_create":
				g.viruses.infect(s(2))
				return 0

			// --- file su disco (mod): file system virtuale per utente ---
			case "file_exists":
				return this.vfsPath(s(0)) in g.state.vfs || this.isNotepadPath(s(0)) ? 1 : 0
			case "file_text_open_read":
				return this.openFile(s(0), "r")
			case "file_text_open_write":
				return this.openFile(s(0), "w")
			case "file_text_open_append":
				return this.openFile(s(0), "a")
			case "file_text_read_string":
				return this.readLine(n(0))
			case "file_text_readln":
				this.nextLine(n(0))
				return 0
			case "file_text_eof":
				return this.eof(n(0)) ? 1 : 0
			case "file_text_write_string":
				this.write(n(0), s(1))
				return 0
			case "file_text_writeln":
				this.write(n(0), "\n")
				return 0
			case "file_text_close":
				this.close(n(0))
				return 0
		}
		return undefined
	}

	// --- file system virtuale (per gli script delle mod: PadBack, MailSave) ---

	private handles = new Map<number, { path: string; mode: "r" | "w" | "a"; lines: string[]; line: number; buffer: string }>()
	private nextHandle = 1

	private vfsPath(p: string) {
		return p.replace(/\\/g, "/").toLowerCase()
	}

	private isNotepadPath(p: string) {
		return this.vfsPath(p) === `users/${this.game.state.user.toLowerCase()}/mompad.txt`
	}

	private openFile(path: string, mode: "r" | "w" | "a"): number {
		const content = this.isNotepadPath(path) ? this.game.state.notepad : (this.game.state.vfs[this.vfsPath(path)] ?? "")
		const id = this.nextHandle++
		this.handles.set(id, { path, mode, lines: content.split("\n"), line: 0, buffer: mode === "a" ? content : "" })
		return id
	}
	private readLine(id: number) {
		const h = this.handles.get(id)
		return h ? (h.lines[h.line] ?? "") : ""
	}
	private nextLine(id: number) {
		const h = this.handles.get(id)
		if (h) h.line++
	}
	private eof(id: number) {
		const h = this.handles.get(id)
		return !h || h.line >= h.lines.length
	}
	private write(id: number, text: string) {
		const h = this.handles.get(id)
		if (h && h.mode !== "r") h.buffer += text
	}
	private close(id: number) {
		const h = this.handles.get(id)
		if (!h) return
		this.handles.delete(id)
		if (h.mode === "r") return
		if (this.isNotepadPath(h.path)) this.game.state.notepad = h.buffer
		else this.game.state.vfs[this.vfsPath(h.path)] = h.buffer
		this.game.changed()
	}
}

/** Banda di una connessione, riesportata per comodità degli script */
export { connectionBandwidth }
