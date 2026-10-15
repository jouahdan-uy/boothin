import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import BackgroundPicker from "../components/BackgroundPicker";
import FrameArt from "../components/FrameArt";
import { getTheme, resolveThemeId } from "../data/themes";
import { getLayout } from "../engine/layouts";
import { useBooth } from "../state/boothContext";

/**
 * Halaman khusus memilih background. Hanya butuh `frame`, jadi bisa ditaruh di mana saja dalam
 * alur (sekarang: setelah Review, supaya preview memakai foto sungguhan).
 */
export default function Background() {
  const navigate = useNavigate();
  const { frame, photos, setTheme, setInset } = useBooth();

  useEffect(() => {
    if (!frame) navigate("/frames", { replace: true });
  }, [frame, navigate]);

  if (!frame) return null;

  const themeId = resolveThemeId(getLayout(frame.layout ?? frame.id), frame.themeId);

  return (
    <main className="bg-page">
      <header className="bg-header">
        <button type="button" className="back-button" onClick={() => navigate("/review")}>
          ← back
        </button>

        <div className="bg-brand">boothin'</div>

        <span className="bg-step">STEP 03 / BACKGROUND</span>
      </header>

      <section className="bg-content">
        <div className="bg-preview">
          <FrameArt frame={frame} photos={photos} maxHeight="var(--bg-preview-h)" showNumbers={false} />
          <p className="bg-preview-name">{getTheme(themeId).name}</p>
        </div>

        <aside className="bg-panel">
          <p className="eyebrow">YOUR LITTLE MOMENT</p>
          <h1>
            pick a <em>background.</em>
          </h1>

          <BackgroundPicker frame={frame} onTheme={setTheme} onInset={setInset} />

          <div className="bg-actions">
            <button type="button" className="finish-button" onClick={() => navigate("/editor")}>
              next: stickers →
            </button>
          </div>
        </aside>
      </section>
    </main>
  );
}
