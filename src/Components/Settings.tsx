// Pannello delle impostazioni (Manuale §1.8): opzioni generali del browser e, dentro una partita,
// lo sfondo del desktop dell'account.

import type { ReactNode } from "react"
import { asset } from "@/assets"
import type { Game } from "@/engine/game"
import { useSettings, type Settings as SettingsValues } from "@/store/settings"
import { setMusic } from "@/audio"
import { TabButton } from "./ui"

type BoolKey = { [K in keyof SettingsValues]: SettingsValues[K] extends boolean ? K : never }[keyof SettingsValues]

const OPTIONS: { key: BoolKey; label: string; hint: string }[] = [
	{ key: "music", label: "Tema Sonoro", hint: "Musiche di sottofondo" },
	{ key: "sounds", label: "Effetti Sonori", hint: "Suoni dell'interfaccia e degli eventi" },
	{ key: "openNewMail", label: "Apertura autom. Mail", hint: "Apre le nuove mail appena arrivano" },
	{ key: "mailPreview", label: "Anteprima Mail", hint: "Riquadro con mittente e oggetto all'arrivo" },
	{ key: "autosave", label: "Salvataggio automatico", hint: "Ogni minuto, al logout e alla chiusura" },
	{ key: "rememberPassword", label: "Ricorda Password", hint: "Ripropone l'ultimo account al login" },
]

/** Interruttore a due posizioni [Sì|No] */
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
	const seg = (on: boolean, label: string) => (
		<button
			type="button"
			onClick={() => onChange(on)}
			className={`h-[18px] w-9 cursor-pointer text-[11.5px] leading-none ${
				value === on ? "bg-[#2b78d8] text-white shadow-[inset_0_0_6px_#a9d6ff66]" : "text-mo-accent hover:bg-[#123e80]"
			}`}
		>
			{label}
		</button>
	)
	return (
		<div className="flex shrink-0 border border-mo-line">
			{seg(true, "Sì")}
			<span className="w-px bg-mo-line" />
			{seg(false, "No")}
		</div>
	)
}

function Row({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
	return (
		<div className="flex items-center gap-3 border-b border-mo-line-dim/50 py-[5px]">
			<div className="min-w-0 flex-1">
				<div className="text-[12.5px] text-white">{label}</div>
				<div className="truncate text-[11px] text-mo-accent/80">{hint}</div>
			</div>
			{children}
		</div>
	)
}

export default function Settings({ game, onClose }: { game?: Game; onClose: () => void }) {
	const settings = useSettings()

	function change(key: BoolKey, value: boolean) {
		settings.set({ [key]: value })
		if (key === "music" && game) setMusic(value)
	}

	return (
		<div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
			<div
				onClick={(e) => e.stopPropagation()}
				className="relative w-[430px] border-2 border-mo-line bg-[#0b2f6e]/95 px-3 pt-2 pb-3 shadow-[0_0_24px_#3a8fe055]"
				style={{ clipPath: "polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%)" }}
			>
				<div className="mb-1 font-title text-[12px] tracking-wide text-[#cfd8e6]">IMPOSTAZIONI</div>
				<div className="mb-1 text-[11px] text-mo-accent">Valide per tutti gli account di questo browser.</div>

				{OPTIONS.map((o) => (
					<Row key={o.key} label={o.label} hint={o.hint}>
						<Toggle value={settings[o.key]} onChange={(v) => change(o.key, v)} />
					</Row>
				))}

				{game && (
					<div className="pt-2">
						<div className="text-[12.5px] text-white">Sfondo Desktop</div>
						<div className="mb-1.5 text-[11px] text-mo-accent/80">Solo per l'account {game.address}</div>
						<div className="flex gap-2">
							{[1, 2, 3, 4].map((n) => (
								<button
									key={n}
									type="button"
									title={`Sfondo ${n}`}
									onClick={() => game.act(() => (game.state.settings.wallpaper = n))}
									className={`h-[60px] w-[92px] cursor-pointer border-2 bg-cover bg-center ${
										game.state.settings.wallpaper === n ? "border-white shadow-[0_0_8px_#a9d6ff]" : "border-mo-line-dim hover:border-mo-line"
									}`}
									style={{ backgroundImage: `url("${asset(`graphics/wallpaper_${n}.jpg`)}")` }}
								/>
							))}
						</div>
					</div>
				)}

				<div className="mt-3 flex justify-end">
					<TabButton onClick={onClose}>Chiudi</TabButton>
				</div>
			</div>
		</div>
	)
}
