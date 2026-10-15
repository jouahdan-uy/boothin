import { Navigate, Route, Routes, useMatch } from "react-router-dom";

import Splash from "./components/Splash";
import Background from "./pages/Background";
import Camera from "./pages/Camera";
import Editor from "./pages/Editor";
import Frames from "./pages/Frames";
import Result from "./pages/Result";
import Review from "./pages/Review";
import Share from "./pages/Share";
import Welcome from "./pages/Welcome";

function App() {
  // Orang yang scan QR langsung ke foto, tidak perlu menunggu splash.
  const isShare = Boolean(useMatch("/m/:token"));

  return (
    <Splash skip={isShare}>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/frames" element={<Frames />} />
        <Route path="/camera" element={<Camera />} />
        <Route path="/review" element={<Review />} />
        <Route path="/background" element={<Background />} />
        <Route path="/editor" element={<Editor />} />
        <Route path="/result" element={<Result />} />
        <Route path="/m/:token" element={<Share />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Splash>
  );
}

export default App;
