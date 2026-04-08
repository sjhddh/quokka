import { EventEmitter } from 'node:events'
import type { RunEvent } from '@quokka/shared'

class RunEventBus {
  private emitter = new EventEmitter()

  constructor() {
    this.emitter.setMaxListeners(50)
  }

  emitRunEvent(runId: string, event: RunEvent): void {
    this.emitter.emit(`run:${runId}`, event)
  }

  onRunEvent(runId: string, handler: (event: RunEvent) => void): void {
    this.emitter.on(`run:${runId}`, handler)
  }

  offRunEvent(runId: string, handler: (event: RunEvent) => void): void {
    this.emitter.off(`run:${runId}`, handler)
  }
}

export const eventBus = new RunEventBus()
