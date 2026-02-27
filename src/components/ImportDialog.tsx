import type { Exercise } from '../models/Exercise';

export type ImportAction =
  | { type: 'new'; exercise: Exercise }
  | { type: 'replace'; exercise: Exercise; existingName: string };

interface ImportDialogProps {
  action: ImportAction;
  onConfirm: () => void;
  onDecline: () => void;
}

export function ImportDialog({ action, onConfirm, onDecline }: ImportDialogProps) {
  return (
    <div className="import-dialog-backdrop" onClick={onDecline}>
      <div className="import-dialog" onClick={(e) => e.stopPropagation()}>
        {action.type === 'new' ? (
          <p>Import exercise &ldquo;{action.exercise.name}&rdquo;?</p>
        ) : (
          <p>
            Replace existing exercise &ldquo;{action.existingName}&rdquo; with
            imported version &ldquo;{action.exercise.name}&rdquo;?
          </p>
        )}
        <div className="import-dialog__buttons">
          <button onClick={onConfirm}>
            {action.type === 'new' ? 'Import' : 'Replace'}
          </button>
          <button onClick={onDecline}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
