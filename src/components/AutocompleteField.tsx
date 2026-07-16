"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

export interface AutocompleteOption {
  value: string;
  label: string;
  description?: string;
  meta?: string;
}

interface AutocompleteFieldProps {
  options: AutocompleteOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minQueryLength?: number;
  maxResults?: number;
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function AutocompleteField({
  options,
  value,
  onChange,
  placeholder = "Buscar...",
  disabled = false,
  minQueryLength = 2,
  maxResults = 20,
}: AutocompleteFieldProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  useEffect(() => {
    if (selectedOption && !open) {
      setQuery(selectedOption.label);
    }
  }, [selectedOption, open]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const normalizedQuery = normalizeSearch(query);
  const canSearch = normalizedQuery.length >= minQueryLength;

  const matchedOptions = useMemo(() => {
    if (!canSearch) return [];

    return options.filter((option) => {
      const haystack = normalizeSearch(
        [option.label, option.description, option.meta, option.value]
          .filter(Boolean)
          .join(" "),
      );
      return haystack.includes(normalizedQuery);
    });
  }, [canSearch, normalizedQuery, options]);

  const filteredOptions = useMemo(
    () => matchedOptions.slice(0, maxResults),
    [matchedOptions, maxResults],
  );

  useEffect(() => {
    setHighlightedIndex(0);
  }, [normalizedQuery]);

  function clearSelection() {
    onChange("");
    setQuery("");
    setOpen(true);
    inputRef.current?.focus();
  }

  function selectOption(option: AutocompleteOption) {
    onChange(option.value);
    setQuery(option.label);
    setOpen(false);
  }

  function handleInputChange(nextQuery: string) {
    setQuery(nextQuery);
    setOpen(true);

    if (value && nextQuery !== selectedOption?.label) {
      onChange("");
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      setOpen(true);
      return;
    }

    if (event.key === "Escape") {
      setOpen(false);
      return;
    }

    if (!canSearch || filteredOptions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((index) =>
        index + 1 >= filteredOptions.length ? 0 : index + 1,
      );
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((index) =>
        index - 1 < 0 ? filteredOptions.length - 1 : index - 1,
      );
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const option = filteredOptions[highlightedIndex];
      if (option) selectOption(option);
    }
  }

  const showDropdown = open && !disabled;
  const totalMatches = matchedOptions.length;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          className="select-field pr-9"
          placeholder={placeholder}
          value={query}
          disabled={disabled}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          onFocus={() => setOpen(true)}
          onChange={(event) => handleInputChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        {value ? (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gran-muted transition hover:bg-gray-100 hover:text-gran-navy"
            aria-label="Limpar seleção"
            onClick={clearSelection}
          >
            <i className="fa-solid fa-xmark text-xs" aria-hidden="true" />
          </button>
        ) : (
          <i
            className="fa-solid fa-magnifying-glass pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gran-muted"
            aria-hidden="true"
          />
        )}
      </div>

      {selectedOption && (
        <p className="mt-1.5 text-xs text-gran-muted">
          {selectedOption.description}
          {selectedOption.meta ? ` · ${selectedOption.meta}` : ""}
        </p>
      )}

      {showDropdown && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          {!canSearch ? (
            <p className="px-3 py-2 text-sm text-gran-muted">
              Digite ao menos {minQueryLength} caracteres para buscar entre{" "}
              {options.length.toLocaleString("pt-BR")} colaboradores.
            </p>
          ) : filteredOptions.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gran-muted">
              Nenhum colaborador encontrado.
            </p>
          ) : (
            <>
              <p className="border-b border-gray-100 px-3 py-1.5 text-xs text-gran-muted">
                {totalMatches > filteredOptions.length
                  ? `Mostrando ${filteredOptions.length} de ${totalMatches.toLocaleString("pt-BR")} resultados`
                  : `${totalMatches.toLocaleString("pt-BR")} resultado${totalMatches === 1 ? "" : "s"}`}
              </p>
              {filteredOptions.map((option, index) => {
                const isHighlighted = index === highlightedIndex;
                const isSelected = option.value === value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`flex w-full flex-col px-3 py-2 text-left transition ${
                      isHighlighted ? "bg-blue-50" : "hover:bg-gray-50"
                    }`}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => selectOption(option)}
                  >
                    <span className="text-sm font-semibold text-gran-navy">
                      {option.label}
                    </span>
                    {(option.description || option.meta) && (
                      <span className="text-xs text-gran-muted">
                        {[option.description, option.meta]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
