import { useQuokkaStore } from '../../../store'

export default function CheckpointDialog() {
  const pendingCheckpoint = useQuokkaStore((s) => s.pendingCheckpoint)
  const approveCheckpoint = useQuokkaStore((s) => s.approveCheckpoint)
  const rejectCheckpoint = useQuokkaStore((s) => s.rejectCheckpoint)

  if (!pendingCheckpoint) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl mx-4 w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="bg-orange-50 border-b border-orange-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-orange-700">
            Checkpoint Required
          </h2>
          <p className="text-xs text-orange-500 mt-0.5">
            Step {pendingCheckpoint.stepIndex + 1}
          </p>
        </div>

        {/* Body */}
        <div className="px-4 py-3">
          <p className="text-sm text-gray-700">{pendingCheckpoint.message}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4 py-3 border-t border-gray-100">
          <button
            onClick={rejectCheckpoint}
            className="flex-1 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
          >
            Reject
          </button>
          <button
            onClick={approveCheckpoint}
            className="flex-1 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  )
}
