import type { Slot } from '@quokka/shared'

interface SlotFormProps {
  slots: Slot[]
  values: Record<string, string>
  onChange: (values: Record<string, string>) => void
}

export default function SlotForm({ slots, values, onChange }: SlotFormProps) {
  if (slots.length === 0) return null

  const handleChange = (key: string, value: string) => {
    onChange({ ...values, [key]: value })
  }

  return (
    <div className="space-y-2">
      {slots.map((slot) => (
        <div key={slot.key}>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {slot.label}
          </label>
          {slot.type === 'boolean' ? (
            <select
              value={values[slot.key] ?? slot.default ?? 'false'}
              onChange={(e) => handleChange(slot.key, e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          ) : (
            <input
              type={slot.type === 'number' ? 'number' : slot.type === 'date' ? 'date' : 'text'}
              value={values[slot.key] ?? slot.default ?? ''}
              onChange={(e) => handleChange(slot.key, e.target.value)}
              placeholder={slot.label}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          )}
        </div>
      ))}
    </div>
  )
}
