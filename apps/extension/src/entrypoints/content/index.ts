import { ContentBridge } from './bridge'
import { WatchRecorder } from './recorder'
import { MessageType, type BridgeCallPayload } from '../../lib/messaging'

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    const bridge = new ContentBridge()
    const recorder = new WatchRecorder()

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      const { type, payload } = message

      switch (type) {
        case MessageType.BRIDGE_CALL: {
          const call = payload as BridgeCallPayload
          const execute = async () => {
            switch (call.method) {
              case 'click':
                return bridge.click(call.selector!)
              case 'type':
                return bridge.type(call.selector!, call.value!)
              case 'navigate':
                return bridge.navigate(call.url!)
              case 'extract':
                return bridge.extract(call.selector!)
              case 'waitFor':
                return bridge.waitFor(call.selector!, call.timeout)
            }
          }
          execute()
            .then((result) => sendResponse({ ok: true, result }))
            .catch((err) => sendResponse({ ok: false, error: String(err) }))
          return true // async response
        }

        case MessageType.START_WATCH: {
          recorder.start()
          sendResponse({ ok: true })
          return false
        }

        case MessageType.STOP_WATCH: {
          const trace = recorder.stop()
          sendResponse(trace)
          return false
        }
      }
    })
  },
})
