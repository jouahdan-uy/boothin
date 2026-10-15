import { useEffect } from "react";
import { Link } from "react-router-dom";

import SiteNav from "../components/SiteNav";
import { useBooth } from "../state/boothContext";

export default function Welcome() {
  const { reset } = useBooth();

  // Home = awal flow baru: buang foto/stiker dari sesi sebelumnya.
  useEffect(() => {
    reset();
  }, [reset]);

  return (
    <main className="welcome-page">
      <header className="welcome-header">
        <div className="brand">boothin'</div>
        <SiteNav />
      </header>

      <section className="welcome-content">
        <div className="photo-card">
          <div className="photo-card-inner">
            <span>your little</span>
            <strong>moment</strong>
            <span>starts here.</span>
          </div>

          <div className="photo-card-label">
            boothin' no. 01
          </div>
        </div>

        <div className="welcome-copy">
          <p className="eyebrow">WELCOME TO THE BOOTH</p>

          <h1>boothin'</h1>

          <p className="tagline">
            a tiny booth for big little moments.
          </p>

          <Link to="/frames" className="start-button">
            let's take a photo
            <span>→</span>
          </Link>
        </div>
      </section>

      <footer className="welcome-footer">
        <span>✦ keep the moment</span>
        <span>digital photobooth</span>
        <span>by zzuhdamn · 2026</span>
      </footer>
    </main>
  );
}