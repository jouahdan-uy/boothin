import { useEffect, useState } from "react";

const SEEN_KEY = "boothin:splash-seen";
const MIN_MS = 1100;

function alreadySeen() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Layar loading pembuka (langkah 02 di flow). Hanya muncul sekali per sesi tab,
 * menunggu font siap supaya halaman pertama tidak "meloncat".
 */
export default function Splash({ children, skip = false }) {
  const [ready, setReady] = useState(() => skip || alreadySeen());

  useEffect(() => {
    if (ready) return undefined;

    let cancelled = false;
    const minimum = new Promise((resolve) => setTimeout(resolve, MIN_MS));
    const fonts = document.fonts?.ready ?? Promise.resolve();
    // Jangan menunggu font selamanya kalau jaringan lambat.
    const fontsOrTimeout = Promise.race([fonts, new Promise((resolve) => setTimeout(resolve, 2500))]);

    Promise.all([minimum, fontsOrTimeout]).then(() => {
      if (cancelled) return;
      try {
        sessionStorage.setItem(SEEN_KEY, "1");
      } catch {
        /* storage diblokir: tidak masalah */
      }
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [ready]);

  if (ready) return children;

  return (
    <main className="splash" aria-busy="true" aria-label="Loading boothin'">
      <div className="splash-card">
        <img className="splash-icon" src="/icon-192.png" alt="" width="84" height="84" />
        <div className="splash-brand">boothin'</div>
        <div className="splash-bar">
          <span />
        </div>
        <p>loading little moments...</p>
      </div>
    </main>
  );
}
