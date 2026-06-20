import { useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { useGameStore } from './state/gameStore'
import { useBoxStore } from './state/boxStore'
import { BottomNav } from './ui/BottomNav'
import { CalcScreen } from './ui/CalcScreen'
import { TrainersScreen } from './ui/TrainersScreen'
import { BoxScreen } from './ui/BoxScreen'
import { FieldScreen } from './ui/FieldScreen'

export function App() {
  const { status, load } = useGameStore()
  useEffect(() => { load(); useBoxStore.getState().load() }, [load])

  return (
    <HashRouter>
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#0b0b0f' }}>
        <main style={{ flex: 1 }}>
          {status !== 'ready'
            ? <div style={{ padding: 16, color: '#888' }}>Loading {status}…</div>
            : <Routes>
                <Route path="/" element={<CalcScreen />} />
                <Route path="/trainers" element={<TrainersScreen />} />
                <Route path="/box" element={<BoxScreen />} />
                <Route path="/field" element={<FieldScreen />} />
              </Routes>}
        </main>
        <BottomNav />
      </div>
    </HashRouter>
  )
}
