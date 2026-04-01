import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import QuizPage from "./QuizPage";
import VariantRedirect from "./VariantRedirect";
import CookieConsent from "./CookieConsent";
import { initConsent } from "./consent";
import { applyBrandTheme } from "./theme";
import { VARIANTS } from "./campaign.config";

// Apply brand theme (colours, fonts) before first render
applyBrandTheme();

// Boot scripts for returning visitors who already consented
initConsent();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<VariantRedirect />} />
        {VARIANTS.map((v) => (
          <Route key={v} path={`/${v}`} element={<QuizPage variant={v} />} />
        ))}
      </Routes>
      <CookieConsent />
    </BrowserRouter>
  </React.StrictMode>
);
