// Parole del gioco originale sostituite da Eve con termini più comprensibili. Si applicano ai testi
// originali (mail delle missioni, chat) quando arrivano al giocatore; i file in public/game restano intatti.
// "Flashram" diventa "memoria", femminile come l'originale, così le frasi restano grammaticali.

const REPLACEMENTS: [RegExp, string][] = [
	[/dispositivo flash ?ram/gi, "dispositivo di memoria"],
	[/flash ?ram/gi, "memoria"],
]

export function eveWording(text: string): string {
	return REPLACEMENTS.reduce((s, [re, to]) => s.replace(re, to), text)
}
