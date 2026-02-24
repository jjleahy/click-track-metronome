import { useState, useRef, useEffect } from 'react';
import { numberToBravura } from '../../utils/noteGlyphs';
import { NOTATION_FONT_SIZE, STAFF_SPACE } from './staffConstants';

interface BravuraNumberInputProps {
  value: number;
  onChange: (newValue: number) => void;
  min: number;
  max: number;
  ariaLabel: string;
  /** If set, only these values are accepted (e.g. [1,2,4,8,16] for denominator). */
  allowedValues?: number[];
  style?: React.CSSProperties;
}

/**
 * An editable number displayed as Bravura time-signature glyphs.
 *
 * Uses a real <input type="text"> with font-family Bravura, so the browser
 * provides native focus ring, cursor, and selection. Digit keystrokes are
 * intercepted and the Bravura Unicode equivalents are set as the value.
 */
export function BravuraNumberInput({
  value,
  onChange,
  min,
  max,
  ariaLabel,
  allowedValues,
  style,
}: BravuraNumberInputProps) {
  const [editing, setEditing] = useState(false);
  const [buffer, setBuffer] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync display when value changes externally
  useEffect(() => {
    if (!editing) {
      setBuffer(String(value));
    }
  }, [value, editing]);

  function isValid(n: number): boolean {
    if (n < min || n > max) return false;
    if (allowedValues && !allowedValues.includes(n)) return false;
    return true;
  }

  function commit() {
    const n = parseInt(buffer, 10);
    if (!isNaN(n) && isValid(n) && n !== value) {
      onChange(n);
    }
    setBuffer(String(isNaN(n) || !isValid(n) ? value : n));
    setEditing(false);
  }

  function handleFocus() {
    setEditing(true);
    setBuffer('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
      inputRef.current?.blur();
      return;
    }

    if (e.key === 'Tab') {
      commit();
      return;
    }

    if (e.key === 'Backspace') {
      e.preventDefault();
      setBuffer((prev) => prev.slice(0, -1));
      return;
    }

    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      const next = buffer + e.key;
      const n = parseInt(next, 10);
      if (n <= max) {
        setBuffer(next);
      }
      return;
    }

    // Ignore all other keys (except browser defaults like Escape)
    if (e.key !== 'Escape') {
      e.preventDefault();
    }
  }

  function handleBlur() {
    commit();
  }

  // Show Bravura glyph of buffer while editing, otherwise of current value
  const displayValue = editing && buffer.length > 0 ? parseInt(buffer, 10) : value;
  const displayStr = !isNaN(displayValue) ? numberToBravura(displayValue) : '';

  // Width: ~2ch for single digit, ~3.5ch for double digit
  const inputWidth = max > 9 ? STAFF_SPACE * 3 : STAFF_SPACE * 1.8;

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={displayStr}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onChange={() => {}} // controlled; all input via onKeyDown
      aria-label={ariaLabel}
      style={{
        fontFamily: 'Bravura',
        fontSize: NOTATION_FONT_SIZE,
        lineHeight: 1,
        width: inputWidth,
        height: STAFF_SPACE * 2,
        border: 'none',
        background: 'transparent',
        color: 'inherit',
        padding: 0,
        margin: 0,
        cursor: 'text',
        caretColor: 'transparent',
        ...style,
      }}
    />
  );
}
