// Suoni dell'interfaccia e musica di sottofondo (file originali in public/game/sounds).

const base = import.meta.env.BASE_URL + "game/sounds/"
const cache = new Map<string, HTMLAudioElement>()

export function playSound(name: string, volume = 0.6) {
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

export function setMusic(on: boolean) {
	if (!on) {
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
