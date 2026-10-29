// Diario: le missioni in corso con l'obiettivo in parole semplici, anche quelle che non hanno una
// mail di inizio. Si apre dall'icona accanto alla posta.

import { useState } from "react"
import { formatRemaining } from "@/engine/missgen"
import type { Objective } from "@/engine/objectives"
import { useGame } from "@/hooks/useGame"
import { GlossaryText } from "./Glossary"
import { TabButton, Window } from "./ui"

/** Riquadro con l'obiettivo di una missione; il suggerimento resta chiuso finché il giocatore non lo apre */
function ObjectiveBox({ objective, className }: { objective: Objective; className?: string }) {
	const [hintOpen, setHintOpen] = useState(false)
	return (
		<div className={`border-l-2 border-mo-ok bg-[#071226]/70 px-1.5 py-1 ${className ?? ""}`}>
			<div className="font-title text-[9.5px] tracking-[0.1em] text-mo-ok uppercase">
				Obiettivo{objective.progress && <span className="ml-1.5 text-mo-accent normal-case">[{objective.progress}]</span>}
			</div>
			<div className="text-white">
				<GlossaryText text={objective.text} />
			</div>
			{objective.hint && (
				<div className="mt-0.5 text-[11.5px]">
					<button type="button" className="cursor-pointer text-mo-line hover:text-mo-accent" onClick={() => setHintOpen((o) => !o)}>
						{hintOpen ? "▾" : "▸"} Suggerimento
					</button>
					{hintOpen && (
						<div className="mt-0.5 text-mo-accent">
							<GlossaryText text={objective.hint} />
						</div>
					)}
				</div>
			)}
		</div>
	)
}

export function Journal({ onClose }: { name: string; onClose: () => void }) {
	const game = useGame()
	const missions = game.missions.list().filter((m) => !m.done && m.objective)

	return (
		<Window title="Diario" className="top-[110px] left-[calc(50%-240px)] h-[360px] w-[480px]" actions={<TabButton onClick={onClose}>Chiudi</TabButton>}>
			<div className="mo-scroll min-h-0 flex-1 overflow-y-auto pr-1 text-[12px] leading-[15px]">
				{!missions.length && <div className="text-mo-accent">Nessuna missione in corso. Controlla la posta: i nuovi incarichi arrivano per mail.</div>}
				{missions.map((m) => (
					<div key={m.path} className="mb-2.5">
						<div className="flex items-baseline justify-between gap-2">
							<span className="truncate font-title text-[12px] text-mo-accent">{m.name || m.id}</span>
							{m.expiresAt !== undefined && <span className="shrink-0 text-[11px] text-mo-alert">scade tra {formatRemaining(m.expiresAt - game.now)}</span>}
						</div>
						<ObjectiveBox objective={m.objective!} className="mt-0.5" />
					</div>
				))}
			</div>
		</Window>
	)
}
