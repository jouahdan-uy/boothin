import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import FrameArt from "../components/FrameArt";
import BackgroundPicker from "../components/BackgroundPicker";
import { TEXT_FONT_FAMILY } from "../engine/compositor.js";
import { getGeometry } from "../engine/layouts.js";
import { useFitBox } from "../hooks/useFitBox.js";
import { useStickerHistory } from "../hooks/useStickerHistory.js";
import { useBooth } from "../state/boothContext";

/* Ukuran stiker = persen lebar frame (sama dengan yang dipakai compositor saat export). */
const IMAGE_SIZE = { min: 5, max: 90, initial: 24 };
const TEXT_SIZE = { min: 3, max: 26, initial: 9 };
const TEXT_COLORS = ["#171513", "#ffffff", "#e8527a", "#f2a900", "#3b6fd4", "#2f9e6b"];
const CATEGORY_ORDER = ["cute", "kawaii", "y2k", "gothic", "emoji", "retro", "photobooth", "seasonal"];
const MAX_TEXT = 40;

const sizeRange = (sticker) => (sticker?.type === "text" ? TEXT_SIZE : IMAGE_SIZE);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeRotation(degrees) {
  let value = ((degrees + 180) % 360 + 360) % 360 - 180;
  if (value === -180) value = 180;
  return Math.round(value);
}

function isTextField(target) {
  const tag = target?.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") return !["range", "checkbox", "radio", "button"].includes(target.type);
  return Boolean(target?.isContentEditable);
}

function StickerThumb({ sticker }) {
  const [src, setSrc] = useState(sticker.thumb ?? sticker.src);

  return (
    <img
      src={src}
      alt={sticker.name ?? sticker.id}
      loading="lazy"
      draggable="false"
      onError={() => {
        // Thumbnail hilang -> pakai gambar asli; kalau itu juga gagal, biarkan kosong.
        if (src !== sticker.src) setSrc(sticker.src);
      }}
    />
  );
}

