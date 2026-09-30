(() => {
    "use strict";

    /*
     * YURI1 Cookie / Privacy Consent
     *
     * The only optional consent currently managed here is Google Analytics.
     * Essential site functions and local reading data remain available.
     *
     * Consent is stored locally in the browser and is not sent to YURI1.
     */

    const STORAGE_KEY = "yuri1.cookieConsent";
    const GA_MEASUREMENT_ID = "G-N5579QC33B";
    const GA_SCRIPT_ID = "yuri1-gtag-script";

    let banner = null;
    let detailBackdrop = null;

    function readConsent() {
        try {
            const value = localStorage.getItem(STORAGE_KEY);
            return value === "granted" || value === "denied" ? value : null;
        } catch (_) {
            return null;
        }
    }

    function writeConsent(value) {
        try {
            localStorage.setItem(STORAGE_KEY, value);
        } catch (_) {
            // The site should still work when browser storage is unavailable.
        }
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }

    function loadScript(src, id) {
        return new Promise((resolve, reject) => {
            if (document.getElementById(id)) {
                resolve();
                return;
            }

            const script = document.createElement("script");
            script.id = id;
            script.async = true;
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Google Analytics script failed to load."));
            document.head.appendChild(script);
        });
    }

    function isPostPage() {
        return Boolean(document.getElementById("post-loader"));
    }

    function enableGoogleAnalyticsWhenReady() {
        // Post.html loads its article title from JSON. Wait until post-loader
        // has replaced the fallback <title> so GA records the real post title.
        if (!isPostPage() || window.__YURI1_POST_ANALYTICS_READY) {
            enableGoogleAnalytics();
            return;
        }

        if (window.__YURI1_GA_WAITING_FOR_POST) return;
        window.__YURI1_GA_WAITING_FOR_POST = true;

        window.addEventListener("yuri1:post-ready", () => {
            window.__YURI1_GA_WAITING_FOR_POST = false;
            enableGoogleAnalytics();
        }, { once: true });
    }

    async function enableGoogleAnalytics() {
        if (window.__YURI1_GA_ENABLED) return;
        window.__YURI1_GA_ENABLED = true;

        window.dataLayer = window.dataLayer || [];
        window.gtag = window.gtag || function () {
            window.dataLayer.push(arguments);
        };

        window.gtag("js", new Date());
        window.gtag("config", GA_MEASUREMENT_ID);

        try {
            await loadScript(
                `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`,
                GA_SCRIPT_ID
            );
        } catch (error) {
            console.error("YURI1 Google Analytics:", error);
            return;
        }

    }

    function setChoice(value) {
        writeConsent(value);

        if (value === "granted") {
            // Enable only standard Google Analytics collection.
            // No site-specific reader-time or mode tracking is loaded here.
            enableGoogleAnalyticsWhenReady();
        }

        removeBanner();
        closeDetails();
    }

    function removeBanner() {
        if (banner) {
            banner.remove();
            banner = null;
        }
    }

    function closeDetails() {
        if (detailBackdrop) {
            detailBackdrop.remove();
            detailBackdrop = null;
        }
    }

    function buildBanner() {
        const el = document.createElement("aside");
        el.className = "yuri1-cookie-banner";
        el.setAttribute("role", "region");
        el.setAttribute("aria-label", "Cookie settings");
        el.innerHTML = `
            <div class="yuri1-cookie-banner-inner">
                <div class="yuri1-cookie-banner-copy">
                    <div>YURI1 uses cookies and local browser storage for essential site functions.</div>
                    <div class="yuri1-cookie-banner-analytics">Google Analytics is optional and may be used to record website views and usage, helping us understand how the website is used and improve the user experience.</div>
                </div>
                <div class="yuri1-cookie-banner-actions">
                    <button type="button" class="yuri1-cookie-details" data-cookie-details>Details</button>
                    <button type="button" class="yuri1-cookie-choice" data-cookie-reject>Reject</button>
                    <button type="button" class="yuri1-cookie-choice" data-cookie-agree>Agree</button>
                </div>
            </div>
        `;
        document.body.appendChild(el);

        el.querySelector("[data-cookie-details]").addEventListener("click", showDetails);
        el.querySelector("[data-cookie-reject]").addEventListener("click", () => setChoice("denied"));
        el.querySelector("[data-cookie-agree]").addEventListener("click", () => setChoice("granted"));

        return el;
    }

    function showDetails() {
        if (detailBackdrop) return;

        const backdrop = document.createElement("div");
        backdrop.className = "yuri1-cookie-detail-backdrop";
        backdrop.setAttribute("role", "presentation");

        const dialog = document.createElement("section");
        dialog.className = "yuri1-cookie-detail";
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-modal", "true");
        dialog.setAttribute("aria-labelledby", "yuri1-cookie-detail-title");

        dialog.innerHTML = `
            <button type="button" class="yuri1-cookie-close" aria-label="Close details" title="Close">×</button>
            <h2 id="yuri1-cookie-detail-title">Cookie Settings</h2>
            <div class="yuri1-cookie-detail-scroll">
                <section class="yuri1-cookie-row">
                    <div class="yuri1-cookie-row-head">
                        <h3>1. Essential Site Functions</h3>
                        <span class="yuri1-cookie-status">Always On</span>
                    </div>
                    <p>These browser settings are required for basic website functions. They are not used for website analytics or advertising.</p>
                </section>

                <section class="yuri1-cookie-row">
                    <div class="yuri1-cookie-row-head">
                        <h3>2. Local Reading Data</h3>
                        <span class="yuri1-cookie-status">Local Only</span>
                    </div>
                    <p>Your reading progress, favorites, read status, and personal reading settings are stored locally in your browser. YURI1 does not collect or store this reading data on its servers.</p>
                </section>

                <section class="yuri1-cookie-row">
                    <div class="yuri1-cookie-row-head">
                        <h3>3. Accounts &amp; Personal Information</h3>
                        <span class="yuri1-cookie-status">Not Used</span>
                    </div>
                    <p>YURI1 currently does not provide member accounts, member login, or forms for submitting personal information.</p>
                </section>

                <section class="yuri1-cookie-row yuri1-cookie-analytics-row">
                    <div class="yuri1-cookie-row-head">
                        <h3>4. Google Analytics</h3>
                        <span class="yuri1-cookie-status yuri1-cookie-analytics-status">Optional</span>
                    </div>
                    <p>Do you agree to use cookies to record website views and usage, helping us understand how the website is used and improve the user experience?</p>
                </section>
            </div>
            <div class="yuri1-cookie-detail-actions">
                <button type="button" class="yuri1-cookie-choice" data-cookie-detail-reject>Reject</button>
                <button type="button" class="yuri1-cookie-choice" data-cookie-detail-agree>Agree</button>
            </div>
        `;

        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);
        detailBackdrop = backdrop;

        dialog.querySelector(".yuri1-cookie-close").addEventListener("click", closeDetails);
        dialog.querySelector("[data-cookie-detail-reject]").addEventListener("click", () => setChoice("denied"));
        dialog.querySelector("[data-cookie-detail-agree]").addEventListener("click", () => setChoice("granted"));

        const closeOnEscape = event => {
            if (event.key === "Escape" && detailBackdrop === backdrop) {
                closeDetails();
            }
        };
        backdrop._yuri1EscapeHandler = closeOnEscape;
        document.addEventListener("keydown", closeOnEscape);

        const originalRemove = backdrop.remove.bind(backdrop);
        backdrop.remove = () => {
            document.removeEventListener("keydown", closeOnEscape);
            originalRemove();
        };

        dialog.querySelector(".yuri1-cookie-close").focus();
    }

    function openSettings(options = {}) {
        const keepBanner = options.keepBanner !== false;

        if (keepBanner && !banner) {
            banner = buildBanner();
        }

        showDetails();
    }

    window.YURI1CookieConsent = {
        openSettings
    };

    function init() {
        const consent = readConsent();
        const url = new URL(window.location.href);
        const forceSettings = url.searchParams.get("cookie-settings") === "1";

        if (forceSettings) {
            url.searchParams.delete("cookie-settings");
            window.history.replaceState(
                {},
                "",
                url.pathname + (url.search ? `?${url.searchParams.toString()}` : "") + url.hash
            );

            if (consent === "granted") {
                enableGoogleAnalyticsWhenReady();
            }

            openSettings({ keepBanner: true });
            return;
        }

        if (consent === "granted") {
            enableGoogleAnalyticsWhenReady();
            return;
        }

        if (consent === "denied") return;

        banner = buildBanner();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
