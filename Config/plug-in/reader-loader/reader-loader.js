(() => {
    const loader = document.getElementById("reader-loader");
    if (!loader) return;

    const params = new URLSearchParams(window.location.search);
    const postId = params.get("id");
    const aiLoader = document.getElementById("ai-loader");

    const renderIcons = () => {
        if (window.lucide && typeof window.lucide.createIcons === "function") {
            window.lucide.createIcons();
        }
    };

    const progressValue = loader.querySelector(".reader-progress-value");
    const saveButton = loader.querySelector(".save-progress");
    const clearButton = loader.querySelector(".clear-progress");
    const doneButton = loader.querySelector(".read-done");

    const getCurrentMode = () => {
        const mode = aiLoader?.dataset.mode || "all";

        return ["all", "a", "h", "p"].includes(mode)
            ? mode
            : "all";
    };

    const modeLabel = {
        a: "𝓐",
        h: "𝓗",
        p: "𝓟",
        all: "𝓐×𝓗×𝓟"
    };

    const getScrollProgress = () => {
        const scrollTop =
            window.scrollY ||
            document.documentElement.scrollTop ||
            0;

        const pageHeight = Math.max(
            document.documentElement.scrollHeight,
            document.body ? document.body.scrollHeight : 0
        );

        const scrollable = Math.max(
            0,
            pageHeight - window.innerHeight
        );

        if (scrollable <= 0) return 0;

        return Math.round(
            (scrollTop / scrollable) * 100
        );
    };

    const getScrollRatio = () => {
        const scrollTop =
            window.scrollY ||
            document.documentElement.scrollTop ||
            0;

        const pageHeight = Math.max(
            document.documentElement.scrollHeight,
            document.body ? document.body.scrollHeight : 0
        );

        const scrollable = Math.max(
            0,
            pageHeight - window.innerHeight
        );

        if (scrollable <= 0) return 0;

        return Math.max(
            0,
            Math.min(1, scrollTop / scrollable)
        );
    };

    const updateProgress = () => {
        if (!progressValue) return;

        progressValue.textContent =
            `${Math.max(0, Math.min(100, getScrollProgress()))}%`;
    };

    const getProgressKey = (mode = getCurrentMode()) => {
        if (!postId) return null;

        return `yuri1.reader.progress.${postId}.${mode}`;
    };

    const doneKey = postId
        ? `yuri1.reader.done.${postId}`
        : null;

    let toastTimer = null;
    let toast = null;
    let autoSaveTimer = null;
    let restoreToken = 0;

    const showToast = (message) => {
        if (toast) toast.remove();

        toast = document.createElement("div");
        toast.className = "reader-state-notice post";

        toast.setAttribute("role", "status");
        toast.setAttribute("aria-live", "polite");
        toast.setAttribute("aria-atomic", "true");

        toast.textContent = `◈ ${message} ◈`;

        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add("is-visible");
        });

        clearTimeout(toastTimer);

        toastTimer = setTimeout(() => {
            if (!toast) return;

            toast.classList.remove("is-visible");

            setTimeout(() => {
                if (
                    toast &&
                    !toast.classList.contains("is-visible")
                ) {
                    toast.remove();
                    toast = null;
                }
            }, 220);
        }, 900);
    };

    window.readerToast = showToast;

    const setButtonIcon = (button, iconName) => {
        if (!button) return;

        button.replaceChildren();

        const icon = document.createElement("i");
        icon.setAttribute("data-lucide", iconName);

        button.appendChild(icon);

        renderIcons();
    };

    const isReadDone = () => {
        if (!doneKey) return false;

        return localStorage.getItem(doneKey) === "true";
    };

    const updateDoneButton = () => {
        if (!doneButton) return;

        const done = isReadDone();

        doneButton.setAttribute(
            "aria-label",
            done ? "Mark as unread" : "Mark as read"
        );

        doneButton.setAttribute(
            "title",
            done ? "Mark as unread" : "Mark as read"
        );

        setButtonIcon(
            doneButton,
            done ? "book-check" : "book-dashed"
        );

        doneButton.classList.toggle(
            "is-active",
            done
        );
    };

    const saveProgress = (showNotice = true) => {
        const mode = getCurrentMode();
        const progressKey = getProgressKey(mode);

        if (!progressKey) return;

        const ratio = getScrollRatio();
        const percent = Math.round(ratio * 100);

        localStorage.setItem(
            progressKey,
            JSON.stringify({
                ratio,
                percent,
                savedAt: Date.now()
            })
        );

        if (showNotice) {
            showToast(
                `${modeLabel[mode]} Pinned to ${percent}%`
            );
        }
    };

    // Automatic saving:
    // Save 1.5 seconds after the user stops scrolling.
    const scheduleAutoSave = () => {
        if (!postId) return;

        clearTimeout(autoSaveTimer);

        autoSaveTimer = setTimeout(() => {
            saveProgress(false);
        }, 1500);
    };

    const clearProgress = () => {
        if (!postId) return;

        clearTimeout(autoSaveTimer);

        const progressModes = ["all", "a", "h", "p"];

        const progressKeys = progressModes.map(
            mode => getProgressKey(mode)
        );

        const hasSavedProgress = progressKeys.some(
            key => key && localStorage.getItem(key)
        );

        if (!hasSavedProgress) {
            showToast("No Pinned Progress");
            return;
        }

        const confirmed = window.confirm(
            "Clear all pinned reading progress for this book?"
        );

        if (!confirmed) return;

        progressKeys.forEach(key => {
            if (key) {
                localStorage.removeItem(key);
            }
        });

        showToast("All Pinned Progress Cleared");
    };

    const getSavedRatio = (
        mode = getCurrentMode()
    ) => {
        const progressKey =
            getProgressKey(mode);

        if (!progressKey) return null;

        const raw =
            localStorage.getItem(progressKey);

        if (!raw) return null;

        try {
            const saved = JSON.parse(raw);
            const ratio = Number(saved?.ratio);

            if (!Number.isFinite(ratio)) {
                return null;
            }

            return Math.max(
                0,
                Math.min(1, ratio)
            );

        } catch (error) {
            console.warn(
                "Reader progress restore:",
                error
            );

            return null;
        }
    };

    const restoreProgress = (
        mode = getCurrentMode()
    ) => {
        const ratio = getSavedRatio(mode);

        const pageHeight = Math.max(
            document.documentElement.scrollHeight,
            document.body ? document.body.scrollHeight : 0
        );

        const scrollable = Math.max(
            0,
            pageHeight - window.innerHeight
        );

        if (
            ratio === null ||
            scrollable <= 0
        ) {
            window.scrollTo({
                top: 0,
                behavior: "auto"
            });

            updateProgress();
            return;
        }

        window.scrollTo({
            top: scrollable * ratio,
            behavior: "auto"
        });

        updateProgress();
    };

    const restoreCurrentMode = () => {
        const token = ++restoreToken;
        const mode = getCurrentMode();

        clearTimeout(autoSaveTimer);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (token !== restoreToken) return;

                restoreProgress(mode);
            });
        });
    };

    const toggleReadDone = () => {
        if (!doneKey) return;

        const done = isReadDone();

        if (done) {
            localStorage.removeItem(doneKey);
            showToast("Marked as unread");
        } else {
            localStorage.setItem(
                doneKey,
                "true"
            );

            showToast("Marked as read");
        }

        updateDoneButton();
    };

    if (saveButton) {
        saveButton.addEventListener(
            "click",
            () => saveProgress(true)
        );
    }

    if (clearButton) {
        clearButton.addEventListener(
            "click",
            clearProgress
        );
    }

    if (doneButton) {
        doneButton.addEventListener(
            "click",
            toggleReadDone
        );
    }

    // AI loader changes its data-mode whenever
    // A / H / P / ALL is selected.
    //
    // Each mode is treated as its own book
    // and therefore has its own progress.
    if (aiLoader) {
        const modeObserver =
            new MutationObserver((mutations) => {
                if (
                    mutations.some(
                        mutation =>
                            mutation.attributeName === "data-mode"
                    )
                ) {
                    restoreCurrentMode();
                }
            });

        modeObserver.observe(
            aiLoader,
            {
                attributes: true,
                attributeFilter: ["data-mode"]
            }
        );
    }

    renderIcons();
    updateDoneButton();
    updateProgress();

    if (document.readyState === "complete") {
        restoreCurrentMode();
    } else {
        window.addEventListener(
            "load",
            restoreCurrentMode,
            { once: true }
        );

        setTimeout(
            restoreCurrentMode,
            600
        );
    }

    window.addEventListener(
        "scroll",
        () => {
            updateProgress();
            scheduleAutoSave();
        },
        { passive: true }
    );

    window.addEventListener(
        "resize",
        updateProgress
    );
})();