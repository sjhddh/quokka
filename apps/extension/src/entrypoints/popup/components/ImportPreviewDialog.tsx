import { useState } from 'react'
import { parseRecipeFile, type ImportPreview } from '../../../lib/import-recipe'

type Tab = 'file' | 'paste'

interface Props {
  previews: ImportPreview[] | null
  onParsed: (previews: ImportPreview[]) => void
  onConfirm: () => void
  onCancel: () => void
  importing: boolean
  error?: string | null
  fileInput: React.ReactNode
}

export default function ImportPreviewDialog({
  previews,
  onParsed,
  onConfirm,
  onCancel,
  importing,
  error,
  fileInput,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('file')
  const [pasteText, setPasteText] = useState('')
  const [pasteError, setPasteError] = useState<string | null>(null)

  const isBulk = previews && previews.length > 1

  const handleParsePaste = () => {
    setPasteError(null)
    const text = pasteText.trim()
    if (!text) {
      setPasteError('Paste some recipe JSON first.')
      return
    }
    try {
      const result = parseRecipeFile(text)
      const parsed = Array.isArray(result) ? result : [result]
      onParsed(parsed)
    } catch (err) {
      setPasteError(
        err instanceof Error
          ? err.message
          : "This doesn't look like a valid recipe. Check the format and try again.",
      )
    }
  }

  const displayError = activeTab === 'paste' ? pasteError : error

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-800">
            {previews
              ? `Import ${isBulk ? `${previews.length} Recipes` : 'Recipe'}`
              : 'Import Recipe'}
          </h3>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('file')}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === 'file'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            File
          </button>
          <button
            onClick={() => setActiveTab('paste')}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === 'paste'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Paste
          </button>
        </div>

        {displayError && (
          <div className="mx-4 mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {displayError}
          </div>
        )}

        {/* Paste tab input area */}
        {activeTab === 'paste' && !previews && (
          <div className="px-4 py-3">
            <textarea
              className="w-full h-32 text-xs font-mono border border-gray-200 rounded-md p-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
              placeholder="Paste recipe JSON here..."
              value={pasteText}
              onChange={(e) => {
                setPasteText(e.target.value)
                setPasteError(null)
              }}
            />
            <button
              onClick={handleParsePaste}
              disabled={!pasteText.trim()}
              className="mt-2 w-full px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              Preview
            </button>
          </div>
        )}

        {/* File tab input area */}
        {activeTab === 'file' && !previews && (
          <div className="px-4 py-3">
            <p className="text-xs text-gray-500 mb-2">
              Select a <code>.quokka.json</code> or <code>.json</code> file.
            </p>
            {fileInput}
          </div>
        )}

        {/* Preview section (shared by both tabs) */}
        {previews && previews.length > 0 && (
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
        )}

        <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={() => {
              setPasteText('')
              setPasteError(null)
              onCancel()
            }}
            disabled={importing}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          {previews && (
            <button
              onClick={onConfirm}
              disabled={importing}
              className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {importing ? 'Importing...' : isBulk ? `Import ${previews.length} Recipes` : 'Import'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
