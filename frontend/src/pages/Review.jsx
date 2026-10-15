import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import FrameArt from "../components/FrameArt";
import { useBooth } from "../state/boothContext";

export default function Review() {
  const navigate = useNavigate();
  const { frame, photos, isComplete, setPhoto, clearPhotos } = useBooth();

  // Saat user menekan "retake", slot sengaja dikosongkan lalu pindah ke kamera;
  // jangan sampai guard di bawah ikut menimpa navigasi itu.
  const leaving = useRef(false);

  useEffect(() => {
    if (leaving.current) return;
    if (!frame) navigate("/frames", { replace: true });
    else if (!isComplete) navigate("/camera", { replace: true });
  }, [frame, isComplete, navigate]);

  if (!frame || !isComplete) return null;

  function handleRetake(index) {
    leaving.current = true;
    setPhoto(index, null);
    navigate("/camera", { state: { retake: index } });
  }

  function handleRetakeAll() {
    leaving.current = true;
    clearPhotos();
    navigate("/camera");
  }

  return (
    <main className="review-page">
      <header className="review-header">
        <button type="button" className="back-button" onClick={() => navigate("/")}>
          ← start over
        </button>

        <div className="review-brand">boothin'</div>

        <span className="review-step">STEP 02 / REVIEW</span>
      </header>

      <section className="review-content">
        <div className="review-copy">
          <p className="eyebrow">YOUR LITTLE MOMENT</p>

          <h1>
            looks good.
            <br />
            <em>or retake.</em>
          </h1>

          <p>Tap any photo inside the frame if you want to take that shot again.</p>
        </div>

        <div className="review-photo-area">
          <FrameArt
            frame={frame}
            photos={photos}
            maxHeight="min(62dvh, 560px)"
            onSlotClick={handleRetake}
            badge="↻ retake"
          />

          <p className="review-hint">TAP A PHOTO TO RETAKE</p>
        </div>

        <div className="review-actions">
          <button type="button" className="retake-all-button" onClick={handleRetakeAll}>
            retake all
          </button>

          <button type="button" className="finish-button" onClick={() => navigate("/background")}>
            looks perfect →
          </button>
        </div>
      </section>
    </main>
  );
}
