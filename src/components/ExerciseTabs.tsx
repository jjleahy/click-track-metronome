import { useState, useRef, useEffect } from 'react';
import type { Exercise } from '../models/Exercise';

interface ExerciseTabsProps {
  exercises: Exercise[];
  activeExerciseId: string;
  onSelect: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onShare: (id: string) => void;
  onNew: () => void;
}

function TabName({ name, onRename }: { name: string; onRename: (n: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  // Sync draft when name changes externally
  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) onRename(trimmed);
    else setDraft(name);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="exercise-tab__name exercise-tab__name--editing"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setDraft(name); setEditing(false); }
        }}
      />
    );
  }

  return (
    <span
      className="exercise-tab__name"
      onDoubleClick={() => setEditing(true)}
    >
      {name}
    </span>
  );
}

export function ExerciseTabs({
  exercises, activeExerciseId, onSelect, onRename, onDelete, onDuplicate, onShare, onNew,
}: ExerciseTabsProps) {
  return (
    <nav className="exercise-tabs" aria-label="Exercise tabs">
      {exercises.map((ex) => (
        <div
          key={ex.id}
          className={`exercise-tab${ex.id === activeExerciseId ? ' exercise-tab--active' : ''}`}
          onClick={() => onSelect(ex.id)}
        >
          <TabName name={ex.name} onRename={(n) => onRename(ex.id, n)} />
          <button
            className="exercise-tab__btn"
            title="Duplicate"
            onClick={(e) => { e.stopPropagation(); onDuplicate(ex.id); }}
          >
            Copy
          </button>
          <button
            className="exercise-tab__btn"
            title="Share link"
            onClick={(e) => { e.stopPropagation(); onShare(ex.id); }}
          >
            Share
          </button>
          <button
            className="exercise-tab__btn exercise-tab__btn--delete"
            title="Delete"
            onClick={(e) => { e.stopPropagation(); onDelete(ex.id); }}
          >
            {'\u00D7'}
          </button>
        </div>
      ))}
      <button className="exercise-tab exercise-tab--new" onClick={onNew}>
        + New
      </button>
    </nav>
  );
}
