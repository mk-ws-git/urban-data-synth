import { useEffect, useRef, useState } from "react";
import { searchPlaces, type Place } from "../data/geocode";

interface Props {
  current: string;
  onSelect: (p: Place) => void;
}

export function LocationSearch({ current, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced global geocoding search.
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      searchPlaces(query)
        .then((r) => {
          setResults(r);
          setOpen(true);
        })
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // Close the dropdown on outside click.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const choose = (p: Place) => {
    onSelect(p);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  return (
    <div className="locsearch" ref={boxRef}>
      <input
        type="text"
        value={query}
        placeholder={`Search any location — ${current}`}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
      />
      {open && (results.length > 0 || loading) && (
        <ul className="loc-results">
          {loading && <li className="loc-hint">Searching…</li>}
          {results.map((p, i) => (
            <li key={`${p.latitude},${p.longitude},${i}`}>
              <button onClick={() => choose(p)}>{p.label}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
