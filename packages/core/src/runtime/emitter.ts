import EventEmitter from 'eventemitter3'
import type { RunEventType, RunEvent, RunEventMap } from '@quokka/shared'

export class RunEmitter {
  private ee = new EventEmitter()

  on<T extends RunEventType>(type: T, handler: (event: RunEventMap[T]) => void): void {
    this.ee.on(type, handler)
  }

  off<T extends RunEventType>(type: T, handler: (event: RunEventMap[T]) => void): void {
    this.ee.off(type, handler)
  }

  emit<T extends RunEventType>(type: T, event: RunEventMap[T]): void {
    this.ee.emit(type, event)
  }

  removeAllListeners(): void {
    this.ee.removeAllListeners()
  }
}
