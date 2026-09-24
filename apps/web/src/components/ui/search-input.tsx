'use client';

import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Input } from './input';

interface SearchInputProps {
  value: string;
  /** Called after typing pauses, so the server is not asked on every keystroke */
  onSearch: (value: string) => void;
  label: string;
  clearLabel: string;
  placeholder?: string;
  delayMs?: number;
}

export function SearchInput({
  value,
  onSearch,
  label,
  clearLabel,
  placeholder,
  delayMs = 300,
}: SearchInputProps) {
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);
  const latest = useRef(onSearch);
  useEffect(() => {
    latest.current = onSearch;
  });

  // Follow outside changes (e.g. the back button restoring an older search)
  if (value !== synced) {
    setSynced(value);
    setText(value);
  }

  useEffect(() => {
    if (text === value) return;
    const timer = setTimeout(() => latest.current(text.trim()), delayMs);
    return () => clearTimeout(timer);
  }, [text, value, delayMs]);

  return (
    <div className="relative w-full sm:max-w-sm">
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="px-10 [&::-webkit-search-cancel-button]:hidden"
      />
      {text ? (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={() => {
            setText('');
            onSearch('');
          }}
          className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
