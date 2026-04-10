import { useState, useEffect } from 'react'
import { getStats } from '../../../lib/stats'

const RATING_KEY = 'quokka_rating'
const INITIAL_THRESHOLD = 3
const SNOOZE_INCREMENT = 5

// Replace with actual Chrome Web Store listing URL when published
const CHROME_STORE_URL =
  'https://chromewebstore.google.com/detail/quokka/EXTENSION_ID/reviews'

interface RatingState {
  dismissed: boolean
  snoozedAt: number // replaySuccessCount when snoozed
}

async function getRatingState(): Promise<RatingState> {
  const result = await chrome.storage.local.get(RATING_KEY)
  const stored = result[RATING_KEY]
  if (stored && typeof stored === 'object') {
    return stored as RatingState
  }
  return { dismissed: false, snoozedAt: 0 }
}

async function setRatingState(state: RatingState): Promise<void> {
  await chrome.storage.local.set({ [RATING_KEY]: state })
}

export default function RatingPrompt() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    async function check() {
      const [stats, rating] = await Promise.all([getStats(), getRatingState()])

      if (rating.dismissed) return

      const count = stats.replaySuccessCount
      if (count < INITIAL_THRESHOLD) return

      // If snoozed, only show after snooze threshold
      if (rating.snoozedAt > 0 && count < rating.snoozedAt + SNOOZE_INCREMENT) return

      setVisible(true)
    }
    check()
  }, [])

  if (!visible) return null

  const handleRate = () => {
    chrome.tabs.create({ url: CHROME_STORE_URL })
    setRatingState({ dismissed: true, snoozedAt: 0 })
    setVisible(false)
  }

  const handleLater = async () => {
    const stats = await getStats()
    await setRatingState({ dismissed: false, snoozedAt: stats.replaySuccessCount })
    setVisible(false)
  }

  const handleDismiss = () => {
    setRatingState({ dismissed: true, snoozedAt: 0 })
    setVisible(false)
  }

  return (
    <div className="bg-indigo-50 border-t border-indigo-200 px-4 py-3">
      <p className="text-xs text-gray-700 mb-2">
        Quokka saved you time! Help others find it — rate on Chrome Web Store?
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleRate}
          className="px-3 py-1 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-colors"
        >
          Rate Now
        </button>
        <button
          onClick={handleLater}
          className="px-3 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
        >
          Maybe Later
        </button>
        <button
          onClick={handleDismiss}
          className="px-3 py-1 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
        >
          Don't Ask Again
        </button>
      </div>
    </div>
  )
}
