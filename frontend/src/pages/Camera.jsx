import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { captureFromVideo } from "../engine/capture.js";
import { FILTERS, FILTER_GROUPS, filterToCss } from "../engine/filters.js";
import { getGeometry } from "../engine/layouts.js";
import { useFitBox } from "../hooks/useFitBox.js";
import { useBooth } from "../state/boothContext";

const COUNTDOWN_SECONDS = 5;
const FREEZE_MS = 1300;

function stopTracks(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}

function cameraMessage(error) {
  switch (error?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Akses kamera ditolak. Izinkan kamera dari browser (ikon gembok di address bar) lalu coba lagi.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Kamera tidak ditemukan. Sambungkan kamera atau pilih kamera lain.";
    case "NotReadableError":
      return "Kamera sedang dipakai aplikasi lain. Tutup aplikasi itu lalu coba lagi.";
    default:
      return "Kamera tidak bisa digunakan. Coba pilih kamera lain.";
  }
}

export default function Camera() {
  const navigate = useNavigate();
  const location = useLocation();
  const { frame, photos, setPhoto } = useBooth();

  const retakeIndex = Number.isInteger(location.state?.retake) ? location.state.retake : null;

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const stageRef = useRef(null);
  const countdownTimer = useRef(null);
  const freezeTimer = useRef(null);

  const [requestedDevice, setRequestedDevice] = useState("");
  const [activeDevice, setActiveDevice] = useState("");
  const [devices, setDevices] = useState([]);
  const [attempt, setAttempt] = useState(0);

  const [status, setStatus] = useState("starting"); // starting | ready | error
  const [cameraError, setCameraError] = useState("");

  const [filter, setFilter] = useState(FILTERS[0]);
  const [filterGroup, setFilterGroup] = useState(FILTERS[0].group);
  const [manualTarget, setManualTarget] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [frozen, setFrozen] = useState(null);

  const slots = frame?.slots ?? 0;
  const filled = photos.filter(Boolean).length;
  const allDone = frame ? filled >= slots : false;

  // Slot yang akan diisi berikutnya: retake dari Review > dipilih manual > slot kosong pertama.
  const firstEmpty = photos.findIndex((photo) => !photo);
  const targetIndex = retakeIndex ?? manualTarget ?? firstEmpty;

  const busy = countdown !== null || frozen !== null;

  // Nilai terbaru untuk callback timer (supaya tidak membaca state basi).
  const latest = useRef({});
  useEffect(() => {
    latest.current = { filter, targetIndex, retakeIndex };
  });

  // Preview dipotong persis seperti slot tujuan => yang terlihat = yang masuk frame.
  const slotRatio = (() => {
    if (!frame) return 4 / 3;
    const g = getGeometry(frame);
    const rect = g.slots[Math.max(0, targetIndex)] ?? g.slots[0];
    return rect.w / rect.h;
  })();
  const box = useFitBox(stageRef, slotRatio, 0);

  useEffect(() => {
    if (!frame) navigate("/frames", { replace: true });
  }, [frame, navigate]);

  /* ---------------- kamera ---------------- */

  const hasFrame = Boolean(frame);

  useEffect(() => {
    if (!hasFrame) return undefined;

    let cancelled = false;

    async function start() {
      setStatus("starting");
      setCameraError("");

      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        setCameraError(
          window.isSecureContext
            ? "Browser kamu tidak mendukung akses kamera."
            : "Kamera hanya bisa dipakai lewat HTTPS atau localhost."
        );
        return;
      }

      stopTracks(streamRef.current);
      streamRef.current = null;

      const size = { width: { ideal: 1920 }, height: { ideal: 1080 } };
      const attempts = requestedDevice
        ? [{ deviceId: { exact: requestedDevice }, ...size }, { facingMode: "user", ...size }]
        : [{ facingMode: "user", ...size }, { ...size }];

      let stream = null;
      let lastError = null;

      for (const video of attempts) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: false, video });
          break;
        } catch (error) {
          lastError = error;
          if (error.name === "NotAllowedError" || error.name === "SecurityError") break;
        }
      }

      // Komponen sudah ditinggal / effect dijalankan ulang selagi menunggu izin:
      // stream yang baru datang harus dimatikan, kalau tidak lampu kamera tetap menyala.
      if (cancelled) {
        stopTracks(stream);
        return;
      }

      if (!stream) {
        setStatus("error");
        setCameraError(cameraMessage(lastError));
        return;
      }

      streamRef.current = stream;

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.play().catch(() => {});
      }

      setActiveDevice(stream.getVideoTracks()[0]?.getSettings?.().deviceId ?? "");

      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled) setDevices(all.filter((device) => device.kind === "videoinput"));
      } catch {
        /* daftar kamera opsional */
      }
    }

    start();

    return () => {
      cancelled = true;
      stopTracks(streamRef.current);
      streamRef.current = null;
    };
  }, [hasFrame, requestedDevice, attempt]);

  // Bersihkan timer kalau halaman ditinggalkan di tengah countdown / jeda.
  useEffect(
    () => () => {
      clearInterval(countdownTimer.current);
      clearTimeout(freezeTimer.current);
    },
    []
  );

  /* ---------------- capture ---------------- */

  function takePhoto() {
    const { filter: currentFilter, targetIndex: index, retakeIndex: retake } = latest.current;

    try {
      const dataUrl = captureFromVideo(videoRef.current, {
        filter: currentFilter,
        mirrored: true,
      });

      setPhoto(index, dataUrl);
      setManualTarget(null);
      setFrozen(dataUrl);

      // Jeda sebentar supaya user melihat hasilnya sebelum lanjut.
      freezeTimer.current = setTimeout(() => {
        setFrozen(null);
        if (retake !== null) navigate("/review", { replace: true });
      }, FREEZE_MS);
    } catch (error) {
      console.error(error);
      setCameraError("Foto gagal diambil. Coba lagi.");
      setStatus("error");
    }
  }

  function startCountdown() {
    if (busy || status !== "ready" || targetIndex < 0) return;

    let remaining = COUNTDOWN_SECONDS;
    setCountdown(remaining);

    countdownTimer.current = setInterval(() => {
      remaining -= 1;

      if (remaining <= 0) {
        clearInterval(countdownTimer.current);
        countdownTimer.current = null;
        setCountdown(null);
        takePhoto();
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  }

  function cancelCountdown() {
    clearInterval(countdownTimer.current);
    countdownTimer.current = null;
    setCountdown(null);
  }

  function handleContinue() {
    if (!allDone) return;
    navigate("/review");
  }

  if (!frame) return null;

  const captureDisabled = status !== "ready" || busy || targetIndex < 0;

  return (
    <main className="camera-page">
      <header className="camera-header">
        <button
          type="button"
          className="back-button"
          onClick={() => navigate(retakeIndex !== null ? "/review" : "/frames")}
        >
          ← {retakeIndex !== null ? "review" : "frame"}
        </button>

        <div className="camera-brand">boothin'</div>

        <div className="photo-counter">
          {filled}/{slots}
        </div>
      </header>

      <section className="camera-workspace">
        <div className="camera-main">
          <div className="camera-stage" ref={stageRef}>
            <div
              className="camera-preview"
              style={box ? { width: box.width, height: box.height } : { visibility: "hidden" }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="camera-video"
                style={{ filter: filterToCss(filter) }}
                onLoadedData={() => setStatus((current) => (current === "error" ? current : "ready"))}
              />

              {status === "starting" && <div className="camera-loading">preparing camera...</div>}

              {status === "error" && (
                <div className="camera-error">
                  <strong>Camera unavailable</strong>
                  <p>{cameraError}</p>
                  <button
                    type="button"
                    className="start-button"
                    onClick={() => setAttempt((value) => value + 1)}
                  >
                    try again
                  </button>
                </div>
              )}

              {countdown !== null && <div className="camera-countdown">{countdown}</div>}

              {frozen && (
                <>
                  <img className="camera-freeze" src={frozen} alt="Photo just taken" />
                  <div className="capture-flash" />
                  <div className="camera-freeze-label">
                    shot {Math.max(1, filled)}/{slots} ✓
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="camera-controls">
            <div className="camera-device">
              <label htmlFor="camera-select">CAMERA</label>

              <select
                id="camera-select"
                value={activeDevice}
                disabled={busy || devices.length < 2}
                onChange={(event) => setRequestedDevice(event.target.value)}
              >
                {devices.length === 0 && <option value="">Default camera</option>}
                {devices.map((device, index) => (
                  <option value={device.deviceId} key={device.deviceId || index}>
                    {device.label || `Camera ${index + 1}`}
                  </option>
                ))}
              </select>
            </div>

            {countdown !== null ? (
              <button
                type="button"
                className="capture-button capture-cancel"
                onClick={cancelCountdown}
                aria-label="Cancel countdown"
              >
                <span>✕</span>
              </button>
            ) : (
              <button
                type="button"
                className="capture-button"
                onClick={startCountdown}
                disabled={captureDisabled}
                aria-label="Take photo"
              >
                <span />
              </button>
            )}

            <div className="capture-info">
              {countdown !== null
                ? "tap ✕ to cancel"
                : targetIndex < 0
                  ? "all shots complete"
                  : `shot ${targetIndex + 1} · ${COUNTDOWN_SECONDS} sec timer`}
            </div>
          </div>
        </div>

        <aside className="camera-sidebar">
          <div className="sidebar-heading">
            <span>FILTER</span>
            <span>{filter.name}</span>
          </div>

          <div className="filter-tabs" role="tablist" aria-label="Filter groups">
            {FILTER_GROUPS.map((group) => (
              <button
                type="button"
                role="tab"
                aria-selected={filterGroup === group.id}
                key={group.id}
                className={filterGroup === group.id ? "active" : ""}
                onClick={() => setFilterGroup(group.id)}
              >
                {group.label}
              </button>
            ))}
          </div>

          <div className="filter-list">
            {FILTERS.filter((item) => item.group === filterGroup).map((item) => (
              <button
                type="button"
                key={item.id}
                className={filter.id === item.id ? "filter-item active" : "filter-item"}
                onClick={() => setFilter(item)}
              >
                <span className="filter-thumb" style={{ filter: filterToCss(item) }} aria-hidden="true" />
                <span>{item.name}</span>
              </button>
            ))}
          </div>

          <div className="shot-list">
            <div className="sidebar-heading">
              <span>SHOTS</span>
              <span>
                {filled}/{slots}
              </span>
            </div>

            <div className="shot-slots">
              {Array.from({ length: slots }).map((_, index) => (
                <button
                  type="button"
                  className={`shot-slot${index === targetIndex ? " target" : ""}`}
                  key={index}
                  disabled={busy || retakeIndex !== null}
                  onClick={() => setManualTarget(photos[index] ? index : null)}
                  title={photos[index] ? `Retake shot ${index + 1}` : `Shot ${index + 1}`}
                >
                  {photos[index] ? (
                    <img src={photos[index]} alt={`Shot ${index + 1}`} />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {allDone && retakeIndex === null && (
            <button type="button" className="continue-button" onClick={handleContinue}>
              review photos →
            </button>
          )}
        </aside>
      </section>
    </main>
  );
}
