import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import FrameArt from "../components/FrameArt";
import ThemeSwatch from "../components/ThemeSwatch";
import { categories, frames } from "../data/frames";
import { getTheme, resolveThemeId, THEME_GROUPS, themesFor } from "../data/themes";
import { useBooth } from "../state/boothContext";

export default function Frames() {
  const navigate = useNavigate();
  const { frame: currentFrame, selectFrame } = useBooth();

  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState(
    () => frames.find((item) => item.id === currentFrame?.id) ?? frames[0],
  );
  // Tema yang dipilih user. null = tiap frame memakai tema bawaannya.
  const [pickedTheme, setPickedTheme] = useState(currentFrame?.themeId ?? null);

  const themeOf = (layout) => resolveThemeId(layout, pickedTheme);

  const visibleFrames = category === "all" ? frames : frames.filter((frame) => frame.category === category);

  const selectedThemeId = themeOf(selected);
  const compatibleThemes = useMemo(() => themesFor(selected), [selected]);

  function handleUse() {
    selectFrame({ ...selected, themeId: selectedThemeId });
    navigate("/camera");
  }

  return (
    <main className="frames-page">
      <header className="frames-header">
        <div>
          <p className="eyebrow">STEP 01 / CHOOSE YOUR FRAME</p>
          <h1>pick your mood.</h1>
        </div>

        <button type="button" className="back-button" onClick={() => navigate("/")}>
          ← back
        </button>
      </header>

      <nav className="frame-categories" aria-label="Frame categories">
        {categories.map((item) => (
          <button
            type="button"
            key={item}
            className={category === item ? "active" : ""}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      <section className="frames-layout">
        <div className="frame-grid">
          {visibleFrames.map((frame) => (
            <button
              type="button"
              className={`frame-card ${selected.id === frame.id ? "selected" : ""}`}
              key={frame.id}
              onClick={() => setSelected(frame)}
              aria-pressed={selected.id === frame.id}
            >
              <div className="frame-card-art">
                <FrameArt
                  frame={{ ...frame, themeId: themeOf(frame) }}
                  maxHeight="190px"
                  showNumbers={false}
                />
              </div>

              <div className="frame-card-info">
                <strong>{frame.name}</strong>
                <span>
                  {frame.slots} {frame.slots === 1 ? "photo" : "photos"} · {frame.ratio}
                </span>
              </div>
            </button>
          ))}

          {visibleFrames.length === 0 && <p className="frame-empty">No frames in this category yet.</p>}
        </div>

        <aside className="frame-detail">
          <p className="eyebrow">SELECTED FRAME</p>

          <div className="frame-detail-art">
            <FrameArt frame={{ ...selected, themeId: selectedThemeId }} maxHeight="min(38dvh, 340px)" />
          </div>

          <h2>{selected.name}</h2>

          <p>
            {selected.slots} {selected.slots === 1 ? "photo" : "photos"} · {selected.ratio} ·{" "}
            {getTheme(selectedThemeId).name}
          </p>

          <div className="theme-picker">
            {THEME_GROUPS.map((group) => {
              const items = compatibleThemes.filter((theme) => theme.group === group.id);
              if (items.length === 0) return null;
              return (
                <div className="theme-group" key={group.id}>
                  <span className="theme-group-label">{group.label}</span>
                  <div className="theme-grid">
                    {items.map((theme) => (
                      <ThemeSwatch
                        key={theme.id}
                        theme={theme}
                        selected={theme.id === selectedThemeId}
                        onSelect={setPickedTheme}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <button type="button" className="start-button" onClick={handleUse}>
            use this frame
            <span>→</span>
          </button>
        </aside>
      </section>
    </main>
  );
}
