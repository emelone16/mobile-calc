// Contract stub for the primary mobile picker. Implement in M4.
// Replaces every <select>/dropdown: full-width, searchable, large touch targets.
import type { ReactNode } from 'react'

export interface BottomSheetProps {
  open: boolean
  title?: string
  onClose(): void
  children: ReactNode
}

export function BottomSheet(_props: BottomSheetProps) {
  // TODO(M4): portal + backdrop + slide-up panel + safe-area inset + focus trap.
  return null
}

export interface PickerProps<T> {
  open: boolean
  items: T[]
  getlabel(item: T): string
  onPick(item: T): void
  onClose(): void
}
// TODO(M4): SearchablePicker<T> built on BottomSheet for species/move/item/etc.
