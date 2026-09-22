(() => {
    const initDataBackupUI = () => {
        // Backup controls intentionally live in Codex only.
        const isCodexPage = /(^|\/)Codex\.html$/i.test(
            window.location.pathname
        );

        if (!isCodexPage) return;

        const actions = document.querySelectorAll(
            '[data-reader-data-action]'
        );

        const modal = document.getElementById(
            'reader-data-modal'
        );

        const title = document.getElementById(
            'reader-data-modal-title'
        );

        const body = document.getElementById(
            'reader-data-modal-body'
        );

        const time = document.getElementById(
            'reader-data-modal-time'
        );

        const preview = document.getElementById(
            'reader-data-modal-preview'
        );

        if (
            !actions.length ||
            !modal ||
            !title ||
            !body ||
            !time
        ) {
            return;
        }

        const BACKUP_VERSION = 1;
        const BACKUP_SCOPE_PREFIXES = [
            'yuri1.reader.',
            'yuri1.codex.'
        ];

        let defaultCoverPromise = null;

        const stampNow = () =>
            new Date().toLocaleString([], {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

        const fileStamp = () => {
            const now = new Date();

            const pad = value =>
                String(value).padStart(2, '0');

            return [
                now.getFullYear(),
                pad(now.getMonth() + 1),
                pad(now.getDate()),
                '_',
                pad(now.getHours()),
                pad(now.getMinutes()),
                pad(now.getSeconds())
            ].join('');
        };

        const getStoredBackupCover = () => {
            if (!window.YURI1BackupCover?.get) {
                return null;
            }

            return window.YURI1BackupCover.get();
        };

        const getNumericIdOrder = postId => {
            const match = String(postId).match(
                /^\d{8}-(\d+)/
            );

            return match
                ? Number(match[1])
                : -1;
        };

        const getDefaultBackupCover = async () => {
            if (defaultCoverPromise) {
                return defaultCoverPromise;
            }

            defaultCoverPromise = (async () => {
                try {
                    const response = await fetch(
                        'Codex-W/W-Catalog.json'
                    );

                    if (!response.ok) {
                        throw new Error(
                            `W-Catalog request failed (${response.status})`
                        );
                    }

                    const data = await response.json();
                    const ids = new Set();

                    const collectPosts = node => {
                        if (!node || typeof node !== 'object') {
                            return;
                        }

                        if (Array.isArray(node.posts)) {
                            node.posts.forEach(postId => {
                                if (postId) ids.add(String(postId));
                            });
                        }

                        if (
                            node.children &&
                            typeof node.children === 'object'
                        ) {
                            Object.values(node.children)
                                .forEach(collectPosts);
                        }
                    };

                    collectPosts(data?.catalogs);

                    const postData = [];

                    await Promise.all(
                        Array.from(ids).map(async postId => {
                            try {
                                const postResponse = await fetch(
                                    `Codex-Text/${encodeURIComponent(postId)}.json`
                                );

                                if (!postResponse.ok) return;

                                const post = await postResponse.json();

                                if (!post || !post.id) return;

                                postData.push({
                                    postId: String(post.id),
                                    date: String(post.date || ''),
                                    number: getNumericIdOrder(post.id)
                                });
                            } catch {
                                // Ignore missing/unreadable posts.
                            }
                        })
                    );

                    postData.sort((a, b) => {
                        if (a.date !== b.date) {
                            return b.date.localeCompare(a.date);
                        }

                        if (a.number !== b.number) {
                            return b.number - a.number;
                        }

                        return b.postId.localeCompare(a.postId);
                    });

                    const first = postData[0];

                    if (!first) return null;

                    return {
                        postId: first.postId,
                        imageNumber: 1,
                        src: window.YURI1Cover?.src
                            ? window.YURI1Cover.src(
                                first.postId,
                                1
                            )
                            : `Codex-Img/${encodeURIComponent(
                                first.postId
                            )}%20(1).jpg`,
                        isDefault: true
                    };
                } catch (error) {
                    console.warn(
                        'YURI1 default Backup Card cover:',
                        error
                    );

                    return null;
                }
            })();

            return defaultCoverPromise;
        };

        const getCurrentBackupCover = async () => {
            const stored = getStoredBackupCover();

            if (stored) {
                return {
                    ...stored,
                    isDefault: false
                };
            }

            return getDefaultBackupCover();
        };

        const closeDataModal = () => {
            modal.hidden = true;
            modal.setAttribute(
                'aria-hidden',
                'true'
            );
        };

        const showDataModal = async action => {
            const isExport = action === 'export';

            title.textContent = isExport
                ? '下載網站進度備份圖卡'
                : '匯入網站進度備份';

            body.textContent = isExport
                ? '確定要下載目前的網站進度備份圖卡嗎？'
                : '請選擇備份圖卡。\n\n注意！！匯入後將複寫目前網站進度，且無法撤銷此動作。';

            time.textContent = stampNow();

            if (preview) {
                preview.hidden = !isExport;
                preview.removeAttribute('src');
                preview.alt = '';

                if (isExport) {
                    const cover =
                        await getCurrentBackupCover();

                    if (cover) {
                        preview.src = cover.src;
                        preview.alt =
                            `Current backup cover: ${cover.postId} (${cover.imageNumber})`;
                    }
                }
            }

            modal.hidden = false;
            modal.setAttribute(
                'aria-hidden',
                'false'
            );

            return isExport;
        };

        const buildBackupData = async () => {
            const storage = {};

            for (
                let index = 0;
                index < localStorage.length;
                index += 1
            ) {
                const key = localStorage.key(index);

                if (!key) continue;

                const shouldExport =
                    BACKUP_SCOPE_PREFIXES.some(
                        prefix => key.startsWith(prefix)
                    );

                if (!shouldExport) continue;

                const value =
                    localStorage.getItem(key);

                if (value !== null) {
                    storage[key] = value;
                }
            }

            const cover =
                await getCurrentBackupCover();

            return {
                format: 'YURI1-BACKUP-CARD',
                version: BACKUP_VERSION,
                kind: 'test-json',
                createdAt: new Date().toISOString(),
                cover: cover
                    ? {
                        postId: cover.postId,
                        imageNumber: cover.imageNumber,
                        src: cover.src,
                        isDefault: Boolean(
                            cover.isDefault
                        )
                    }
                    : null,
                storage
            };
        };

        const downloadTextFile = (
            filename,
            text
        ) => {
            const blob = new Blob(
                [text],
                {
                    type: 'application/json;charset=utf-8'
                }
            );

            const url =
                URL.createObjectURL(blob);

            const link =
                document.createElement('a');

            link.href = url;
            link.download = filename;
            link.style.display = 'none';

            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 1000);
        };

        const exportBackup = async () => {
            const backup =
                await buildBackupData();

            const json =
                JSON.stringify(
                    backup,
                    null,
                    2
                );

            downloadTextFile(
                `YURI1_Backup_${fileStamp()}.json`,
                json
            );

            closeDataModal();
        };

        const isBackupObjectValid = data => {
            return Boolean(
                data &&
                data.format ===
                    'YURI1-BACKUP-CARD' &&
                Number(data.version) ===
                    BACKUP_VERSION &&
                data.storage &&
                typeof data.storage === 'object' &&
                !Array.isArray(data.storage)
            );
        };

        const showImportError = message => {
            closeDataModal();

            if (typeof window.readerToast === 'function') {
                window.readerToast(message);
                return;
            }

            window.alert(message);
        };

        const applyImportedBackup = data => {
            const incoming =
                data.storage || {};

            const incomingKeys =
                Object.keys(incoming);

            // Full overwrite of Reader/Codex user data.
            for (
                let index = localStorage.length - 1;
                index >= 0;
                index -= 1
            ) {
                const key =
                    localStorage.key(index);

                if (!key) continue;

                const shouldClear =
                    BACKUP_SCOPE_PREFIXES.some(
                        prefix => key.startsWith(prefix)
                    );

                if (shouldClear) {
                    localStorage.removeItem(key);
                }
            }

            incomingKeys.forEach(key => {
                const value = incoming[key];

                if (
                    typeof value === 'string' &&
                    BACKUP_SCOPE_PREFIXES.some(
                        prefix => key.startsWith(prefix)
                    )
                ) {
                    localStorage.setItem(
                        key,
                        value
                    );
                }
            });

            // Preserve an explicit Backup Card cover. If the exported cover
            // was the automatic newest-post default, keep the imported state
            // unpinned so the default can follow future content changes.
            const cover = data.cover;

            if (cover?.isDefault) {
                localStorage.removeItem(
                    'yuri1.reader.backup-cover'
                );
            } else if (
                cover?.postId &&
                Number.isInteger(
                    Number(cover.imageNumber)
                ) &&
                Number(cover.imageNumber) > 0
            ) {
                localStorage.setItem(
                    'yuri1.reader.backup-cover',
                    JSON.stringify({
                        postId: String(cover.postId),
                        imageNumber: Number(
                            cover.imageNumber
                        ),
                        savedAt: Date.now()
                    })
                );
            }
        };

        const chooseImportFile = () => {
            const input =
                document.createElement('input');

            input.type = 'file';
            input.accept =
                '.json,application/json,image/png,image/jpeg';
            input.style.display = 'none';

            input.addEventListener(
                'change',
                async () => {
                    const file = input.files?.[0];

                    if (!file) {
                        input.remove();
                        return;
                    }

                    try {
                        const text =
                            await file.text();

                        const data =
                            JSON.parse(text);

                        if (
                            !isBackupObjectValid(data)
                        ) {
                            throw new Error(
                                'Invalid YURI1 backup data.'
                            );
                        }

                        applyImportedBackup(data);
                        closeDataModal();

                        // Reload once so every current module immediately
                        // reflects the restored local data.
                        window.location.reload();
                    } catch (error) {
                        console.warn(
                            'YURI1 backup import:',
                            error
                        );

                        showImportError(
                            '備份資料無法讀取或格式不正確。'
                        );
                    } finally {
                        input.remove();
                    }
                },
                { once: true }
            );

            document.body.appendChild(input);
            input.click();
        };

        const confirmButton =
            modal.querySelector(
                '[data-reader-data-confirm]'
            );

        actions.forEach(button => {
            button.addEventListener(
                'click',
                async () => {
                    await showDataModal(
                        button.dataset.readerDataAction
                    );
                }
            );
        });

        modal.querySelectorAll(
            '[data-reader-data-close]'
        ).forEach(button => {
            button.addEventListener(
                'click',
                closeDataModal
            );
        });

        if (confirmButton) {
            confirmButton.addEventListener(
                'click',
                async () => {
                    const isExport =
                        modal.dataset.readerDataAction ===
                        'export';

                    // The current modal implementation does not keep the
                    // action on the root, so infer it from the title.
                    const exportMode =
                        title.textContent ===
                        '下載網站進度備份圖卡';

                    if (exportMode) {
                        await exportBackup();
                    } else {
                        closeDataModal();
                        chooseImportFile();
                    }
                }
            );
        }

        // ESC closes the reminder without performing an operation.
        document.addEventListener(
            'keydown',
            event => {
                if (
                    event.key === 'Escape' &&
                    !modal.hidden
                ) {
                    closeDataModal();
                }
            }
        );
    };


    const ensureCoverMemory = () => {
        if (window.YURI1Cover) return;

        const prefix = 'yuri1.codex.cover.';
        const normalize = value => {
            const number = Number(value);
            return Number.isInteger(number) && number > 0 ? number : 1;
        };

        window.YURI1Cover = {
            get(postId) {
                return normalize(localStorage.getItem(prefix + postId));
            },
            set(postId, imageNumber) {
                const value = normalize(imageNumber);
                localStorage.setItem(prefix + postId, String(value));
                return value;
            },
            src(postId, imageNumber) {
                return `Codex-Img/${encodeURIComponent(postId)}%20(${normalize(imageNumber)}).jpg`;
            }
        };
    };

    initDataBackupUI();
    ensureCoverMemory();

    const BACKUP_COVER_KEY = "yuri1.reader.backup-cover";

    const getBackupCover = () => {
        const raw = localStorage.getItem(BACKUP_COVER_KEY);
        if (!raw) return null;

        try {
            const data = JSON.parse(raw);
            if (!data?.postId) return null;
            const imageNumber = Number(data.imageNumber);
            if (!Number.isInteger(imageNumber) || imageNumber < 1) return null;
            return {
                postId: String(data.postId),
                imageNumber,
                src: window.YURI1Cover?.src
                    ? window.YURI1Cover.src(String(data.postId), imageNumber)
                    : `Codex-Img/${encodeURIComponent(data.postId)}%20(${imageNumber}).jpg`
            };
        } catch (error) {
            return null;
        }
    };

    const setBackupCover = (postId, imageNumber) => {
        const value = {
            postId: String(postId),
            imageNumber: Number(imageNumber) || 1,
            savedAt: Date.now()
        };
        localStorage.setItem(BACKUP_COVER_KEY, JSON.stringify(value));
        return value;
    };

    window.YURI1BackupCover = {
        get: getBackupCover,
        set: setBackupCover
    };

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
    const favoriteButton = loader.querySelector(".favorite");
    const saveButton = loader.querySelector(".save-progress");
    const clearButton = loader.querySelector(".clear-progress");
    const doneButton = loader.querySelector(".read-done");
    const immersiveButton = document.querySelector(".immersive-toggle");

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

    const favoriteKey = postId
        ? `yuri1.reader.favorite.${postId}`
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


    /* Backup Card cover selection.
       Reader owns this behavior; Post Loader only renders the images. */
    const coverNotice = (message) => {
        const existing = document.querySelector(".reader-cover-notice.post");
        if (existing) existing.remove();

        const notice = document.createElement("div");
        notice.className = "reader-cover-notice post";
        notice.textContent = message;
        document.body.appendChild(notice);

        requestAnimationFrame(() => {
            notice.classList.add("is-visible");
        });

        setTimeout(() => {
            notice.classList.remove("is-visible");
            setTimeout(() => notice.remove(), 220);
        }, 900);
    };

    const getSelectedCover = () => {
        const cover = window.YURI1BackupCover?.get
            ? window.YURI1BackupCover.get()
            : null;

        if (!cover || cover.postId !== postId) return 0;
        return cover.imageNumber;
    };

    const updateCoverButtons = () => {
        const selected = getSelectedCover();
        document.querySelectorAll(".reader-cover-save.post").forEach(button => {
            const number = Number(button.dataset.imageNumber) || 1;
            const active = number === selected;
            button.classList.toggle("is-active", active);
            button.setAttribute(
                "aria-label",
                active ? "Backup Card cover selected" : "Set as Backup Card cover"
            );
            button.setAttribute(
                "title",
                active ? "Backup Card cover selected" : "Set as Backup Card cover"
            );
        });
    };

    const attachCoverButton = (imageBlock, imageNumber) => {
        if (!imageBlock || imageBlock.querySelector(".reader-cover-save.post")) return;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "reader-cover-save post";
        button.dataset.imageNumber = String(imageNumber);

        const icon = document.createElement("i");
        icon.setAttribute("data-lucide", "gem");
        button.appendChild(icon);

        button.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();

            if (!postId) return;

            const current = window.YURI1BackupCover?.get
                ? window.YURI1BackupCover.get()
                : null;

            const isSameCover = Boolean(
                current &&
                current.postId === postId &&
                Number(current.imageNumber) === Number(imageNumber)
            );

            if (isSameCover) {
                localStorage.removeItem(BACKUP_COVER_KEY);
                coverNotice("◈ Backup Cover Set to Newest ◈");
            } else {
                const saved = window.YURI1BackupCover?.set
                    ? window.YURI1BackupCover.set(postId, imageNumber)
                    : null;

                coverNotice("◈ Backup Cover Set ◈");
                if (saved) renderIcons();
            }

            updateCoverButtons();
        });

        imageBlock.appendChild(button);
        renderIcons();
    };

    const initCoverControls = () => {
        const postRoot = document.getElementById("post-loader");
        if (!postRoot || !postId) return;

        const scan = () => {
            const images = postRoot.querySelector(".post-images.post");
            if (!images) return;

            images.querySelectorAll(".post-image.post").forEach((imageBlock, index) => {
                attachCoverButton(imageBlock, index + 1);
            });
            updateCoverButtons();
        };

        scan();

        const observer = new MutationObserver(scan);
        observer.observe(postRoot, { childList: true, subtree: true });
    };

    const isFavorite = () => {
        if (!favoriteKey) return false;

        return localStorage.getItem(favoriteKey) === "true";
    };

    const updateFavoriteButton = () => {
        if (!favoriteButton) return;

        const favorite = isFavorite();

        favoriteButton.setAttribute(
            "aria-label",
            favorite ? "Remove from favorites" : "Add to favorites"
        );

        favoriteButton.setAttribute(
            "title",
            favorite ? "Remove from favorites" : "Add to favorites"
        );

        setButtonIcon(
            favoriteButton,
            favorite ? "heart-x" : "heart-plus"
        );

        favoriteButton.classList.toggle(
            "is-active",
            favorite
        );
    };

    const toggleFavorite = () => {
        if (!favoriteKey) return;

        if (isFavorite()) {
            localStorage.removeItem(favoriteKey);
            showToast("Removed from favorites");
        } else {
            localStorage.setItem(
                favoriteKey,
                "true"
            );

            showToast("Added to favorites");
        }

        updateFavoriteButton();
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
            const pinLabel =
                postId && postId.startsWith("_")
                    ? "Progress"
                    : modeLabel[mode];

            showToast(
                `${pinLabel} Pinned to ${percent}%`
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


    const isImmersive = () =>
        document.body.classList.contains("is-immersive");

    const updateImmersiveButton = () => {
        if (!immersiveButton) return;

        const active = isImmersive();

        immersiveButton.setAttribute(
            "aria-label",
            active ? "Exit immersive mode" : "Enter immersive mode"
        );

        immersiveButton.setAttribute(
            "title",
            active ? "Exit immersive mode" : "Enter immersive mode"
        );

        setButtonIcon(
            immersiveButton,
            active ? "minimize-2" : "maximize-2"
        );
    };


    const setImmersiveControlPeek = (peek) => {
        if (!immersiveButton) return;
        immersiveButton.classList.toggle("is-peeked", peek);
    };

    const setImmersive = (active) => {
        // Preserve the reader's visual position instead of hard-locking
        // scrollY. Header/footer layout changes can trigger browser
        // scroll anchoring, so keep the post content itself at the same
        // viewport coordinate throughout the 200ms transition.
        const anchor = document.getElementById("post-loader");
        const getAnchorTop = () => {
            if (!anchor) return null;

            const rect = anchor.getBoundingClientRect();
            const styles = window.getComputedStyle(anchor);
            const paddingTop = parseFloat(styles.paddingTop) || 0;

            // Keep the first actual reading-content edge stable. The Post
            // loader's own padding changes during immersive mode, so using
            // the wrapper's raw top alone causes a visible scroll drift.
            return rect.top + paddingTop;
        };
        const anchorTop = getAnchorTop();
        const transitionMs = 220;
        const root = document.documentElement;
        const body = document.body;
        const previousRootAnchor = root.style.overflowAnchor;
        const previousBodyAnchor = body.style.overflowAnchor;
        let rafId = 0;

        root.style.overflowAnchor = "none";
        body.style.overflowAnchor = "none";

        document.body.classList.toggle("is-immersive", active);
        if (active) {
            setImmersiveControlPeek(true);
            setTimeout(() => {
                if (isImmersive()) setImmersiveControlPeek(false);
            }, 220);
        } else {
            immersiveButton?.classList.remove("is-peeked");
        }
        updateImmersiveButton();
        updateProgress();

        const compensateScroll = () => {
            if (anchor && anchorTop !== null) {
                const currentTop = getAnchorTop();
                const delta = currentTop - anchorTop;
                if (Math.abs(delta) > 0.01) {
                    window.scrollBy(0, delta);
                }
            }
            rafId = window.requestAnimationFrame(compensateScroll);
        };

        rafId = window.requestAnimationFrame(compensateScroll);

        window.setTimeout(() => {
            window.cancelAnimationFrame(rafId);

            if (anchor && anchorTop !== null) {
                const currentTop = getAnchorTop();
                const delta = currentTop - anchorTop;
                if (Math.abs(delta) > 0.01) {
                    window.scrollBy(0, delta);
                }
            }

            root.style.overflowAnchor = previousRootAnchor;
            body.style.overflowAnchor = previousBodyAnchor;
            updateProgress();
        }, transitionMs);
    };


    // On both mouse and touch devices, use a normal click for the tucked
    // control area. This avoids pointerdown + click double activation on mobile.
    document.addEventListener("click", (event) => {
        if (!isImmersive()) return;
        if (event.target === immersiveButton || immersiveButton?.contains(event.target)) {
            return;
        }

        const x = event.clientX;
        const y = event.clientY;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Match the visual control's original right/bottom area, with a
        // comfortable invisible touch/click target around it.
        const rightEdge = Math.max(0, (viewportWidth - 360) / 2) + 72;
        const bottomEdge = 68;

        if (x >= viewportWidth - rightEdge && y >= viewportHeight - bottomEdge) {
            setImmersive(false);
        }
    });

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

    if (favoriteButton) {
        favoriteButton.addEventListener(
            "click",
            toggleFavorite
        );
    }

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
    if (immersiveButton) {
        immersiveButton.addEventListener(
            "click",
            (event) => {
                event.stopPropagation();
                setImmersive(!isImmersive());
            }
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
    initCoverControls();
    updateImmersiveButton();
    updateFavoriteButton();
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
            if (isImmersive()) setImmersiveControlPeek(false);
        },
        { passive: true }
    );

    window.addEventListener(
        "resize",
        updateProgress
    );
})();