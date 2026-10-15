import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import "./index.css";
import { BoothProvider } from "./state/BoothProvider";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <BoothProvider>
        <App />
      </BoothProvider>
    </BrowserRouter>
  </React.StrictMode>
);
