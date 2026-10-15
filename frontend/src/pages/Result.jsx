import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError, createQr, createSession, sendEmail } from "../api.js";
import { composeFinal } from "../engine/compositor.js";
import { getGeometry } from "../engine/layouts.js";
import { useBooth } from "../state/boothContext";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function errorMessage(error, fallback) {
  return error instanceof ApiError ? error.message : fallback;
}

function formatExpiry(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
}

export default function Result() {
  const navigate = useNavigate();
  const { frame, photos, stickers, isComplete, reset } = useBooth();

  const blobRef = useRef(null);
  const sessionRef = useRef(null);
  const printRef = useRef(null);
  // reset() mengosongkan frame; tanpa penanda ini guard di bawah akan me-redirect ke /frames
  // dan menimpa navigasi "back to home".
  const leaving = useRef(false);

  const [blobUrl, setBlobUrl] = useState("");
  const [status, setStatus] = useState("generating"); // generating | ready | error
  const [attempt, setAttempt] = useState(0);

  const [panel, setPanel] = useState(null); // null | "qr" | "email"
  const [qr, setQr] = useState({ state: "idle", svg: "", url: "", expiresAt: "", message: "" });
  const [email, setEmail] = useState("");
  const [mail, setMail] = useState({ state: "idle", message: "" });

  useEffect(() => {
    if (leaving.current) return;
    if (!frame) navigate("/frames", { replace: true });
    else if (!isComplete) navigate("/camera", { replace: true });
  }, [frame, isComplete, navigate]);

  /* ---------- susun foto final ---------- */

  useEffect(() => {
    if (!frame || !isComplete) return undefined;

    let cancelled = false;
    let objectUrl = "";

    setStatus("generating");
    sessionRef.current = null; // foto baru -> sesi lama tidak berlaku
    setQr({ state: "idle", svg: "", url: "", expiresAt: "", message: "" });

    composeFinal({ frame, photos, stickers })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        blobRef.current = blob;
        setBlobUrl(objectUrl);
        setStatus("ready");
      })
      .catch((error) => {
        console.error("FINAL IMAGE ERROR:", error);
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [frame, photos, stickers, isComplete, attempt]);

  /* ---------- upload sementara (hanya kalau user butuh QR / email) ---------- */

  async function ensureSession() {
    const cached = sessionRef.current;
    if (cached && new Date(cached.expiresAt).getTime() - Date.now() > 60_000) return cached;

    const created = await createSession(blobRef.current);
    sessionRef.current = created;
    return created;
  }

  /** Jalankan aksi dengan sesi; kalau server sudah melupakan sesi (restart/expired), upload ulang sekali. */
  async function withSession(action) {
    try {
      return await action(await ensureSession());
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        sessionRef.current = null;
        return action(await ensureSession());
      }
      throw error;
    }
  }

  async function loadQr() {
    setQr((current) => ({ ...current, state: "loading", message: "" }));

    try {
      const result = await withSession((session) => createQr(session.token));
      setQr({ state: "ready", svg: result.svg, url: result.url, expiresAt: result.expiresAt, message: "" });
    } catch (error) {
      setQr((current) => ({
        ...current,
        state: "error",
        message: errorMessage(error, "QR gagal dibuat. Coba lagi."),
      }));
    }
  }

  function handleQr() {
    if (panel === "qr") {
      setPanel(null);
      return;
    }
    setPanel("qr");
    if (qr.state !== "ready") loadQr();
  }

  function handleEmailToggle() {
    setPanel((current) => (current === "email" ? null : "email"));
    setMail({ state: "idle", message: "" });
  }

  async function handleSendEmail(event) {
    event.preventDefault();

    const address = email.trim();
    if (!EMAIL_PATTERN.test(address)) {
      setMail({ state: "error", message: "Alamat email belum valid." });
      return;
    }

    setMail({ state: "sending", message: "" });

    try {
      await withSession((session) => sendEmail(session.token, address));
      setMail({ state: "sent", message: `Terkirim ke ${address}. Cek inbox (dan folder spam).` });
    } catch (error) {
      setMail({ state: "error", message: errorMessage(error, "Email gagal dikirim. Coba lagi.") });
    }
  }

  /* ---------- download & print ---------- */

  function handleDownload() {
    if (!blobUrl) return;

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `boothin-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function handlePrint() {
    try {
      await printRef.current?.decode?.();
    } catch {
      /* gambar tetap bisa dicetak */
    }
    window.print();
  }

  function handleRestart() {
    leaving.current = true;
    reset();
    navigate("/");
  }

  if (!frame || !isComplete) return null;

  const ratio = getGeometry(frame).ratio;
  const ready = status === "ready";

  return (
    <main className="result-page">
      <header className="result-header">
        <button type="button" className="result-back" onClick={() => navigate("/editor")}>
          ← edit
        </button>

        <div className="result-brand">boothin'</div>

        <span className="result-step">STEP 05 / DONE</span>
      </header>

      <section className="result-content">
        <div className="result-copy">
          <p className="eyebrow">YOUR LITTLE MOMENT</p>

          <h1>
            your photo
            <br />
            <em>is ready. ♡</em>
          </h1>

          <p>Download it, send it somewhere special, or scan it straight to your phone.</p>
        </div>

        <div className="result-preview" style={{ "--ratio": ratio.toFixed(5) }}>
          {status === "generating" && (
            <div className="result-loading">
              <span>✦</span>
              <p>developing your moment...</p>
            </div>
          )}

          {status === "error" && (
            <div className="result-error">
              <p>Foto final gagal dibuat.</p>
              <button type="button" onClick={() => setAttempt((value) => value + 1)}>
                try again
              </button>
              <button type="button" onClick={() => navigate("/editor")}>
                back to editor
              </button>
            </div>
          )}

          {ready && <img src={blobUrl} alt="Final boothin photo" />}
        </div>

        <div className="result-actions">
          <button type="button" className="result-download" onClick={handleDownload} disabled={!ready}>
            ↓ download JPG
          </button>

          <div className="result-secondary-actions">
            <button type="button" onClick={handleQr} disabled={!ready} aria-expanded={panel === "qr"}>
              ▦ get QR
            </button>
            <button type="button" onClick={handleEmailToggle} disabled={!ready} aria-expanded={panel === "email"}>
              ✉ send to mail
            </button>
            <button type="button" onClick={handlePrint} disabled={!ready}>
              🖨 print photo
            </button>
          </div>

          {panel === "qr" && (
            <div className="result-panel" aria-live="polite">
              {qr.state === "loading" && <p className="panel-note">making your QR...</p>}

              {qr.state === "error" && (
                <>
                  <p className="panel-note error">{qr.message}</p>
                  <button type="button" className="panel-button" onClick={loadQr}>
                    try again
                  </button>
                </>
              )}

              {qr.state === "ready" && (
                <>
                  <img
                    className="qr-image"
                    alt="QR code to open your photo"
                    src={`data:image/svg+xml;utf8,${encodeURIComponent(qr.svg)}`}
                  />
                  <p className="panel-note">Scan with your phone to open &amp; save the photo.</p>
                  <p className="panel-note small">Link expires {formatExpiry(qr.expiresAt)}</p>
                </>
              )}
            </div>
          )}

          {panel === "email" && (
            <form className="result-panel" onSubmit={handleSendEmail} noValidate>
              <label htmlFor="mail-to">YOUR EMAIL</label>
              <input
                id="mail-to"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                disabled={mail.state === "sending"}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (mail.state !== "idle") setMail({ state: "idle", message: "" });
                }}
              />

              <button type="submit" className="panel-button" disabled={mail.state === "sending" || !email.trim()}>
                {mail.state === "sending" ? "sending..." : "send →"}
              </button>

              {mail.message && (
                <p className={`panel-note ${mail.state === "error" ? "error" : ""}`} role="status">
                  {mail.message}
                </p>
              )}
            </form>
          )}

          <button type="button" className="result-restart" onClick={handleRestart}>
            ← back to home
          </button>
        </div>
      </section>

      {/* Hanya tampil saat window.print(): lihat @media print di index.css */}
      {ready && <img ref={printRef} className="print-sheet" src={blobUrl} alt="" />}
    </main>
  );
}
