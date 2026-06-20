import { useGameStore } from '../state/gameStore'
import { useCalcStore } from '../state/calcStore'

const WEATHERS = ['Sun', 'Rain', 'Sand', 'Hail']

export function FieldScreen() {
  const game = useGameStore(s => s.game)
  const { field, patchField } = useCalcStore()
  if (!game) return null

  const showTerrain = game.mechanics.damageGen >= 6

  return (
    <div style={{ padding: 'var(--sp-4)' }} className="col">
      <div className="card col">
        <div className="label">Weather</div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button
            className={`chip ${!field.weather ? 'chip--active' : ''}`}
            onClick={() => patchField({ weather: undefined })}
          >
            None
          </button>
          {WEATHERS.map(w => (
            <button
              key={w}
              className={`chip ${field.weather === w ? 'chip--active' : ''}`}
              onClick={() => patchField({ weather: w })}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {showTerrain && (
        <div className="card col">
          <div className="label">Terrain</div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button
              className={`chip ${!field.terrain ? 'chip--active' : ''}`}
              onClick={() => patchField({ terrain: undefined })}
            >
              None
            </button>
            {['Electric', 'Grassy', 'Misty', 'Psychic'].map(t => (
              <button
                key={t}
                className={`chip ${field.terrain === t ? 'chip--active' : ''}`}
                onClick={() => patchField({ terrain: t })}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card row--between">
        <div className="label" style={{ margin: 0 }}>Gravity</div>
        <button
          className={`chip ${field.gravity ? 'chip--active' : ''}`}
          onClick={() => patchField({ gravity: !field.gravity })}
        >
          {field.gravity ? 'On' : 'Off'}
        </button>
      </div>
    </div>
  )
}
