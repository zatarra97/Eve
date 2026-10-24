// Icone vettoriali nello stile dei pulsanti originali (riquadro blu, bordo azzurro, angolo
// smussato in alto a destra). Sostituiscono gli sprite 32/48 px, che ingranditi si sgranano.

import { useId, useState } from "react"
import { twMerge } from "tailwind-merge"

/** Riquadro del pulsante: angolo in alto a destra tagliato, come apps_button e mail_button */
function Frame({ size, cut, hover, active, alert, children }: { size: number; cut: number; hover: boolean; active?: boolean; alert?: boolean; children: React.ReactNode }) {
	const id = useId()
	const s = size
	const path = `M1.5 1.5 H${s - cut} L${s - 1.5} ${cut} V${s - 1.5} H1.5 Z`
	const top = alert ? "#d8252c" : active ? "#2b78d8" : hover ? "#2a6bc4" : "#1d559f"
	const bottom = alert ? "#7a0d12" : active ? "#0f3f86" : hover ? "#0f3a7a" : "#0a2a5e"
	return (
		<svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className="block">
			<defs>
				<linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stopColor={top} />
					<stop offset="1" stopColor={bottom} />
				</linearGradient>
				<linearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
					<stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
				</linearGradient>
			</defs>
			<path d={path} fill={`url(#${id}-bg)`} />
			<path d={path} fill={`url(#${id}-shine)`} />
			<path d={path} fill="none" stroke={hover || active ? "#a9d6ff" : "#6fb8ff"} strokeWidth="1.5" />
			{children}
		</svg>
	)
}

/** Pulsante Applicazioni "M" (48x48) */
export function AppsIcon({ active, onClick, className }: { active?: boolean; onClick?: () => void; className?: string }) {
	const [hover, setHover] = useState(false)
	const id = useId()
	// Ricalcata da apps_button.png: M quasi dritta (lieve inclinazione in avanti), aste spesse,
	// V centrale che scende fin quasi alla base, alone azzurro morbido dietro la lettera
	const m = "M10.8 35 L12.2 13.5 H18.7 L23.4 26 L29.7 13.5 H36.2 L34.8 35 H29.1 L29.95 22 L24.46 32.5 H21.46 L17.35 22 L16.5 35 Z"
	return (
		<button
			type="button"
			title="Pulsante Applicazioni"
			onClick={onClick}
			onMouseEnter={() => setHover(true)}
			onMouseLeave={() => setHover(false)}
			data-tut="apps"
			className={twMerge("cursor-pointer", className)}
		>
			<Frame size={48} cut={12} hover={hover} active={active}>
				<defs>
					<radialGradient id={`${id}-halo`} cx="0.5" cy="0.5" r="0.5">
						<stop offset="0" stopColor="#7fb4ff" stopOpacity={hover || active ? 0.75 : 0.55} />
						<stop offset="1" stopColor="#7fb4ff" stopOpacity="0" />
					</radialGradient>
					<filter id={`${id}-glow`} x="-30%" y="-30%" width="160%" height="160%">
						<feGaussianBlur stdDeviation="1.2" />
					</filter>
				</defs>
				<ellipse cx="23" cy="24.5" rx="17" ry="14" fill={`url(#${id}-halo)`} />
				<path d={m} fill="#dfeeff" opacity="0.7" filter={`url(#${id}-glow)`} />
				<path d={m} fill="#ffffff" strokeLinejoin="round" />
			</Frame>
		</button>
	)
}

/** Icona della posta (32x32) con il contatore dei messaggi non letti */
export function MailIcon({ unread, active, onClick, className }: { unread: number; active?: boolean; onClick?: () => void; className?: string }) {
	const [hover, setHover] = useState(false)
	const label = unread > 99 ? "99+" : String(unread)
	return (
		<button
			type="button"
			title={unread ? `Posta: ${unread} da leggere` : "Posta"}
			onClick={onClick}
			onMouseEnter={() => setHover(true)}
			onMouseLeave={() => setHover(false)}
			data-tut="mail"
			className={twMerge("relative cursor-pointer", className)}
		>
			<Frame size={32} cut={8} hover={hover} active={active}>
				<rect x="6.5" y="10" width="19" height="13" rx="1" fill="none" stroke="#ffffff" strokeWidth="1.6" />
				<path d="M7 10.8 L16 17.6 L25 10.8" fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinejoin="round" />
				<path d="M7 22.4 L13.2 16.4 M25 22.4 L18.8 16.4" fill="none" stroke="#ffffff" strokeWidth="1.2" />
			</Frame>
			{unread > 0 && (
				<span className="absolute -top-1.5 -left-1.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full border border-white bg-mo-alert px-[3px] text-[10px] leading-none font-bold text-white shadow-[0_0_6px_#d8252c]">
					{label}
				</span>
			)}
		</button>
	)
}

/** Pulsante quadrato 32x32 con un simbolo bianco (schermata di login) */
function SmallIconButton({ title, onClick, className, children }: { title: string; onClick?: () => void; className?: string; children: React.ReactNode }) {
	const [hover, setHover] = useState(false)
	return (
		<button
			type="button"
			title={title}
			onClick={onClick}
			onMouseEnter={() => setHover(true)}
			onMouseLeave={() => setHover(false)}
			className={twMerge("cursor-pointer", className)}
		>
			<Frame size={32} cut={8} hover={hover}>
				{children}
			</Frame>
		</button>
	)
}

/** Informazioni: "i" bianca */
export function InfoIcon(props: { onClick?: () => void; className?: string }) {
	return (
		<SmallIconButton title="Informazioni" {...props}>
			<circle cx="15.5" cy="9.6" r="2.1" fill="#ffffff" />
			<path d="M12.6 13.6 H17.4 V22.4 H19.4 V25 H12.6 V22.4 H14.6 V16.2 H12.6 Z" fill="#ffffff" />
		</SmallIconButton>
	)
}

/** Impostazioni: ingranaggio a otto denti */
export function SettingsIcon(props: { onClick?: () => void; className?: string }) {
	return (
		<SmallIconButton title="Impostazioni" {...props}>
			<g transform="translate(15.5 17)">
				{[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
					<rect key={a} x="-1.9" y="-10" width="3.8" height="5" rx="0.6" fill="#ffffff" transform={`rotate(${a})`} />
				))}
				<circle r="6.6" fill="#ffffff" />
				<circle r="2.7" fill="#164a8e" />
			</g>
		</SmallIconButton>
	)
}
