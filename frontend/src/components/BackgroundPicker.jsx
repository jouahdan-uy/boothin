import { useEffect, useMemo, useState } from "react";

import {
  HEX_PATTERN,
  IMPORTED_THEMES,
  PATTERN_TAGS,
  THEMES,
  customThemeId,
  getTheme,
  importedFor,
  isCustomThemeId,
  resolveThemeId,
  themesFor,
} from "../data/themes";
import { getLayout } from "../engine/layouts";
import ThemeSwatch from "./ThemeSwatch";

/** Warna siap pakai selain tema polos bawaan. */
const QUICK_COLORS = ["#ff6b8b", "#ff9f43", "#feca57", "#1dd1a1", "#48dbfb", "#5f6dff", "#a29bfe", "#ff9ff3"];

export const BORDER_OPTIONS = [
  { id: "slim", label: "Slim", inset: 0 },
  { id: "medium", label: "Medium", inset: 70 },
  { id: "wide", label: "Wide", inset: 140 },
];

const normalizeHex = (value) => {
  const raw = String(value).trim().replace(/^#/, "");
  return HEX_PATTERN.test(raw) ? `#${raw.toLowerCase()}` : null;
};

function PatternTile({ theme, selected, onSelect }) {
  // Thumbnail opsional: kalau tidak ada / gagal dimuat, pakai gambar aslinya.
  const [src, setSrc] = useState(theme.thumb ?? theme.bg.src);

  return (
    <button
      type="button"
      className={`pattern-tile${selected ? " active" : ""}`}
      aria-pressed={selected}
      aria-label={theme.name}
      title={theme.name}
      onClick={() => onSelect(theme.id)}
    >
      <img
        src={src}
        alt=""
        loading="lazy"
        draggable="false"
        onError={() => {
          if (src !== theme.bg.src) setSrc(theme.bg.src);
        }}
      />
      <span>{theme.name}</span>
    </button>
  );
}

function ColorTab({ themeId, onSelect }) {
  const current = isCustomThemeId(themeId) ? themeId.split(":") : null;

  const [color, setColor] = useState(current ? `#${current[1]}` : "#f3dfe2");
  const [color2, setColor2] = useState(current?.[2] ? `#${current[2]}` : "#c9e4ff");
  const [gradient, setGradient] = useState(Boolean(current?.[2]));
  const [hexText, setHexText] = useState(color);
  const [hexError, setHexError] = useState(false);

  const apply = (a, b, useGradient) => onSelect(customThemeId(a, useGradient ? b : null));

  function pickPrimary(value) {
    setColor(value);
    setHexText(value);
    setHexError(false);
    apply(value, color2, gradient);
  }

  function pickSecondary(value) {
    setColor2(value);
    apply(color, value, true);
  }

  function typeHex(value) {
    setHexText(value);
    const hex = normalizeHex(value);
    setHexError(!hex);
    if (hex) {
      setColor(hex);
      apply(hex, color2, gradient);
    }
  }

  function toggleGradient(on) {
    setGradient(on);
    apply(color, color2, on);
  }

  const solids = THEMES.filter((theme) => theme.group === "solid");

  return (
    <div className="color-tab">
      <div className="picker-row">
        <label className="color-well" aria-label="Pick a color">
          <input type="color" value={color} onChange={(event) => pickPrimary(event.target.value)} />
          <span style={{ background: color }} />
        </label>

        <div className="hex-field">
          <label htmlFor="bg-hex">HEX</label>
          <input
            id="bg-hex"
            type="text"
            value={hexText}
            maxLength={7}
            spellCheck="false"
            autoComplete="off"
            aria-invalid={hexError}
            className={hexError ? "invalid" : ""}
            onChange={(event) => typeHex(event.target.value)}
          />
        </div>
      </div>

      <label className="toggle-row">
        <input type="checkbox" checked={gradient} onChange={(event) => toggleGradient(event.target.checked)} />
        <span>Two colors (gradient)</span>
      </label>

      {gradient && (
        <div className="picker-row">
          <label className="color-well" aria-label="Pick the second color">
            <input type="color" value={color2} onChange={(event) => pickSecondary(event.target.value)} />
            <span style={{ background: color2 }} />
          </label>
          <span className="picker-hint">second color</span>
        </div>
      )}

      <span className="theme-group-label">Quick colors</span>
      <div className="theme-grid quick-grid">
        {QUICK_COLORS.map((hex) => (
          <button
            type="button"
            key={hex}
            className={`color-chip${themeId === customThemeId(hex) ? " active" : ""}`}
            style={{ background: hex }}
            aria-label={hex}
            onClick={() => {
              setColor(hex);
              setHexText(hex);
              setHexError(false);
              setGradient(false);
              apply(hex, color2, false);
            }}
          />
        ))}
      </div>

      <span className="theme-group-label">Soft solids</span>
      <div className="theme-grid">
        {solids.map((theme) => (
          <ThemeSwatch key={theme.id} theme={theme} selected={theme.id === themeId} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

/**
 * Pemilih background lengkap: pattern dari gambar, warna (color picker), dan tema bawaan.
 * Dipakai di halaman Background dan di tab "frame" pada Editor.
 */
export default function BackgroundPicker({ frame, onTheme, onInset }) {
  const layout = getLayout(frame.layout ?? frame.id);
  const isFilm = layout?.themeSet === "film";
  const themeId = resolveThemeId(layout, frame.themeId);
  const theme = getTheme(themeId);

  const tabs = isFilm
    ? [["film", "Film"], ["colors", "Colors"]]
    : [["patterns", "My patterns"], ["colors", "Colors"], ["more", "Built-in"]];

  // Galeri pattern selalu jadi tab awal (itu tujuan halaman ini); warna kustom langsung ke tab Colors.
  const initialTab = () => {
    if (isFilm) return theme.group === "custom" ? "colors" : "film";
    return theme.group === "custom" ? "colors" : "patterns";
  };

  const [tab, setTab] = useState(initialTab);
  const [tag, setTag] = useState("all");

  // Layout berganti (mis. film <-> bukan film): pastikan tab yang aktif masih ada.
  useEffect(() => {
    if (!tabs.some(([id]) => id === tab)) setTab(tabs[0][0]);
  }, [isFilm]); // eslint-disable-line react-hooks/exhaustive-deps

  const patterns = useMemo(() => importedFor(layout), [layout]);
  const shown = tag === "all" ? patterns : patterns.filter((item) => item.tag === tag);
  const tagCounts = useMemo(
    () => Object.fromEntries(PATTERN_TAGS.map((name) => [name, IMPORTED_THEMES.filter((item) => item.tag === name).length])),
    [],
  );

  const builtIn = themesFor(layout);

  return (
    <div className="bg-picker">
      <div className="tool-tabs" role="tablist" aria-label="Background type">
        {tabs.map(([id, label]) => (
          <button
            type="button"
            role="tab"
            key={id}
            aria-selected={tab === id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-picker-body">
        {tab === "patterns" && (
          <>
            <div className="sticker-categories pattern-tags">
              {["all", ...PATTERN_TAGS].map((name) => (
                <button
                  type="button"
                  key={name}
                  className={tag === name ? "active" : ""}
                  onClick={() => setTag(name)}
                >
                  {name}
                  {name !== "all" && <em>{tagCounts[name]}</em>}
                </button>
              ))}
            </div>

            <div className="pattern-grid">
              {shown.map((item) => (
                <PatternTile key={item.id} theme={item} selected={item.id === themeId} onSelect={onTheme} />
              ))}
            </div>
          </>
        )}

        {tab === "colors" && <ColorTab themeId={themeId} onSelect={onTheme} />}

        {tab === "more" &&
          ["gradient", "pattern"].map((group) => (
            <div className="theme-group" key={group}>
              <span className="theme-group-label">{group === "gradient" ? "Gradients" : "Built-in patterns"}</span>
              <div className="theme-grid">
                {builtIn
                  .filter((item) => item.group === group)
                  .map((item) => (
                    <ThemeSwatch key={item.id} theme={item} selected={item.id === themeId} onSelect={onTheme} />
                  ))}
              </div>
            </div>
          ))}

        {tab === "film" && (
          <div className="theme-grid">
            {builtIn.map((item) => (
              <ThemeSwatch key={item.id} theme={item} selected={item.id === themeId} onSelect={onTheme} />
            ))}
          </div>
        )}
      </div>

      {!isFilm && (
        <div className="border-control">
          <span className="theme-group-label">Border</span>
          <div className="segmented" role="radiogroup" aria-label="Border thickness">
            {BORDER_OPTIONS.map((option) => (
              <button
                type="button"
                role="radio"
                key={option.id}
                aria-checked={(frame.inset ?? 0) === option.inset}
                className={(frame.inset ?? 0) === option.inset ? "active" : ""}
                onClick={() => onInset(option.inset)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
