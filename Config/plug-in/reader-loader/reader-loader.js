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
        const BACKUP_CARD_SYSTEM_VERSION = '1.001';
        const BACKUP_SCOPE_PREFIXES = [
            'yuri1.reader.',
            'yuri1.codex.'
        ];

        const CODE_GRID_WIDTH = 490;
        const CODE_GRID_HEIGHT = 280;
        const CODE_CELL_SIZE = 2;
        const CODE_X = 412;
        const CODE_Y = 2470;
        const CODE_BORDER_CELLS = 2;
        const CODE_INNER_WIDTH = CODE_GRID_WIDTH - CODE_BORDER_CELLS * 2;
        const CODE_INNER_HEIGHT = CODE_GRID_HEIGHT - CODE_BORDER_CELLS * 2;

        let defaultCoverPromise = null;

        const stampNow = () =>
            new Date().toLocaleString([], {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

        const cardStamp = date => {
            const now = date instanceof Date ? date : new Date(date);
            const pad = value => String(value).padStart(2, '0');
            const hour = now.getHours();
            const suffix = hour >= 12 ? 'PM' : 'AM';
            const hour12 = String(hour % 12 || 12).padStart(2, '0');

            return `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${suffix} ${hour12}:${pad(now.getMinutes())}`;
        };

        const fileStamp = () => {
            const now = new Date();
            const pad = value => String(value).padStart(2, '0');
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
            if (!window.YURI1BackupCover?.get) return null;
            return window.YURI1BackupCover.get();
        };

        const getNumericIdOrder = postId => {
            const match = String(postId).match(/^\d{8}-(\d+)/);
            return match ? Number(match[1]) : -1;
        };

        const getDefaultBackupCover = async () => {
            if (defaultCoverPromise) return defaultCoverPromise;

            defaultCoverPromise = (async () => {
                try {
                    const response = await fetch('Codex-W/W-Catalog.json');
                    if (!response.ok) throw new Error(`W-Catalog request failed (${response.status})`);

                    const data = await response.json();
                    const ids = new Set();

                    const collectPosts = node => {
                        if (!node || typeof node !== 'object') return;
                        if (Array.isArray(node.posts)) {
                            node.posts.forEach(postId => {
                                if (postId) ids.add(String(postId));
                            });
                        }
                        if (node.children && typeof node.children === 'object') {
                            Object.values(node.children).forEach(collectPosts);
                        }
                    };

                    if (data?.catalogs && typeof data.catalogs === 'object') {
                        Object.values(data.catalogs).forEach(collectPosts);
                    }

                    const postData = [];
                    await Promise.all(Array.from(ids).map(async postId => {
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
                    }));

                    postData.sort((a, b) => {
                        if (a.date !== b.date) return b.date.localeCompare(a.date);
                        if (a.number !== b.number) return b.number - a.number;
                        return b.postId.localeCompare(a.postId);
                    });

                    const first = postData[0];
                    if (!first) return null;

                    return {
                        postId: first.postId,
                        imageNumber: 1,
                        src: window.YURI1Cover?.src
                            ? window.YURI1Cover.src(first.postId, 1)
                            : `Codex-Img/${encodeURIComponent(first.postId)}%20(1).jpg`,
                        isDefault: true
                    };
                } catch (error) {
                    console.warn('YURI1 default Backup Card cover:', error);
                    return null;
                }
            })();

            return defaultCoverPromise;
        };

        const getCurrentBackupCover = async () => {
            const stored = getStoredBackupCover();
            if (stored) return { ...stored, isDefault: false };
            return getDefaultBackupCover();
        };

        const closeDataModal = () => {
            modal.hidden = true;
            modal.setAttribute('aria-hidden', 'true');
        };

        const showDataModal = async action => {
            const isExport = action === 'export';
            modal.dataset.readerDataAction = action;

            title.textContent = isExport
                ? 'Download Backup Card'
                : 'Restore Website Progress';

            body.textContent = isExport
                ? 'Would you like to download a backup card of your current website progress?'
                : 'Please select a backup card PNG.\n\nWARNING: Restoring will overwrite your current website progress and cannot be undone.';

            time.textContent = isExport
                ? `Backup Cover: ${((await getCurrentBackupCover())?.isDefault ? 'Newest' : 'Custom')}`
                : 'Click OK to select backup card PNG';

            if (preview) {
                preview.hidden = !isExport;
                preview.removeAttribute('src');
                preview.alt = '';

                if (isExport) {
                    const cover = await getCurrentBackupCover();
                    if (cover) {
                        // Use the cover record itself so a manually selected
                        // image (including image 2, 3, ...) is reflected in the
                        // export confirmation preview immediately.
                        preview.src = cover.src;
                        preview.alt = 'Current backup cover preview';
                    }
                }
            }

            modal.hidden = false;
            modal.setAttribute('aria-hidden', 'false');
            return isExport;
        };

        const collectBackupStorage = () => {
            const storage = {};
            for (let index = 0; index < localStorage.length; index += 1) {
                const key = localStorage.key(index);
                if (!key) continue;
                if (!BACKUP_SCOPE_PREFIXES.some(prefix => key.startsWith(prefix))) continue;
                const value = localStorage.getItem(key);
                if (value !== null) storage[key] = value;
            }
            return storage;
        };

        const buildBackupData = async () => {
            const cover = await getCurrentBackupCover();
            return {
                format: 'YURI1-BACKUP-CARD',
                version: BACKUP_VERSION,
                systemVersion: BACKUP_CARD_SYSTEM_VERSION,
                kind: 'png-card-data',
                createdAt: new Date().toISOString(),
                cover: cover
                    ? {
                        postId: cover.postId,
                        imageNumber: cover.imageNumber,
                        src: cover.src,
                        isDefault: Boolean(cover.isDefault)
                    }
                    : null,
                storage: collectBackupStorage()
            };
        };

        const crc32 = bytes => {
            let crc = 0xffffffff;
            for (const byte of bytes) {
                crc ^= byte;
                for (let bit = 0; bit < 8; bit += 1) {
                    crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
                }
            }
            return (crc ^ 0xffffffff) >>> 0;
        };

        const bytesToBits = bytes => {
            const bits = [];
            for (const byte of bytes) {
                for (let bit = 7; bit >= 0; bit -= 1) {
                    bits.push((byte >> bit) & 1);
                }
            }
            return bits;
        };

        const bitsToBytes = bits => {
            const bytes = [];
            for (let index = 0; index + 7 < bits.length; index += 8) {
                let value = 0;
                for (let bit = 0; bit < 8; bit += 1) {
                    value = (value << 1) | bits[index + bit];
                }
                bytes.push(value);
            }
            return new Uint8Array(bytes);
        };

        const uint32be = value => new Uint8Array([
            (value >>> 24) & 0xff,
            (value >>> 16) & 0xff,
            (value >>> 8) & 0xff,
            value & 0xff
        ]);

        const readUint32be = (bytes, offset) =>
            (
                (((bytes[offset] << 24) >>> 0) |
                (bytes[offset + 1] << 16) |
                (bytes[offset + 2] << 8) |
                bytes[offset + 3]) >>> 0
            );

        const concatBytes = arrays => {
            const total = arrays.reduce((sum, array) => sum + array.length, 0);
            const result = new Uint8Array(total);
            let offset = 0;
            arrays.forEach(array => {
                result.set(array, offset);
                offset += array.length;
            });
            return result;
        };

        const gzipBytes = async bytes => {
            if (typeof CompressionStream === 'undefined') return { codec: 0, bytes };
            const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
            return { codec: 1, bytes: new Uint8Array(await new Response(stream).arrayBuffer()) };
        };

        const gunzipBytes = async bytes => {
            if (typeof DecompressionStream === 'undefined') {
                throw new Error('DecompressionStream is unavailable.');
            }
            const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
            return new Uint8Array(await new Response(stream).arrayBuffer());
        };

        const buildCodeBytes = async backup => {
            const json = JSON.stringify(backup);
            const source = new TextEncoder().encode(json);
            const compressed = await gzipBytes(source);

            const magic = new TextEncoder().encode('Y1BC');
            const header = concatBytes([
                magic,
                new Uint8Array([BACKUP_VERSION, compressed.codec, 0, 0]),
                uint32be(compressed.bytes.length),
                uint32be(crc32(compressed.bytes))
            ]);

            return concatBytes([header, compressed.bytes]);
        };

        const loadImage = src => new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error(`Image load failed: ${src}`));
            image.src = src;
        });

        const drawCover = (ctx, image, x, y, width, height) => {
            const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
            const drawWidth = image.naturalWidth * scale;
            const drawHeight = image.naturalHeight * scale;
            const drawX = x + (width - drawWidth) / 2;
            const drawY = y + (height - drawHeight) / 2;
            ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
        };

        const drawDataCode = (ctx, bytes) => {
            const matrix = Array.from(
                { length: CODE_GRID_HEIGHT },
                () => Array(CODE_GRID_WIDTH).fill(0)
            );

            const bits = bytesToBits(bytes);
            const capacity = CODE_INNER_WIDTH * CODE_INNER_HEIGHT;

            if (bits.length > capacity) {
                throw new Error('Backup data is too large for the Backup Card code.');
            }

            let bitIndex = 0;
            for (
                let row = CODE_BORDER_CELLS;
                row < CODE_GRID_HEIGHT - CODE_BORDER_CELLS;
                row += 1
            ) {
                for (
                    let col = CODE_BORDER_CELLS;
                    col < CODE_GRID_WIDTH - CODE_BORDER_CELLS;
                    col += 1
                ) {
                    if (bitIndex < bits.length) {
                        matrix[row][col] = bits[bitIndex];
                    } else {
                        const seed = (
                            row * 1103515245 +
                            col * 12345 +
                            bytes.length * 97
                        ) >>> 0;
                        matrix[row][col] =
                            (seed ^ (seed >>> 11) ^ (seed >>> 19)) & 1;
                    }
                    bitIndex += 1;
                }
            }

            for (
                let index = CODE_BORDER_CELLS;
                index < CODE_GRID_WIDTH - CODE_BORDER_CELLS;
                index += 4
            ) {
                matrix[CODE_BORDER_CELLS - 1][index] =
                    index % 8 === 0 ? 1 : 0;
            }

            for (
                let index = CODE_BORDER_CELLS;
                index < CODE_GRID_HEIGHT - CODE_BORDER_CELLS;
                index += 4
            ) {
                matrix[index][CODE_BORDER_CELLS - 1] =
                    index % 8 === 0 ? 1 : 0;
            }

            const codeWidth = CODE_GRID_WIDTH * CODE_CELL_SIZE;
            const codeHeight = CODE_GRID_HEIGHT * CODE_CELL_SIZE;

            ctx.save();
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(CODE_X, CODE_Y, codeWidth, codeHeight);
            ctx.fillStyle = '#111111';

            for (let row = 0; row < CODE_GRID_HEIGHT; row += 1) {
                for (let col = 0; col < CODE_GRID_WIDTH; col += 1) {
                    if (!matrix[row][col]) continue;
                    ctx.fillRect(
                        CODE_X + col * CODE_CELL_SIZE,
                        CODE_Y + row * CODE_CELL_SIZE,
                        CODE_CELL_SIZE,
                        CODE_CELL_SIZE
                    );
                }
            }

            ctx.restore();
        };

        const createBackupCardCanvas = async backup => {
            const canvas = document.createElement('canvas');
            canvas.width = 1805;
            canvas.height = 3200;

            const ctx = canvas.getContext('2d', { alpha: false });
            if (!ctx) throw new Error('Canvas is unavailable.');

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.imageSmoothingEnabled = true;

            const cover = backup.cover || await getCurrentBackupCover();
            if (!cover?.src) throw new Error('Backup cover is unavailable.');

            const coverImage = await loadImage(cover.src);
            // Match the SaveCard V2 composition: one large cover, a prominent
            // timestamp directly below it, the Y1 data code centered beneath,
            // then the small identity / warning row at the bottom.
            drawCover(ctx, coverImage, 263, 44, 1280, 2275);

            ctx.fillStyle = '#111111';
            ctx.textBaseline = 'alphabetic';
            ctx.font = '72px Georgia, serif';
            ctx.textAlign = 'center';
            ctx.fillText(cardStamp(new Date(backup.createdAt)), 902, 2432);

            const codeBytes = await buildCodeBytes(backup);
            drawDataCode(ctx, codeBytes);

            const logo = await loadImage('Config/img/icon-s.png');
            ctx.drawImage(logo, 205, 3045, 135, 135);

            ctx.fillStyle = '#fa6699';
            ctx.textAlign = 'left';
            ctx.font = '62px Georgia, serif';
            ctx.fillText('Backup Card', 380, 3158);

            ctx.font = '21px Georgia, serif';
            ctx.fillText('Please keep the original image unchanged.', 820, 3128);
            ctx.fillText('Editing, cropping, resizing, or compression may', 820, 3155);
            ctx.fillText('make the backup unreadable. / system ver ' + BACKUP_CARD_SYSTEM_VERSION + ' / © YURI NO1 · www.yuri1.com', 820, 3182);

            ctx.textAlign = 'left';

            return canvas;
        };

        const canvasToBlob = canvas => new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if (blob) resolve(blob);
                else reject(new Error('Canvas PNG generation failed.'));
            }, 'image/png');
        });

        const downloadBlob = (filename, blob) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1500);
        };

        const exportBackup = async () => {
            try {
                const backup = await buildBackupData();
                const canvas = await createBackupCardCanvas(backup);
                const blob = await canvasToBlob(canvas);
                downloadBlob(
                    `YURI1_BackupCard_${fileStamp()}.png`,
                    blob
                );
                closeDataModal();
            } catch (error) {
                console.warn('YURI1 Backup Card export:', error);
                if (typeof window.readerToast === 'function') {
                    window.readerToast('備份圖卡建立失敗，請稍後再試。');
                } else {
                    window.alert('備份圖卡建立失敗，請稍後再試。');
                }
            }
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

        const decodeBackupCardPng = async file => {
            const imageUrl = URL.createObjectURL(file);
            try {
                const image = await loadImage(imageUrl);
                if (image.naturalWidth !== 1805 || image.naturalHeight !== 3200) {
                    throw new Error('Invalid Backup Card dimensions.');
                }

                const canvas = document.createElement('canvas');
                canvas.width = 1805;
                canvas.height = 3200;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(image, 0, 0);

                const imageData = ctx.getImageData(
                    CODE_X,
                    CODE_Y,
                    CODE_GRID_WIDTH * CODE_CELL_SIZE,
                    CODE_GRID_HEIGHT * CODE_CELL_SIZE
                );

                const bits = [];
                for (let row = CODE_BORDER_CELLS; row < CODE_GRID_HEIGHT - CODE_BORDER_CELLS; row += 1) {
                    for (let col = CODE_BORDER_CELLS; col < CODE_GRID_WIDTH - CODE_BORDER_CELLS; col += 1) {
                        const px = Math.floor((col + 0.5) * CODE_CELL_SIZE);
                        const py = Math.floor((row + 0.5) * CODE_CELL_SIZE);
                        const offset = (py * imageData.width + px) * 4;
                        const luminance = (
                            imageData.data[offset] * 0.299 +
                            imageData.data[offset + 1] * 0.587 +
                            imageData.data[offset + 2] * 0.114
                        );
                        bits.push(luminance < 128 ? 1 : 0);
                    }
                }

                const bytes = bitsToBytes(bits);
                const magic = new TextDecoder().decode(bytes.slice(0, 4));
                if (magic !== 'Y1BC') throw new Error('Invalid Y1 Backup Card code.');

                const version = bytes[4];
                const codec = bytes[5];
                const length = readUint32be(bytes, 8);
                const expectedCrc = readUint32be(bytes, 12);

                if (version !== BACKUP_VERSION) throw new Error('Unsupported Backup Card version.');
                if (length <= 0 || 16 + length > bytes.length) throw new Error('Invalid Backup Card length.');

                const payload = bytes.slice(16, 16 + length);
                if (crc32(payload) !== expectedCrc) throw new Error('Backup Card data is damaged.');

                const decodedBytes = codec === 1 ? await gunzipBytes(payload) : payload;
                const json = new TextDecoder().decode(decodedBytes);
                const data = JSON.parse(json);

                if (!isBackupObjectValid(data)) throw new Error('Invalid YURI1 backup data.');
                return data;
            } finally {
                URL.revokeObjectURL(imageUrl);
            }
        };

        const chooseImportFile = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.png,image/png,.json,application/json';
            input.style.display = 'none';

            input.addEventListener('change', async () => {
                const file = input.files?.[0];
                if (!file) {
                    input.remove();
                    return;
                }

                try {
                    let data;

                    if (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) {
                        data = await decodeBackupCardPng(file);
                    } else {
                        data = JSON.parse(await file.text());
                        if (!isBackupObjectValid(data)) {
                            throw new Error('Invalid YURI1 backup data.');
                        }
                    }

                    applyImportedBackup(data);
                    closeDataModal();
                    window.location.reload();
                } catch (error) {
                    console.warn('YURI1 backup import:', error);
                    showImportError('備份資料無法讀取或格式不正確。');
                } finally {
                    input.remove();
                }
            }, { once: true });

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

                    const exportMode =
                        modal.dataset.readerDataAction ===
                        'export';

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
        const mode = aiLoader?.dataset.mode || "a";

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