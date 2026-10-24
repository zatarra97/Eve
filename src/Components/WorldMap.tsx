// Sfondo vettoriale della Network Map: continenti e confini da Natural Earth (world-atlas, 1:50m)
// con griglia di meridiani e paralleli, in stile "olografico".
//
// La proiezione è equirettangolare come earth_map.jpg dell'originale (1280x640, longitudine
// -180..180, latitudine 90..-90), così i server restano dove li mettono MapX/MapY nei file .svr:
// il disegno viene stirato nel pannello esattamente come prima veniva stirata l'immagine.

import { useEffect, useId, useState } from "react"
import { geoEquirectangular, geoGraticule10, geoPath } from "d3-geo"
import { feature, mesh } from "topojson-client"
import type { GeometryCollection, Topology } from "topojson-specification"

interface Paths {
	land: string
	borders: string
	graticule: string
}

// Proiezione con scala 1: x in [-π, π], y in [-π/2, π/2] (nord in alto); il resto lo fa la trasformazione SVG
const path = geoPath(geoEquirectangular().scale(1).translate([0, 0]).precision(0.05))

let cache: Promise<Paths> | null = null

/** I dati (circa 750 KB) si caricano alla prima apertura della mappa e restano in memoria */
function loadPaths(): Promise<Paths> {
	cache ??= import("world-atlas/countries-50m.json").then((mod) => {
		const topo = (mod.default ?? mod) as unknown as Topology<{ countries: GeometryCollection; land: GeometryCollection }>
		return {
			land: path(feature(topo, topo.objects.land)) ?? "",
			borders: path(mesh(topo, topo.objects.countries, (a, b) => a !== b)) ?? "",
			graticule: path(geoGraticule10()) ?? "",
		}
	})
	return cache
}

export default function WorldMap({ width, height }: { width: number; height: number }) {
	const id = useId()
	const [paths, setPaths] = useState<Paths | null>(null)

	useEffect(() => {
		let alive = true
		loadPaths().then((p) => alive && setPaths(p))
		return () => {
			alive = false
		}
	}, [])

	// Da coordinate proiettate (radianti) al pannello: stessa stiratura dell'immagine originale
	const transform = `scale(${width / (2 * Math.PI)} ${height / Math.PI}) translate(${Math.PI} ${Math.PI / 2})`

	return (
		<svg width={width} height={height} className="absolute inset-0 block" aria-hidden>
			<defs>
				<radialGradient id={`${id}-sea`} cx="0.5" cy="0.45" r="0.75">
					<stop offset="0" stopColor="#0a1f45" />
					<stop offset="1" stopColor="#020611" />
				</radialGradient>
				<linearGradient id={`${id}-land`} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stopColor="#163f7d" stopOpacity="0.75" />
					<stop offset="1" stopColor="#0b2a5c" stopOpacity="0.6" />
				</linearGradient>
				<filter id={`${id}-glow`} x="-5%" y="-5%" width="110%" height="110%">
					<feGaussianBlur stdDeviation="2.2" result="blur" />
					<feMerge>
						<feMergeNode in="blur" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>
				{/* Righe orizzontali sottili, effetto schermo */}
				<pattern id={`${id}-scan`} width="4" height="3" patternUnits="userSpaceOnUse">
					<rect width="4" height="1" fill="#6fb8ff" opacity="0.05" />
				</pattern>
			</defs>

			<rect width={width} height={height} fill={`url(#${id}-sea)`} />

			{paths && (
				<g transform={transform}>
					<path d={paths.graticule} fill="none" stroke="#3a8fe0" strokeOpacity="0.16" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
					<path d={paths.land} fill={`url(#${id}-land)`} />
					<path d={paths.borders} fill="none" stroke="#3a8fe0" strokeOpacity="0.35" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
					<path
						d={paths.land}
						fill="none"
						stroke="#6fb8ff"
						strokeOpacity="0.9"
						strokeWidth="1"
						vectorEffect="non-scaling-stroke"
						filter={`url(#${id}-glow)`}
					/>
				</g>
			)}

			<rect width={width} height={height} fill={`url(#${id}-scan)`} />
		</svg>
	)
}
