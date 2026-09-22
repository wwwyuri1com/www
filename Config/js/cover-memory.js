/* YURI1 Cover Memory
 * Remembers the selected cover per post.
 * Cover files are numbered sequentially: (1), (2), (3), ...
 */
(() => {
    const PREFIX = "yuri1.codex.cover.";
    const coverCountCache = new Map();

    function normalize(value) {
        const number = Number(value);
        return Number.isInteger(number) && number > 0 ? number : 1;
    }

    function src(postId, imageNumber) {
        return `Codex-Img/${encodeURIComponent(postId)}%20(${normalize(imageNumber)}).jpg`;
    }

    function imageExists(url) {
        return new Promise(resolve => {
            const image = new Image();
            image.onload = () => resolve(true);
            image.onerror = () => resolve(false);
            image.src = url;
        });
    }

    async function count(postId, max = 50) {
        if (coverCountCache.has(postId)) {
            return coverCountCache.get(postId);
        }

        let total = 0;

        for (let number = 1; number <= max; number++) {
            const exists = await imageExists(src(postId, number));

            if (!exists) {
                break;
            }

            total = number;
        }

        // A post is expected to have at least cover (1). Keep the renderer
        // usable even when an entry has no cover file yet.
        total = Math.max(total, 1);
        coverCountCache.set(postId, total);
        return total;
    }

    window.YURI1Cover = {
        get(postId) {
            return normalize(localStorage.getItem(PREFIX + postId));
        },

        set(postId, imageNumber) {
            const value = normalize(imageNumber);
            localStorage.setItem(PREFIX + postId, String(value));
            return value;
        },

        next(imageNumber, total) {
            const current = normalize(imageNumber);
            const count = Math.max(1, Number(total) || 1);
            return current >= count ? 1 : current + 1;
        },

        src,
        count
    };
})();
