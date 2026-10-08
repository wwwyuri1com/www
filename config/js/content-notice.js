(() => {
    "use strict";

    // This notice is intentionally loaded only by post.html.
    // Acknowledgement remains valid for 3 days, then the notice appears again.
    const STORAGE_KEY = "yuri1.contentNoticeAcknowledgedAt";
    const VALIDITY_MS = 3 * 24 * 60 * 60 * 1000;

    function isAcknowledged() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return false;

            const timestamp = Number(raw);
            if (!Number.isFinite(timestamp) || timestamp <= 0) {
                localStorage.removeItem(STORAGE_KEY);
                return false;
            }

            const valid = Date.now() - timestamp < VALIDITY_MS;
            if (!valid) localStorage.removeItem(STORAGE_KEY);
            return valid;
        } catch (_) {
            // If storage is unavailable, the notice is shown for the current visit.
            return false;
        }
    }

    function acknowledge() {
        try {
            localStorage.setItem(STORAGE_KEY, String(Date.now()));
        } catch (_) {
            // Storage may be blocked; the notice can still be dismissed for this page.
        }
    }

    function removeNotice(backdrop) {
        backdrop.remove();
    }

    function showNotice() {
        const backdrop = document.createElement("div");
        backdrop.className = "yuri1-content-notice-backdrop";
        backdrop.setAttribute("role", "presentation");

        const dialog = document.createElement("section");
        dialog.className = "yuri1-content-notice";
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-modal", "true");
        dialog.setAttribute("aria-labelledby", "yuri1-content-notice-title");

        dialog.innerHTML = `
            <h2 id="yuri1-content-notice-title">YURI1 — Content Notice</h2>
            <p>This website contains fictional girls' love novels that may include mature romantic themes, intimate or suggestive situations, dramatic relationship dynamics, and depictions with a more mature level of intimacy.</p>
            <p>All content is recommended for a 16+ audience.</p>
            <div class="notice-actions">
                <button type="button" id="yuri1-content-notice-enter">Continue</button>
            </div>
        `;

        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);

        const button = dialog.querySelector("#yuri1-content-notice-enter");
        button.addEventListener("click", () => {
            acknowledge();
            removeNotice(backdrop);
        });

        button.focus();
    }

    function shouldForceShow() {
        try {
            const params = new URLSearchParams(window.location.search);
            return params.get("content-notice") === "1";
        } catch (_) {
            return false;
        }
    }

    function init() {
        // Explicit manual link: show the notice even when the 3-day
        // acknowledgement is still valid. This is used by Content Rating Guide.
        if (shouldForceShow()) {
            showNotice();
            return;
        }

        if (isAcknowledged()) return;
        showNotice();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
