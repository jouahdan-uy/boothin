import BackgroundCanvas from "./BackgroundCanvas";

/** Kotak kecil pilihan tema; isinya digambar dengan renderer background yang sama dengan frame. */
export default function ThemeSwatch({ theme, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`theme-swatch${selected ? " active" : ""}`}
      title={theme.name}
      aria-label={theme.name}
      aria-pressed={selected}
      onClick={() => onSelect(theme.id)}
    >
      <BackgroundCanvas bg={theme.bg} zoom={4} />
      {theme.film && <span className="theme-swatch-hole" style={{ background: theme.film.hole }} />}
    </button>
  );
}
