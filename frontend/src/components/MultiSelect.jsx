import React, { useState, useRef, useEffect } from 'react';

export default function MultiSelect({ label, options, selected = [], onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggle = (e, val) => {
    e.stopPropagation();
    e.preventDefault();
    const next = selected.includes(val)
      ? selected.filter(v => v !== val)
      : [...selected, val];
    onChange(next);
  };

  const clearAll = (e) => {
    e.stopPropagation();
    onChange([]);
    setOpen(false);
  };

  const displayText = selected.length === 0
    ? label
    : selected.length <= 2
      ? selected.join(', ')
      : `${selected.length} selected`;

  return (
    <div className="multi-select" ref={ref}>
      <div className={`multi-select-trigger ${selected.length > 0 ? 'has-value' : ''}`} onClick={() => setOpen(!open)}>
        <span className="multi-select-text">{displayText}</span>
        <svg className="multi-select-arrow" width="10" height="10" viewBox="0 0 16 16" fill="#6b7280">
          <path d="M8 11L3 6h10z"/>
        </svg>
      </div>
      {open && (
        <div className="multi-select-dropdown">
          {selected.length > 0 && (
            <div className="multi-select-option clear-option" onMouseDown={clearAll}>
              Clear all
            </div>
          )}
          {options.map(opt => (
            <div key={opt} className="multi-select-option" onMouseDown={(e) => toggle(e, opt)}>
              <span className={`multi-select-check ${selected.includes(opt) ? 'checked' : ''}`}>
                {selected.includes(opt) && <svg width="10" height="10" viewBox="0 0 16 16" fill="#fff"><path d="M6.5 12.5l-4-4 1.5-1.5 2.5 2.5 5.5-5.5 1.5 1.5z"/></svg>}
              </span>
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
