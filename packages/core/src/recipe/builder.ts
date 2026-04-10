import { nanoid } from 'nanoid'
import type { Recipe, Step, Slot, Locator } from '@quokka/shared'

interface StepInput {
  target?: Locator
  url?: string
  value?: string
  as?: string
  timeout?: number
  message?: string
  description?: string
}

export class RecipeBuilder {
  private _name: string
  private _hosts: string[] = []
  private _slots: Slot[] = []
  private _steps: Step[] = []
  private _description?: string
  private _tags: string[] = []

  constructor(name: string) {
    this._name = name
  }

  description(desc: string): this {
    this._description = desc
    return this
  }

  hosts(...hosts: string[]): this {
    this._hosts.push(...hosts)
    return this
  }

  slot(key: string, label: string, type: Slot['type'], defaultValue?: string): this {
    const slot: Slot = { key, label, type }
    if (defaultValue !== undefined) slot.default = defaultValue
    this._slots.push(slot)
    return this
  }

  tags(...tags: string[]): this {
    this._tags.push(...tags)
    return this
  }

  step(type: Step['type'], opts: StepInput = {}): this {
    switch (type) {
      case 'click':
        this._steps.push({ type: 'click', target: opts.target ?? {}, description: opts.description })
        break
      case 'type':
        this._steps.push({ type: 'type', target: opts.target ?? {}, value: opts.value ?? '', description: opts.description })
        break
      case 'navigate':
        this._steps.push({ type: 'navigate', url: opts.url ?? '', description: opts.description })
        break
      case 'extract':
        this._steps.push({ type: 'extract', target: opts.target ?? {}, as: opts.as ?? 'result', description: opts.description })
        break
      case 'wait':
        this._steps.push({ type: 'wait', target: opts.target ?? {}, timeout: opts.timeout, description: opts.description })
        break
      case 'checkpoint':
        this._steps.push({ type: 'checkpoint', message: opts.message ?? '', description: opts.description })
        break
    }
    return this
  }

  checkpoint(message: string): this {
    this._steps.push({ type: 'checkpoint', message })
    return this
  }

  build(): Recipe {
    return {
      id: nanoid(),
      name: this._name,
      description: this._description,
      version: '0.1.0',
      hosts: this._hosts,
      slots: this._slots,
      guards: [],
      steps: this._steps,
      meta: {
        createdFrom: 'code',
        tags: this._tags,
      },
    }
  }
}

export function recipe(name: string): RecipeBuilder {
  return new RecipeBuilder(name)
}
