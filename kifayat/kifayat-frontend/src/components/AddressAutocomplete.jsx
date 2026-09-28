import { useState, useEffect, useRef } from "react";
import { searchAddress } from "../services/geocoding";

const AddressAutocomplete = ({ value, onChange, onSelect, placeholder, required, className, dark }) => {
  const [input, setInput] = useState(value || "");
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  // Sync external value changes
  useEffect(() => { setInput(value || ""); }, [value]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = (val) => {
    setInput(val);
    onChange(val);
    setActiveIdx(-1);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const results = await searchAddress(val);
      setSuggestions(results);
      setShowDropdown(results.length > 0);
      setLoading(false);
    }, 300);
  };

  const handleSelect = (item) => {
    setInput(item.label);
    setShowDropdown(false);
    if (onSelect) onSelect(item);
  };

  const handleKeyDown = (e) => {
    if (!showDropdown || !suggestions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIdx]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  const theme = dark
    ? { bg: "#1a1a2e", text: "#f5f5f5", border: "rgba(255,255,255,0.2)", hover: "rgba(255,255,255,0.08)", muted: "rgba(255,255,255,0.5)" }
    : { bg: "#fff", text: "#111827", border: "#e5e7eb", hover: "#f3f4f6", muted: "#6b7280" };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={input}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (suggestions.length) setShowDropdown(true); }}
        placeholder={placeholder || "Start typing..."}
        required={required}
        className={className}
        autoComplete="off"
      />
      {loading && (
        <div style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)" }}>
          <div style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
        </div>
      )}
      {showDropdown && suggestions.length > 0 && (
        <ul
          style={{
            position: "absolute", top: "100%", left: 0, right: 0,
            background: theme.bg, border: `1px solid ${theme.border}`,
            borderRadius: "10px", marginTop: "4px", padding: "4px 0",
            listStyle: "none", zIndex: 1000, maxHeight: "240px",
            overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          }}
        >
          {suggestions.map((item, idx) => (
            <li
              key={idx}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setActiveIdx(idx)}
              style={{
                padding: "10px 14px",
                cursor: "pointer",
                fontSize: "13px",
                color: theme.text,
                background: idx === activeIdx ? theme.hover : "transparent",
                borderBottom: idx < suggestions.length - 1 ? `1px solid ${theme.border}` : "none",
              }}
            >
              <div style={{ fontWeight: 600 }}>{item.label?.split(",")[0] || item.label}</div>
              <div style={{ fontSize: "11px", color: theme.muted, marginTop: "2px" }}>
                {[item.area, item.city, "Pakistan"].filter(Boolean).join(", ")}
              </div>
            </li>
          ))}
        </ul>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default AddressAutocomplete;
