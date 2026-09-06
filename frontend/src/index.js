import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/index.css";
import App from "@/App";

// ---------------------------------------------------------------------------
// React + Google Translate DOM-mutation safety patch.
// Google Translate replaces text nodes with <font> wrappers, which causes React
// to throw "NotFoundError: Failed to execute 'removeChild'/'insertBefore' on 'Node'"
// when it later re-renders. We make these two Node prototypes defensive.
// See: https://github.com/facebook/react/issues/11538
// ---------------------------------------------------------------------------
if (typeof Node === "function" && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function patchedRemoveChild(child) {
    if (child && child.parentNode !== this) {
      if (child.parentNode) {
        try { return child.parentNode.removeChild(child); } catch (_) { /* noop */ }
      }
      return child;
    }
    return originalRemoveChild.apply(this, arguments);
  };
  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function patchedInsertBefore(newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) {
      try { return this.appendChild(newNode); } catch (_) { return newNode; }
    }
    return originalInsertBefore.apply(this, arguments);
  };
}

function isBenignResizeObserverError(message = "") {
  return /ResizeObserver loop (completed with undelivered notifications|limit exceeded)/i.test(
    String(message),
  );
}

window.addEventListener(
  "error",
  (event) => {
    const text = event?.message || event?.error?.message || "";
    if (isBenignResizeObserverError(text)) {
      event.stopImmediatePropagation();
      event.preventDefault();
      return false;
    }
  },
  true,
);

window.addEventListener("unhandledrejection", (event) => {
  const message = event.reason?.message || event.reason || "";
  if (isBenignResizeObserverError(message)) {
    event.preventDefault();
  }
});

// CRA dev-overlay also injects an iframe that listens directly. Hide it
// when the error inside is a ResizeObserver loop (it's a harmless browser warning).
if (process.env.NODE_ENV !== "production") {
  const hideOverlayIfBenign = () => {
    document.querySelectorAll("body > iframe").forEach((iframe) => {
      try {
        const txt = iframe.contentDocument?.body?.innerText || "";
        if (isBenignResizeObserverError(txt)) iframe.style.display = "none";
      } catch (_) { /* cross-origin – ignore */ }
    });
  };
  const obs = new MutationObserver(hideOverlayIfBenign);
  obs.observe(document.body, { childList: true, subtree: true });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  // NOTE: StrictMode intentionally OFF — its double-render breaks Google
  // Translate's <font> wrappers (causes removeChild errors on the 2nd render).
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
);
