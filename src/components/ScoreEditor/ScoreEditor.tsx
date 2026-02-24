import type { Measure as MeasureData } from '../../models/Exercise';
import type { ResolvedMeasure } from '../../utils/tempoMap';
import { Measure } from './Measure';
import { StaffClef } from './StaffClef';

interface ScoreEditorProps {
  measures: MeasureData[];
  resolvedLabels: (string | number)[];
  resolvedTempoMap: ResolvedMeasure[];
  currentMeasure: number | null;
  onUpdateMeasure: (index: number, updated: MeasureData) => void;
  onDeleteMeasure: (index: number) => void;
  onInsertAfter: (index: number) => void;
  onAddMeasure: () => void;
}

export function ScoreEditor({
  measures,
  resolvedLabels,
  resolvedTempoMap,
  currentMeasure,
  onUpdateMeasure,
  onDeleteMeasure,
  onInsertAfter,
  onAddMeasure,
}: ScoreEditorProps) {
  return (
    <section className="score-editor" aria-label="Score editor">
      <div className="score-editor__scroll-container">
        <StaffClef />
        {measures.map((measure, index) => (
          <Measure
            key={index}
            measure={measure}
            resolvedLabel={resolvedLabels[index]}
            resolvedTempo={resolvedTempoMap[index].tempo}
            isActive={currentMeasure === index}
            canDelete={measures.length > 1}
            onChange={(updated) => onUpdateMeasure(index, updated)}
            onDelete={() => onDeleteMeasure(index)}
            onInsertAfter={() => onInsertAfter(index)}
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
