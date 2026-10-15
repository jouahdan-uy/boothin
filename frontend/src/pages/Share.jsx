import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getSession, photoUrl } from "../api.js";
import SiteNav from "../components/SiteNav";

function formatExpiry(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
}

/** Tujuan QR / link email: /m/:token. Menampilkan foto sementara + tombol simpan. */
export default function Share() {
  const { token } = useParams();
  const [state, setState] = useState({ status: "loading", session: null, message: "" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", session: null, message: "" });

    getSession(token)
      .then((session) => {
        if (!cancelled) setState({ status: "ready", session, message: "" });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          status: error?.status === 404 ? "gone" : "error",
          session: null,
          message: error?.message ?? "",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="share-page">
      <header className="share-header">
        <div className="brand">boothin'</div>
        <SiteNav />
      </header>

      <section className="share-content">
        {state.status === "loading" && <p className="share-note">opening your moment...</p>}

        {state.status === "gone" && (
          <div className="share-gone">
            <h1>this moment has expired.</h1>
            <p>Photos on boothin' are kept only for a little while, then deleted.</p>
          </div>
        )}

        {state.status === "error" && (
          <div className="share-gone">
            <h1>something went wrong.</h1>
            <p>{state.message || "Could not load the photo. Try again in a moment."}</p>
          </div>
        )}

        {state.status === "ready" && (
          <>
            <img
              className="share-photo"
              src={photoUrl(token)}
              alt="Your boothin photo"
              onError={() => setState({ status: "gone", session: null, message: "" })}
            />

            <a className="start-button share-download" href={photoUrl(token, { download: true })} download>
              download photo <span>↓</span>
            </a>

            <p className="share-note">Available until {formatExpiry(state.session.expiresAt)}</p>
          </>
        )}

        <Link to="/" className="share-home">
          make your own →
        </Link>
      </section>
    </main>
  );
}
