// Primary mobile picker primitive. Replaces every <select>/dropdown:
// full-width, searchable, large touch targets.
import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface BottomSheetProps {
  open: boolean
  title?: string
  onClose(): void
  /** Rendered below the header, above the scrollable body. Stays fixed in place (e.g. a search input). */
  pinned?: ReactNode
  children: ReactNode
}

export function BottomSheet({ open, title, onClose, pinned, children }: BottomSheetProps) {
  if (!open) return null

  return createPortal(
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-header">
          <div className="sheet-title">{title ?? ''}</div>
          <button className="sheet-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {pinned && <div className="sheet-pinned">{pinned}</div>}
        <div className="sheet-body">{children}</div>
      </div>
    </>,
    document.body,
  )
}

export interface PickerProps<T> {
  open: boolean
  items: T[]
  getLabel(item: T): string
  onPick(item: T): void
  onClose(): void
  title?: string
}

/** Generic searchable picker built on BottomSheet: species/move/item/etc. */
export function SearchablePicker<T>({ open, items, getLabel, onPick, onClose, title }: PickerProps<T>) {
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? items.filter(item => getLabel(item).toLowerCase().includes(query.trim().toLowerCase()))
    : items

  function handleClose() {
    setQuery('')
    onClose()
  }

  return (
    <BottomSheet
      open={open}
      title={title}
      onClose={handleClose}
      pinned={
        <input
          className="sheet-search"
          type="text"
          placeholder="Search…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      }
    >
      <div>
        {filtered.length === 0 && <div className="muted" style={{ padding: 12 }}>No matches</div>}
        {filtered.map((item, i) => {
          const label = getLabel(item)
          return (
            <button
              key={`${label}-${i}`}
              className="picker-row"
              onClick={() => {
                onPick(item)
                handleClose()
              }}
            >
              {label}
            </button>
          )
        })}
      </div>
    </BottomSheet>
  )
}
