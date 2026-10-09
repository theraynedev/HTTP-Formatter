export default function ConfirmModal({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-canvas/80 backdrop-blur-sm" onClick={onCancel} />
      {/* `max-h` + `overflow-y-auto` keep the dialog inside the viewport: a long
          message used to be able to push the buttons below the fold on short
          screens, with nothing able to scroll. */}
      <div className="relative w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto pane-scroll bg-surface-overlay border border-line rounded-panel p-6 shadow-pop">
        <h3 className="text-lg text-fg">{title}</h3>
        <p className="text-sm text-fg-muted mt-2 leading-relaxed">{message}</p>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-control border border-line text-sm text-fg-muted hover:bg-surface-raised hover:text-fg transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 rounded-control bg-danger hover:bg-danger/90 text-fg text-sm transition"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
