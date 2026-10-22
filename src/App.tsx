import { Stage } from "@/Components/ui"
import Boot from "@/Pages/Boot"
import Desktop from "@/Pages/Desktop"
import Login from "@/Pages/Login"
import { useApp } from "@/store/app"

// Flusso delle schermate: BIOS e caricamento → login → desktop
function App() {
	const screen = useApp((s) => s.screen)
	const game = useApp((s) => s.game)
	const gameId = useApp((s) => s.gameId)

	return (
		<Stage>
			{screen === "boot" && <Boot />}
			{screen === "login" && <Login />}
			{/* key: una nuova partita (es. caricamento veloce) rimonta il desktop da zero */}
			{screen === "desktop" && game && <Desktop key={gameId} />}
		</Stage>
	)
}

export default App
