import type { ImportPreview } from '../../../lib/import-recipe'

interface Props {
  previews: ImportPreview[]
  onConfirm: () => void
  onCancel: () => void
  importing: boolean
  error?: string | null
}

export default function ImportPreviewDialog({ previews, onConfirm, onCancel, importing, error }: Props) {
  const isBulk = previews.length > 1

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-800">
            Import {isBulk ? `${previews.length} Recipes` : 'Recipe'}
          </h3>
        </div>

        {error && (
          <div className="mx-4 mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </div>
        )}

        <div className="px-4 py-3 space-y-3 max-h-60 overflow-y-auto">
          {previews.map((preview, i) => (
            <div
              key={i}
              className="bg-gray-50 border border-gray-200 rounded-md p-3"
            >
              <div className="text-sm font-medium text-gray-800">{preview.name}</div>
              {preview.description && (
                <div className="text-xs text-gray-500 mt-0.5">{preview.description}</div>
              )}
              <div className="flex gap-3 mt-2 text-xs text-gray-600">
                <span>
                  {preview.stepCount} step{preview.stepCount !== 1 ? 's' : ''}
                </span>
                <span>
                  {preview.hosts.length} domain{preview.hosts.length !== 1 ? 's' : ''}
                </span>
              </div>
              {preview.hosts.length > 0 && (
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {preview.hosts.map((host) => (
                    <span
                      key={host}
                      className="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-indigo-50 text-indigo-600 rounded"
                    >
                      {host}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={importing}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={importing}
            className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {importing ? 'Importing...' : isBulk ? `Import ${previews.length} Recipes` : 'Import'}
          </button>
        </div>
      </div>
    </div>
  )
}
