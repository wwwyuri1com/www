(() => {
    "use strict";

    /*
     * YURI1 Google Analytics helpers
     *
     * Custom reader metrics:
     *   - yuri_read_time  : active reading time by AI / HDraft / Prompt / All
     *   - yuri_dark_time  : active reading time while reader dark mode is on
     *
     * "Active" means:
     *   - the tab is visible, and
     *   - the user has interacted within the last 3 minutes.
     *
     * After 3 minutes without interaction, timing pauses.
     * Pointer, touch, keyboard, wheel, or scroll activity resumes timing.
     */

    const IDLE_TIMEOUT_MS = 3 * 60 * 1000;
    const HEARTBEAT_MS = 60 * 1000;
    const GA_EVENT_RETRY_MS = 1000;

    const hasGtag = () => typeof window.gtag === "function";

    const sendEvent = (name, params) => {
        if (!hasGtag()) {
            // gtag.js is normally available by the time this deferred file runs.
            // Keep a tiny retry window so the first custom event is not lost if
            // the network-loaded Google script is a little slower.
            window.setTimeout(() => {
                if (hasGtag()) window.gtag("event", name, params);
            }, GA_EVENT_RETRY_MS);
            return;
        }

        window.gtag("event", name, params);
    };

    const getPostId = () => {
        const params = new URLSearchParams(window.location.search);
        return params.get("id") || "";
    };

    const getPostTitle = () => {
        const title = document.title || "";
        return title.slice(0, 100);
    };

    const getReaderMode = () => {
        const loader = document.getElementById("ai-loader");
        const mode = loader?.dataset.mode || "a";
        return ["all", "a", "h", "p"].includes(mode) ? mode : "a";
    };

    const modeLabel = {
        all: "all",
        a: "AI",
        h: "HDraft",
        p: "Prompt"
    };

    const isDarkMode = () =>
        document.body.classList.contains("reader-dark") ||
        localStorage.getItem("yuri1.reader.dark-mode") === "1";

    const state = {
        lastActivityAt: Date.now(),
        lastTickAt: Date.now(),
        idle: document.visibilityState !== "visible",
        mode: getReaderMode(),
        dark: isDarkMode(),
        modeSeconds: 0,
        darkSeconds: 0,
        lastModeEventSeconds: 0,
        lastDarkEventSeconds: 0
    };

    const contentId = getPostId();

    const commonParams = () => ({
        content_id: contentId || undefined,
        page_title: getPostTitle()
    });

    const flushModeTime = (force = false) => {
        const seconds = Math.floor(state.modeSeconds);
        if (!force && seconds < 1) return;

        // Send only the new amount since the previous report.
        const delta = seconds - state.lastModeEventSeconds;
        if (delta < 1) return;

        sendEvent("yuri_read_time", {
            ...commonParams(),
            mode: state.mode,
            mode_label: modeLabel[state.mode],
            active_seconds: delta
        });

        state.lastModeEventSeconds = seconds;
    };

    const flushDarkTime = (force = false) => {
        const seconds = Math.floor(state.darkSeconds);
        if (!force && seconds < 1) return;

        const delta = seconds - state.lastDarkEventSeconds;
        if (delta < 1) return;

        sendEvent("yuri_dark_time", {
            ...commonParams(),
            active_seconds: delta
        });

        state.lastDarkEventSeconds = seconds;
    };

    const flushAll = (force = false) => {
        flushModeTime(force);
        flushDarkTime(force);
    };

    const setActivity = () => {
        const now = Date.now();
        state.lastActivityAt = now;

        if (document.visibilityState === "visible") {
            state.idle = false;
        }
    };

    const switchMode = (nextMode) => {
        if (!nextMode || nextMode === state.mode) return;

        flushModeTime(true);
        state.mode = nextMode;
        state.modeSeconds = 0;
        state.lastModeEventSeconds = 0;
        setActivity();
    };

    const syncDarkMode = () => {
        const nextDark = isDarkMode();
        if (nextDark === state.dark) return;

        flushDarkTime(true);
        state.dark = nextDark;
        state.darkSeconds = 0;
        state.lastDarkEventSeconds = 0;
        setActivity();
    };

    const tick = () => {
        const now = Date.now();
        const elapsed = Math.max(0, now - state.lastTickAt);
        state.lastTickAt = now;

        if (document.visibilityState !== "visible") {
            state.idle = true;
            return;
        }

        if (now - state.lastActivityAt >= IDLE_TIMEOUT_MS) {
            if (!state.idle) {
                // Count only until the exact 3-minute inactivity boundary.
                // This avoids counting the portion of the current interval that
                // happened after the user had already gone idle.
                const activeEnd = Math.min(
                    now,
                    state.lastActivityAt + IDLE_TIMEOUT_MS
                );
                const activeMs = Math.max(
                    0,
                    activeEnd - state.lastTickAt
                );

                state.modeSeconds += activeMs / 1000;
                if (state.dark) state.darkSeconds += activeMs / 1000;
                flushAll(true);
            }
            state.idle = true;
            return;
        }

        if (state.idle) return;

        state.modeSeconds += elapsed / 1000;
        if (state.dark) state.darkSeconds += elapsed / 1000;
    };

    const handleVisibilityChange = () => {
        if (document.visibilityState === "hidden") {
            tick();
            state.idle = true;
            flushAll(true);
            return;
        }

        state.lastActivityAt = Date.now();
        state.lastTickAt = Date.now();
        state.idle = false;
    };

    const activityEvents = [
        "pointerdown",
        "keydown",
        "touchstart",
        "wheel",
        "scroll"
    ];

    activityEvents.forEach(eventName => {
        window.addEventListener(eventName, setActivity, {
            passive: true,
            capture: true
        });
    });

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Detect the AI / HDraft / Prompt / All switch without modifying the reader.
    const aiLoader = document.getElementById("ai-loader");
    if (aiLoader) {
        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                if (mutation.type === "attributes" && mutation.attributeName === "data-mode") {
                    switchMode(getReaderMode());
                    break;
                }
            }
        });

        observer.observe(aiLoader, {
            attributes: true,
            attributeFilter: ["data-mode"]
        });
    }

    // Detect the existing reader's dark-mode class without modifying its logic.
    const bodyObserver = new MutationObserver(() => syncDarkMode());
    bodyObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ["class"]
    });

    window.setInterval(() => {
        tick();
        syncDarkMode();
        flushModeTime(false);
        flushDarkTime(false);
    }, HEARTBEAT_MS);

    window.addEventListener("pagehide", () => {
        tick();
        flushAll(true);
    });

    // Initial state may be loaded after this file on very early page timing.
    window.setTimeout(() => {
        state.mode = getReaderMode();
        state.dark = isDarkMode();
        state.lastActivityAt = Date.now();
        state.lastTickAt = Date.now();
    }, 0);
})();
