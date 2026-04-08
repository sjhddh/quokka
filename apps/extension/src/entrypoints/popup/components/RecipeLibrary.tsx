import { useQuokkaStore } from '../../../store'

export default function RecipeLibrary() {
  const recipes = useQuokkaStore((s) => s.recipes)
  const startRun = useQuokkaStore((s) => s.startRun)

  if (recipes.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-400">
        No recipes yet. Record one with Watch Me or create one in the companion app.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {recipes.map((recipe) => (
        <div
          key={recipe.id}
          className="bg-white border border-gray-200 rounded-md p-3 flex items-start justify-between gap-2"
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-800 truncate">{recipe.name}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {recipe.steps.length} step{recipe.steps.length !== 1 ? 's' : ''}
            </div>
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {recipe.hosts.map((host) => (
                <span
                  key={host}
                  className="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-indigo-50 text-indigo-600 rounded"
                >
                  {host}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={() => startRun(recipe.id, {})}
            className="shrink-0 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-colors"
          >
            Run
          </button>
        </div>
      ))}
    </div>
  )
}
