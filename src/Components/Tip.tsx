// Consiglio del mentore: un riquadro discreto in basso a destra, sopra le icone di posta e Diario,
// che resta finché il giocatore non lo chiude. I consigli già dati si rileggono nella Guida.

import { MENTOR } from "@/content/tips"
import { GlossaryText } from "./Glossary"
import { TabButton } from "./ui"

export function TipToast({ text, more, onClose }: { text: string; /** Altri consigli in coda */ more: number; onClose: () => void }) {
	return (
		<div className="absolute right-0.5 bottom-[96px] z-30 w-[270px] border border-mo-ok/80 bg-[#06173a]/90 px-2 py-1.5 text-[12px] leading-[15px] shadow-[0_0_14px_#2fae4a40] backdrop-blur-[3px]">
			<div className="flex items-baseline justify-between font-title text-[9.5px] tracking-[0.1em] text-mo-ok uppercase">
				<span>Consiglio di {MENTOR}</span>
				{more > 0 && <span className="text-mo-accent normal-case">+{more}</span>}
			</div>
			<div className="mt-0.5 text-white">
				<GlossaryText text={text} />
			</div>
			<div className="mt-1 flex justify-end">
				<TabButton className="min-w-0" onClick={onClose}>
					Capito
				</TabButton>
			</div>
		</div>
	)
}