export default function Editor() {
  const navigate = useNavigate();
  const { frame, photos, isComplete, stickers: savedStickers, setStickers: saveStickers, setTheme, setInset } = useBooth();

  const { stickers, set, snapshot, settle, commit, undo, redo, canUndo, canRedo } =
    useStickerHistory(savedStickers);

  const [catalog, setCatalog] = useState([]);
  const [catalogState, setCatalogState] = useState("loading"); // loading | ready | error
  const [tool, setTool] = useState("stickers"); // stickers | text
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [draftText, setDraftText] = useState("best day");
  const [draftColor, setDraftColor] = useState(TEXT_COLORS[0]);

  const stageRef = useRef(null);
  const artRef = useRef(null);
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const stickersRef = useRef(stickers);

  useEffect(() => {
    stickersRef.current = stickers;
  });

  const geometry = frame ? getGeometry(frame) : null;
  const box = useFitBox(stageRef, geometry?.ratio ?? 1, 16);

  /* ---------- guard & sinkronisasi ke state booth ---------- */

  useEffect(() => {
    if (!frame) navigate("/frames", { replace: true });
    else if (!isComplete) navigate("/camera", { replace: true });
  }, [frame, isComplete, navigate]);

  useEffect(() => {
    saveStickers(stickers);
  }, [stickers, saveStickers]);

  /* ---------- katalog stiker ---------- */

  useEffect(() => {
    let cancelled = false;

    fetch("/stickers/stickers.json")
      .then((response) => {
        if (!response.ok) throw new Error("Sticker manifest not found");
        return response.json();
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.stickers;
        if (!Array.isArray(list)) throw new Error("Sticker manifest invalid");
        if (cancelled) return;
        setCatalog(list);
        setCatalogState("ready");
      })
      .catch((error) => {
        console.warn("Gagal memuat stiker:", error);
        if (!cancelled) setCatalogState("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const present = [...new Set(catalog.map((item) => item.category))];
    const ordered = [
      ...CATEGORY_ORDER.filter((name) => present.includes(name)),
      ...present.filter((name) => !CATEGORY_ORDER.includes(name)).sort(),
    ];
    return ["all", ...ordered];
  }, [catalog]);

  const visibleStickers = useMemo(
    () => (activeCategory === "all" ? catalog : catalog.filter((item) => item.category === activeCategory)),
    [catalog, activeCategory]
  );

  const selected = stickers.find((item) => item.id === selectedId) ?? null;

  /* ---------- aksi ---------- */

  function addSticker(item) {
    const id = newId();

    commit((list) => {
      const offset = (list.length % 5) * 3;
      return [
        ...list,
        {
          id,
          src: item.src,
          name: item.name ?? item.id,
          x: 44 + offset,
          y: 40 + offset,
          size: IMAGE_SIZE.initial,
          rotation: 0,
        },
      ];
    });

    setSelectedId(id);
  }

  function addText() {
    const text = draftText.trim().slice(0, MAX_TEXT);
    if (!text) return;
    const id = newId();

    commit((list) => {
      const offset = (list.length % 5) * 3;
      return [
        ...list,
        {
          id,
          type: "text",
          text,
          color: draftColor,
          x: 50,
          y: 45 + offset,
          size: TEXT_SIZE.initial,
          rotation: 0,
        },
      ];
    });

    setSelectedId(id);
  }

  function removeSelected() {
    if (!selectedId) return;
    commit((list) => list.filter((item) => item.id !== selectedId));
    setSelectedId(null);
  }

  function moveLayer(direction) {
    if (!selectedId) return;
    commit((list) => {
      const item = list.find((entry) => entry.id === selectedId);
      if (!item) return list;
      const rest = list.filter((entry) => entry.id !== selectedId);
      return direction === "front" ? [...rest, item] : [item, ...rest];
    });
  }

  function patchSelected(patch) {
    if (!selectedId) return;
    set((list) => list.map((item) => (item.id === selectedId ? { ...item, ...patch } : item)));
  }

  /* ---------- keyboard ---------- */

  useEffect(() => {
    function onKeyDown(event) {
      if (isTextField(event.target)) return;

      const key = event.key.toLowerCase();

      if ((event.ctrlKey || event.metaKey) && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && key === "y") {
        event.preventDefault();
        redo();
        return;
      }

      if (key === "escape") {
        setSelectedId(null);
        return;
      }

      if ((key === "delete" || key === "backspace") && selectedId) {
        event.preventDefault();
        commit((list) => list.filter((item) => item.id !== selectedId));
        setSelectedId(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, undo, redo, commit]);

  /* ---------- gesture: drag, handle (resize + rotate), pinch ---------- */

  function frameRect() {
    return artRef.current?.getBoundingClientRect() ?? null;
  }

  function startDrag(sticker, pointerId, clientX, clientY) {
    gesture.current = {
      type: "drag",
      id: sticker.id,
      pointerId,
      startX: clientX,
      startY: clientY,
      originX: sticker.x,
      originY: sticker.y,
    };
  }

  function startPinch(sticker) {
    const [first, second] = [...pointers.current.values()];
    gesture.current = {
      type: "pinch",
      id: sticker.id,
      distance: Math.hypot(second.x - first.x, second.y - first.y) || 1,
      angle: Math.atan2(second.y - first.y, second.x - first.x),
      size: sticker.size,
      rotation: sticker.rotation,
    };
  }

  function handlePointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture?.(event.pointerId);

    const current = gesture.current;

    // Jari kedua saat sedang menggeser stiker => pinch (resize + rotate).
    if (current?.type === "drag" && pointers.current.size === 2) {
      const sticker = stickersRef.current.find((item) => item.id === current.id);
      if (sticker) startPinch(sticker);
      return;
    }

    if (current) return;

    const handleEl = event.target.closest("[data-handle]");
    const stickerEl = event.target.closest("[data-sticker-id]");

    if (handleEl && selectedId) {
      const sticker = stickersRef.current.find((item) => item.id === selectedId);
      const rect = frameRect();
      if (!sticker || !rect) return;

      const cx = rect.left + (sticker.x / 100) * rect.width;
      const cy = rect.top + (sticker.y / 100) * rect.height;

      snapshot();
      gesture.current = {
        type: "handle",
        id: sticker.id,
        pointerId: event.pointerId,
        cx,
        cy,
        distance: Math.max(8, Math.hypot(event.clientX - cx, event.clientY - cy)),
        angle: Math.atan2(event.clientY - cy, event.clientX - cx),
        size: sticker.size,
        rotation: sticker.rotation,
      };
      return;
    }

    if (stickerEl) {
      const sticker = stickersRef.current.find((item) => item.id === stickerEl.dataset.stickerId);
      if (!sticker) return;

      setSelectedId(sticker.id);
      snapshot();
      startDrag(sticker, event.pointerId, event.clientX, event.clientY);
      return;
    }

    setSelectedId(null);
  }

  function handlePointerMove(event) {
    if (pointers.current.has(event.pointerId)) {
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    const current = gesture.current;
    if (!current) return;

    const target = stickersRef.current.find((item) => item.id === current.id);
    if (!target) return;
    const range = sizeRange(target);

    if (current.type === "drag") {
      if (event.pointerId !== current.pointerId) return;
      const rect = frameRect();
      if (!rect) return;

      const x = clamp(current.originX + ((event.clientX - current.startX) / rect.width) * 100, 0, 100);
      const y = clamp(current.originY + ((event.clientY - current.startY) / rect.height) * 100, 0, 100);

      set((list) => list.map((item) => (item.id === current.id ? { ...item, x, y } : item)));
      return;
    }

    if (current.type === "handle") {
      if (event.pointerId !== current.pointerId) return;

      const distance = Math.hypot(event.clientX - current.cx, event.clientY - current.cy);
      const angle = Math.atan2(event.clientY - current.cy, event.clientX - current.cx);

      set((list) =>
        list.map((item) =>
          item.id === current.id
            ? {
                ...item,
                size: clamp(current.size * (distance / current.distance), range.min, range.max),
                rotation: normalizeRotation(current.rotation + ((angle - current.angle) * 180) / Math.PI),
              }
            : item
        )
      );
      return;
    }

    if (current.type === "pinch" && pointers.current.size >= 2) {
      const [first, second] = [...pointers.current.values()];
      const distance = Math.hypot(second.x - first.x, second.y - first.y) || 1;
      const angle = Math.atan2(second.y - first.y, second.x - first.x);

      set((list) =>
        list.map((item) =>
          item.id === current.id
            ? {
                ...item,
                size: clamp(current.size * (distance / current.distance), range.min, range.max),
                rotation: normalizeRotation(current.rotation + ((angle - current.angle) * 180) / Math.PI),
              }
            : item
        )
      );
    }
  }

  function handlePointerEnd(event) {
    pointers.current.delete(event.pointerId);
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    const current = gesture.current;
    if (!current) return;

    // Pinch dua jari -> satu jari tersisa: lanjut sebagai drag, bukan loncat.
    if (current.type === "pinch" && pointers.current.size === 1) {
      const [[pointerId, point]] = [...pointers.current.entries()];
      const sticker = stickersRef.current.find((item) => item.id === current.id);
      if (sticker) startDrag(sticker, pointerId, point.x, point.y);
      return;
    }

    if (pointers.current.size === 0) {
      gesture.current = null;
      settle();
    }
  }

  /* ---------- render ---------- */

  if (!frame || !isComplete) return null;

  const range = sizeRange(selected);

  return (
    <main className="editor-page">
      <header className="editor-header">
        <button type="button" className="editor-back" onClick={() => navigate("/background")}>
          ← back
        </button>

        <div className="editor-brand">boothin'</div>

        <div className="editor-header-right">
          <span className="editor-step">STEP 04 / STICKERS</span>
          <button type="button" className="editor-done editor-done-compact" onClick={() => navigate("/result")}>
            done →
          </button>
        </div>
      </header>

      <section className="editor-workspace">
        {/* ============ PANEL KIRI: stiker & teks ============ */}
        <aside className="sticker-panel">
          <div className="tool-tabs" role="tablist">
            {["stickers", "text", "frame"].map((name) => (
              <button
                type="button"
                role="tab"
                aria-selected={tool === name}
                key={name}
                className={tool === name ? "active" : ""}
                onClick={() => setTool(name)}
              >
                {name}
              </button>
            ))}
            <span className="tool-count">{stickers.length}</span>
          </div>

          {tool === "frame" ? (
            <div className="frame-tool">
              <BackgroundPicker frame={frame} onTheme={setTheme} onInset={setInset} />
            </div>
          ) : tool === "stickers" ? (
            <>
              <div className="sticker-categories">
                {categories.map((category) => (
                  <button
                    type="button"
                    key={category}
                    className={activeCategory === category ? "active" : ""}
                    onClick={() => setActiveCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <div className="sticker-library">
                {visibleStickers.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className="sticker-option"
                    onClick={() => addSticker(item)}
                    title={item.name ?? item.id}
                  >
                    <StickerThumb sticker={item} />
                  </button>
                ))}

                {catalogState === "loading" && (
                  <div className="sticker-empty">
                    <span>✦</span>
                    <p>Loading stickers...</p>
                  </div>
                )}

                {catalogState === "error" && (
                  <div className="sticker-empty">
                    <span>♡</span>
                    <p>Stickers could not be loaded. You can still add text.</p>
                  </div>
                )}

                {catalogState === "ready" && visibleStickers.length === 0 && (
                  <div className="sticker-empty">
                    <span>♡</span>
                    <p>No stickers here yet.</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-tool">
              <label htmlFor="draft-text">YOUR TEXT</label>
              <input
                id="draft-text"
                type="text"
                value={draftText}
                maxLength={MAX_TEXT}
                placeholder="best day"
                onChange={(event) => setDraftText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addText();
                }}
              />

              <div className="color-row" role="radiogroup" aria-label="Text color">
                {TEXT_COLORS.map((color) => (
                  <button
                    type="button"
                    key={color}
                    role="radio"
                    aria-checked={draftColor === color}
                    aria-label={color}
                    className={draftColor === color ? "swatch active" : "swatch"}
                    style={{ background: color }}
                    onClick={() => setDraftColor(color)}
                  />
                ))}
              </div>

              <button type="button" className="add-text" onClick={addText} disabled={!draftText.trim()}>
                add text +
              </button>
            </div>
          )}
        </aside>

        {/* ============ TENGAH: frame ============ */}
        <section className="editor-stage-column">
          <div
            ref={stageRef}
            className="editor-stage"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
          >
            <FrameArt
              frame={frame}
              photos={photos}
              artRef={artRef}
              showNumbers={false}
              className="editor-photo"
              style={box ? { width: box.width, height: box.height } : { visibility: "hidden" }}
            >
              {stickers.map((sticker) => {
                const isSelected = sticker.id === selectedId;
                const isText = sticker.type === "text";

                return (
                  <div
                    key={sticker.id}
                    data-sticker-id={sticker.id}
                    role="button"
                    tabIndex={0}
                    aria-label={isText ? `Text: ${sticker.text}` : `Sticker: ${sticker.name}`}
                    className={`placed-sticker${isText ? " is-text" : ""}${isSelected ? " selected" : ""}`}
                    style={{
                      left: `${sticker.x}%`,
                      top: `${sticker.y}%`,
                      transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg)`,
                      ...(isText
                        ? { fontSize: `${sticker.size}cqw`, color: sticker.color, fontFamily: TEXT_FONT_FAMILY }
                        : { width: `${sticker.size}%` }),
                    }}
                    onFocus={() => setSelectedId(sticker.id)}
                  >
                    {isText ? sticker.text : <img src={sticker.src} alt="" draggable="false" />}

                    {isSelected && <span data-handle className="sticker-handle" aria-hidden="true" />}
                  </div>
                );
              })}
            </FrameArt>
          </div>

          <div className="editor-toolbar" role="toolbar" aria-label="Edit tools">
            <button type="button" onClick={undo} disabled={!canUndo} aria-label="Undo">
              ↶ undo
            </button>
            <button type="button" onClick={redo} disabled={!canRedo} aria-label="Redo">
              redo ↷
            </button>
            <span className="toolbar-divider" />
            <button type="button" onClick={() => moveLayer("front")} disabled={!selected}>
              ↑ front
            </button>
            <button type="button" onClick={() => moveLayer("back")} disabled={!selected}>
              ↓ back
            </button>
            <button type="button" className="danger" onClick={removeSelected} disabled={!selected}>
              delete
            </button>
          </div>

          <div className="editor-stage-hint">
            drag to move · pull the corner dot to resize &amp; rotate · pinch on a phone
          </div>
        </section>

        {/* ============ KANAN: kontrol (desktop) ============ */}
        <aside className="editor-controls">
          <div className="panel-heading">
            <span>SELECTED</span>
            <span>{selected ? (selected.type === "text" ? "TEXT" : "STICKER") : "—"}</span>
          </div>

          {!selected ? (
            <div className="no-selection">
              <span>✦</span>
              <p>Pick a sticker from the library, or tap one on the photo.</p>
            </div>
          ) : (
            <div className="selected-controls">
              {selected.type === "text" ? (
                <div className="control-group">
                  <div className="control-label">
                    <span>TEXT</span>
                  </div>
                  <input
                    type="text"
                    className="text-edit"
                    value={selected.text}
                    maxLength={MAX_TEXT}
                    onFocus={snapshot}
                    onBlur={settle}
                    onChange={(event) => patchSelected({ text: event.target.value })}
                  />
                  <div className="color-row">
                    {TEXT_COLORS.map((color) => (
                      <button
                        type="button"
                        key={color}
                        aria-label={color}
                        className={selected.color === color ? "swatch active" : "swatch"}
                        style={{ background: color }}
                        onClick={() => {
                          snapshot();
                          patchSelected({ color });
                          settle();
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="selected-preview">
                  <img src={selected.src} alt="" />
                </div>
              )}

              <div className="control-group">
                <div className="control-label">
                  <span>SIZE</span>
                  <span>{Math.round(selected.size)}%</span>
                </div>
                <input
                  type="range"
                  min={range.min}
                  max={range.max}
                  step="0.5"
                  value={selected.size}
                  aria-label="Size"
                  onPointerDown={snapshot}
                  onPointerUp={settle}
                  onPointerCancel={settle}
                  onKeyDown={(event) => !event.repeat && snapshot()}
                  onKeyUp={settle}
                  onChange={(event) => patchSelected({ size: Number(event.target.value) })}
                />
              </div>

              <div className="control-group">
                <div className="control-label">
                  <span>ROTATE</span>
                  <span>{selected.rotation}°</span>
                </div>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  value={selected.rotation}
                  aria-label="Rotation"
                  onPointerDown={snapshot}
                  onPointerUp={settle}
                  onPointerCancel={settle}
                  onKeyDown={(event) => !event.repeat && snapshot()}
                  onKeyUp={settle}
                  onChange={(event) => patchSelected({ rotation: Number(event.target.value) })}
                />
              </div>
            </div>
          )}

          <div className="editor-controls-bottom">
            <button type="button" className="editor-done" onClick={() => navigate("/result")}>
              selesai →
            </button>
          </div>
        </aside>
      </section>
    </main>
  );
}
