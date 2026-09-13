import { createContext } from 'react'

/** 'system' follows the OS; the other two are explicit overrides. */
export type ThemeChoice = 'light' | 'dark' | 'system'

export type ThemeState = {
  choice: ThemeChoice
  /** What is actually on screen once 'system' is resolved. */
  resolved: 'light' | 'dark'
  setChoice: (choice: ThemeChoice) => void
}

/** Must match the inline script in index.html, which reads it before React runs. */
export const THEME_STORAGE_KEY = 'pfmanager:theme'

export const ThemeContext = createContext<ThemeState>({
  choice: 'system',
  resolved: 'dark',
  setChoice: () => {},
})
