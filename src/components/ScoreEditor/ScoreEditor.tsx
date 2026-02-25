import type { Measure as MeasureData } from '../../models/Exercise';
import type { ResolvedMeasure } from '../../models/ResolvedMeasure';
import { Measure } from './Measure';
import { StaffClef } from './StaffClef';

interface ScoreEditorProps {
  resolvedMeasures: ResolvedMeasure[];
  isPlaying: boolean;
  currentMeasure: number | null;
  currentBeat: number | null;
  onUpdateMeasure: (index: number, updated: MeasureData) => void;
  onDeleteMeasure: (index: number) => void;
  onInsertAfter: (index: number) => void;
  onAddMeasure: () => void;
}

export function ScoreEditor({
  resolvedMeasures,
  currentMeasure,
  currentBeat,
  onUpdateMeasure,
  onDeleteMeasure,
  onInsertAfter,
  onAddMeasure,
}: ScoreEditorProps) {
  return (
    <section className="score-editor" aria-label="Score editor">
      <div className="score-editor__scroll-container">
        <StaffClef />
        {resolvedMeasures.map((rm) => (
          <Measure
            key={rm.index}
            resolved={rm}
            activeBeat={currentMeasure === rm.index ? currentBeat : null}
            canDelete={resolvedMeasures.length > 1}
            onChange={(updated) => onUpdateMeasure(rm.index, updated)}
            onDelete={() => onDeleteMeasure(rm.index)}
            onInsertAfter={() => onInsertAfter(rm.index)}
          />
        ))}
        <button
          className="score-editor__add-button"
          onClick={onAddMeasure}
          aria-label="Add measure at end"
        >
          + Add Measure
        </button>
      </div>
    </section>
  );
}
