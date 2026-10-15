import { useId } from "react";

import { getGeometry, pct, pctWithin } from "../engine/layouts.js";
import { shapeKey, shapePath } from "../engine/shapes.js";
import BackgroundCanvas from "./BackgroundCanvas";

/** Sama dengan CARD_SHADOW di compositor (cqw = 1% lebar frame). */
const CARD_BOX_SHADOW = "0 0.5cqw 1.6cqw rgba(0,0,0,0.2)";

/**
 * Menggambar frame di DOM dari geometri yang sama dengan export final (engine/layouts.js).
 * Semua posisi dalam persen, jadi komponen ini bebas diskalakan. `children` dirender di
 * atas frame (dipakai Editor untuk stiker).
 *
 * Props:
 *  - maxHeight: batas tinggi CSS (mis. "60dvh"); lebar dihitung dari rasio frame
 *  - onSlotClick(index): kalau ada, slot jadi tombol (Review: ketuk untuk retake)
 *  - badge: teks kecil di pojok slot yang bisa diklik
 */
export default function FrameArt({
  frame,
  photos = [],
  maxHeight,
  onSlotClick,
  badge,
  showNumbers = true,
  artRef,
  className = "",
  style,
  children,
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  if (!frame) return null;

  const g = getGeometry(frame);

  const sized = maxHeight ? { width: `min(100%, calc(${maxHeight} * ${g.ratio.toFixed(5)}))` } : null;

  /* clipPath bentuk: satu per kombinasi (bentuk, ukuran) */
  const clips = new Map();
  const clipFor = (shape, w, h, r) => {
    const d = shapePath(shape, w, h, r);
    if (!d) return undefined;
    const id = `${uid}-${shapeKey(shape, w, h, r)}`;
    clips.set(id, d);
    return `url(#${id})`;
  };

  const roundedStyle = (d) =>
    d.shape === "round" || (d.shape === "rect" && d.r)
      ? { borderRadius: `${(d.r / d.w) * 100}% / ${(d.r / d.h) * 100}%` }
      : { clipPath: clipFor(d.shape, d.w, d.h, d.r), WebkitClipPath: clipFor(d.shape, d.w, d.h, d.r) };

  const renderDecor = (d, index) => (
    <span
      key={`decor-${index}`}
      className="frame-art-decor"
      style={{
        ...pct(d, g),
        background: d.color,
        transform: d.rot ? `rotate(${d.rot}deg)` : undefined,
        ...roundedStyle(d),
      }}
    />
  );

  const brand = g.brand;

  return (
    <div
      ref={artRef}
      className={`frame-art ${className}`.trim()}
      style={{ aspectRatio: `${g.width} / ${g.height}`, background: g.theme.bg.type === "solid" ? g.theme.bg.color : undefined, color: g.ink, ...sized, ...style }}
    >
      <BackgroundCanvas bg={g.bg} />

      {g.decor.filter((d) => d.layer !== "above").map(renderDecor)}

      {g.slots.map((s, index) => {
        const photo = photos[index];
        const Tag = onSlotClick ? "button" : "div";
        const b = s.border;
        const bordered = { x: s.x - b, y: s.y - b, w: s.w + b * 2, h: s.h + b * 2 };
        const photoClip = clipFor(s.shape, s.w, s.h, s.r);
        const borderClip = b > 0 ? clipFor(s.shape, bordered.w, bordered.h, s.r + b) : undefined;

        return (
          <Tag
            key={index}
            type={onSlotClick ? "button" : undefined}
            className="frame-art-slot"
            style={{
              ...pct(s.group, g),
              transform: s.rot ? `rotate(${s.rot}deg)` : undefined,
              background: s.card ? g.paper : undefined,
              boxShadow: s.card ? CARD_BOX_SHADOW : undefined,
            }}
            onClick={onSlotClick ? () => onSlotClick(index) : undefined}
            aria-label={onSlotClick ? `Retake photo ${index + 1}` : undefined}
          >
            {b > 0 && (
              <span
                className="frame-art-border"
                style={{
                  ...pctWithin(bordered, s.group),
                  background: g.paper,
                  clipPath: borderClip,
                  WebkitClipPath: borderClip,
                }}
              />
            )}

            <span
              className="frame-art-photo"
              style={{
                ...pctWithin(s, s.group),
                clipPath: photoClip,
                WebkitClipPath: photoClip,
                ...(s.shape === "round" ? { borderRadius: `${(s.r / s.w) * 100}% / ${(s.r / s.h) * 100}%` } : null),
              }}
            >
              {photo ? (
                <img src={photo} alt={`Photo ${index + 1}`} draggable="false" />
              ) : (
                showNumbers && <span className="frame-art-number">{index + 1}</span>
              )}
            </span>

            {onSlotClick && badge && <span className="frame-art-badge">{badge}</span>}
          </Tag>
        );
      })}

      {g.decor.filter((d) => d.layer === "above").map(renderDecor)}

      <span
        className="frame-art-brand"
        style={{
          left: `${(brand.x / g.width) * 100}%`,
          top: `${(brand.y / g.height) * 100}%`,
          fontSize: `${(brand.size / g.width) * 100}cqw`,
          color: brand.color,
          transform: `translate(-50%, -50%)${brand.rot ? ` rotate(${brand.rot}deg)` : ""}`,
          ...(brand.pill ? { background: brand.pillColor, padding: "0.35em 0.9em", borderRadius: "999px" } : null),
        }}
      >
        boothin'
      </span>

      {children}

      <svg className="frame-art-defs" width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          {[...clips.entries()].map(([id, d]) => (
            <clipPath id={id} key={id} clipPathUnits="objectBoundingBox">
              <path d={d} />
            </clipPath>
          ))}
        </defs>
      </svg>
    </div>
  );
}
