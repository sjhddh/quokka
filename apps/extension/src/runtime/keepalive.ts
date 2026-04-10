const KEEPALIVE_ALARM = 'quokka-keepalive'

/**
 * Start keepalive alarm (every 25 seconds) during recipe execution.
 * Chrome MV3 service workers terminate after ~5 minutes of inactivity;
 * the alarm fires periodically to prevent termination during long runs.
 */
export function startKeepalive(): void {
  chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 25 / 60 })
}

/**
 * Stop keepalive alarm when execution completes or fails.
 */
export function stopKeepalive(): void {
  chrome.alarms.clear(KEEPALIVE_ALARM)
}

/**
 * Register the keepalive alarm listener in the background script.
 * Must be called once at SW startup. The listener just needs to exist —
 * the SW being woken by an alarm keeps it alive for another 30s window.
 */
export function registerKeepaliveListener(): void {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === KEEPALIVE_ALARM) {
      console.log('[quokka] keepalive tick')
    }
  })
}
