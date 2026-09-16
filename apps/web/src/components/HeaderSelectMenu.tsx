'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';

interface HeaderSelectOption {
  value: string;
  label: string;
}

export function HeaderSelectMenu({ label, icon, options, value, onSelect }: { label: string; icon: ReactNode; options: HeaderSelectOption[]; value: string; onSelect: (value: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    containerRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();

    function closeMenu(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      if (event instanceof MouseEvent && containerRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
      triggerRef.current?.focus();
    }

    window.addEventListener('mousedown', closeMenu);
    window.addEventListener('keydown', closeMenu);
    return () => {
      window.removeEventListener('mousedown', closeMenu);
      window.removeEventListener('keydown', closeMenu);
    };
  }, [isOpen]);

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')];
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    let nextIndex: number | undefined;
    if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % items.length;
    if (event.key === 'ArrowUp') nextIndex = currentIndex === -1 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = items.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    items[nextIndex]?.focus();
  }

  return (
    <div ref={containerRef} className="header-select-menu">
      <button ref={triggerRef} className="icon-button" type="button" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)}>
        {icon}
      </button>
      {isOpen ? (
        <div className="header-menu-popover" role="menu" aria-label={label} onKeyDown={handleMenuKeyDown}>
          {options.map((option) => (
            <button key={option.value} type="button" role="menuitemradio" aria-checked={value === option.value} className="header-menu-option" onClick={() => { onSelect(option.value); setIsOpen(false); triggerRef.current?.focus(); }}>
              <span>{option.label}</span>{value === option.value ? <Check size={16} aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}