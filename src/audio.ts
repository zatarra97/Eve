// Suoni dell'interfaccia e musica di sottofondo (file originali in public/game/sounds).

import { useSettings } from "@/store/settings"

const base = import.meta.env.BASE_URL + "game/sounds/"
const cache = new Map<string, HTMLAudioElement>()

export function playSound(name: string, volume = 0.6) {
	if (!useSettings.getState().sounds) return
	try {
		let a = cache.get(name)
		if (!a) {
			a = new Audio(`${base}${name}.wav`)
			cache.set(name, a)
		}
		const clip = a.cloneNode() as HTMLAudioElement
		clip.volume = volume
		void clip.play().catch(() => {})
	} catch {
		// audio non disponibile (autoplay bloccato, test…)
	}
}

const TRACKS = ["01 - Lonelyness is better of some other things.ogg", "02 - Streaming Overdrive.ogg"]
let music: HTMLAudioElement | null = null
/** Musica di sottofondo richiesta dalle impostazioni (resta in pausa mentre suona MomAMP) */
let musicOn = false
let player: HTMLAudioElement | null = null

export function setMusic(on: boolean) {
	musicOn = on
	if (!on || (player && !player.paused)) {
		music?.pause()
		return
	}
	if (!music) {
		let i = 0
		music = new Audio(base + encodeURIComponent(TRACKS[0]))
		music.volume = 0.35
		music.addEventListener("ended", () => {
			i = (i + 1) % TRACKS.length
			music!.src = base + encodeURIComponent(TRACKS[i])
			void music!.play().catch(() => {})
		})
	}
	void music.play().catch(() => {})
}

/** MomAMP: suona un brano (URL completo) al posto della musica di sottofondo */
export function playTrack(url: string, onEnded: () => void) {
	stopTrack(false)
	music?.pause()
	player = new Audio(url)
	player.volume = 0.5
	player.addEventListener("ended", onEnded)
	void player.play().catch(() => {})
}

/** Ferma MomAMP; la musica di sottofondo riprende se è attiva nelle impostazioni */
export function stopTrack(resume = true) {
	player?.pause()
	player = null
	if (resume) setMusic(musicOn)
}

/** Posizione e durata (secondi) del brano di MomAMP */
export function trackTime(): { pos: number; dur: number } {
	return { pos: player?.currentTime ?? 0, dur: player && Number.isFinite(player.duration) ? player.duration : 0 }
}
