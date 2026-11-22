import React, { useEffect, useRef, useState } from 'react';
import { Calendar, X } from 'lucide-react';
import {
  formatTanggalDDMMYYYY,
  normalizeDateToIso,
  parseFlexibleDate,
} from '../utils/indonesianFormatter';

interface DateInputIdProps {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  allowEmpty?: boolean;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}

function toDisplayDDMMYYYY(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  const parsed = parseFlexibleDate(trimmed);
  return parsed ? parsed.ddMmYyyy : trimmed;
}

export const DateInputId: React.FC<DateInputIdProps> = ({
  id,
  value,
  onChange,
  placeholder = 'DD-MM-YYYY',
  allowEmpty = true,
  ariaLabel,
  className = '',
  disabled = false,
}) => {
  const [draft, setDraft] = useState<string>(() => toDisplayDDMMYYYY(value));
  const pickerRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(toDisplayDDMMYYYY(value));
  }, [value]);

  const handleTextChange = (raw: string) => {
    setDraft(raw);
    const trimmed = raw.trim();
    if (!trimmed) {
      if (allowEmpty) onChange('');
      return;
    }
    const parsed = parseFlexibleDate(trimmed);
    if (parsed) {
      onChange(parsed.ddMmYyyy);
    }
  };

  const handleBlur = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      if (allowEmpty) {
        setDraft('');
        onChange('');
      } else {
        setDraft(toDisplayDDMMYYYY(value));
      }
      return;
    }
    const parsed = parseFlexibleDate(trimmed);
    if (parsed) {
      setDraft(parsed.ddMmYyyy);
      onChange(parsed.ddMmYyyy);
    } else {
      onChange(trimmed);
    }
  };

  const openNativePicker = () => {
    const el = pickerRef.current;
    if (!el || disabled) return;
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker();
        return;
      } catch {
        // Fallback to focus/click below
      }
    }
    el.focus();
    el.click();
  };

  const isoValue = normalizeDateToIso(draft || value);

  return (
    <div className="relative flex items-center">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={draft}
        disabled={disabled}
        aria-label={ariaLabel}
        placeholder={placeholder}
        onChange={(e) => handleTextChange(e.target.value)}
        onBlur={handleBlur}
        className={`input-airy w-full px-3 py-2 pr-14 font-mono text-xs ${className}`}
      />
      <div className="absolute right-1.5 flex items-center gap-0.5">
        {allowEmpty && draft.trim() !== '' && !disabled && (
          <button
            type="button"
            onClick={() => {
              setDraft('');
              onChange('');
            }}
            aria-label="Kosongkan tanggal"
            title="Kosongkan tanggal"
            className="p-1 rounded text-slate-400 dark:text-teal-300/70 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={openNativePicker}
          disabled={disabled}
          aria-label="Pilih dari kalender"
          title="Pilih dari kalender"
          className="p-1 rounded text-slate-500 dark:text-teal-300/80 hover:text-teal-800 dark:hover:text-teal-100 hover:bg-teal-50 dark:hover:bg-teal-900/50 transition-colors"
        >
          <Calendar className="w-3.5 h-3.5" />
        </button>
      </div>
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={isoValue}
        onChange={(e) => {
          const pickedIso = e.target.value;
          if (!pickedIso) {
            if (allowEmpty) {
              setDraft('');
              onChange('');
            }
            return;
          }
          const formatted = formatTanggalDDMMYYYY(pickedIso);
          setDraft(formatted);
          onChange(formatted);
        }}
        className="sr-only pointer-events-none"
      />
    </div>
  );
};
