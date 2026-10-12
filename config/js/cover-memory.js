/* YURI1 Cover Memory
 * Remembers the selected cover per post.
 * Cover files are numbered sequentially: (1), (2), (3), ...
 */
(() => {
    const PREFIX = "yuri1.codex.cover.";
    const coverCountCache = new Map();
    // Non-destructive migration of older per-post cover selections.
    // The old keys remain available for older exports, while the new names work immediately.
    const LEGACY_STORAGE_IDS = {"-Arte":"ip-arte","-C.Curo":"ip-c-curo","-D.Cyan":"ip-d-cyan","-D.Dark":"ip-d-dark","-D.Golden":"ip-d-golden","-E.Red":"ip-e-red","-IP_Album-Icy-Mini-Vol1":"ip-album-icy-mini-vol1","-Icy":"ip-icy","-L.Night":"ip-l-night","-N.White":"ip-n-white","-NO6":"ip-no6","-no2":"ip-no2","-no3":"ip-no3","-no5":"ip-no5","20260924-01_S_LittleBunny":"post-20260924-01-s-littlebunny","20260924-02_S_LadyL":"post-20260924-02-s-ladyl","20260924-03_D_AI-Lover-CYAN-V0001":"post-20260924-03-d-ai-lover-cyan-v0001","20260924-04_L_Yuri-Succubus":"post-20260924-04-l-yuri-succubus","20260925-01_S_Sorry":"post-20260925-01-s-sorry","20260926-01_R_VIP-Client":"post-20260926-01-r-vip-client","20260926-02_S_Doberman":"post-20260926-02-s-doberman","20260927-01_I_Icys-Patisserie":"post-20260927-01-i-icys-patisserie","20260927-02_O_Miss you":"post-20260927-02-o-miss-you","20260928-01_L_Contract-Me":"post-20260928-01-l-contract-me","20260928-02_O_Cat-Fighting":"post-20260928-02-o-cat-fighting","20260928-03_D_Campus-Heartthrob":"post-20260928-03-d-campus-heartthrob","20260928-04_C_15x-Massage":"post-20260928-04-c-15x-massage","20260929-01_L_Self-Defense":"post-20260929-01-l-self-defense","20260929-02_S_Five-Bottles":"post-20260929-02-s-five-bottles","20260929-03_C_DDD-Special-Operations":"post-20260929-03-c-ddd-special-operations","20260930-01_S_Carnivore":"post-20260930-01-s-carnivore","20261002-01_S_Black Cherry":"post-20261002-01-s-black-cherry","20261003-01_D_King of no mercy":"post-20261003-01-d-king-of-no-mercy","20261008-01_o_touch":"post-20261008-01-o-touch","_AI-&-Content-Policy":"yuri1-ai-and-content-policy","_Backup-Card":"yuri1-backup-card","_Content-Rating-Guide":"yuri1-content-rating-guide","_Fan-Content-Guidelines":"yuri1-fan-content-guidelines","_IP-Story":"yuri1-ip-story","_Introduction":"yuri1-introduction","_Privacy-Policy":"yuri1-privacy-policy","_Reading-Settings":"yuri1-reading-settings","_Special-Thanks":"yuri1-special-thanks","_Terms":"yuri1-terms","~260924-01":"news-260924-01","~260930-01":"news-260930-01","~260930-02":"news-260930-02","~260930-03":"news-260930-03","~261003-01":"news-261003-01","~261004-01":"news-261004-01","~261005-01":"news-261005-01","~261008-01":"news-261008-01","~261008-02":"news-261008-02"};
    try {
        const migrate = (oldId, newId) => {
            if (!oldId || !newId || oldId === newId) return;
            // Keep old keys for previously exported sites; copy preferences
            // without overwriting an existing newer visitor selection.
            for (const suffix of ['', '.asset']) {
                const from = PREFIX + oldId + suffix;
                const to = PREFIX + newId + suffix;
                if (localStorage.getItem(to) === null && localStorage.getItem(from) !== null) {
                    localStorage.setItem(to, localStorage.getItem(from));
                }
            }
        };
        for (const [oldId, newId] of Object.entries(LEGACY_STORAGE_IDS)) {
            migrate(oldId, newId);
        }
        // The old human-readable ID is sometimes two generations older
        // than Studio's permanent asset_no. Run both migrations here because
        // identity-state.js may execute before the first legacy copy above.
        for (const [legacyId, permanentId] of Object.entries(window.Y1Identity || {})) {
            migrate(legacyId, permanentId);
        }
    } catch (error) {
        console.warn('YURI1 cover migration skipped', error);
    }



    // A failed localStorage write must never disable the visible cover switch.
    // Try sessionStorage as a same-tab fallback, and retain an in-memory choice
    // when both browser storage facilities are unavailable. Do not rewrite
    // unrelated reader preferences or evict user data.
    const volatileSelections = new Map();
    const fallbackPrefix = 'yuri1.codex.cover.fallback.';

    function readSelection(key) {
        if (volatileSelections.has(key)) return volatileSelections.get(key);
        try {
            const temporary = sessionStorage.getItem(fallbackPrefix + key);
            if (temporary !== null) return temporary;
        } catch (_) { /* Private browsing may block session storage. */ }
        try { return localStorage.getItem(key); }
        catch (_) { return null; }
    }

    function saveSelection(key, value) {
        volatileSelections.set(key, String(value));
        try {
            localStorage.setItem(key, String(value));
            try { sessionStorage.removeItem(fallbackPrefix + key); } catch (_) {}
            return;
        } catch (_) { /* Never interrupt the card's click handler. */ }
        try { sessionStorage.setItem(fallbackPrefix + key, String(value)); }
        catch (_) { console.warn('Cover selection could not be stored for the next visit.'); }
    }

    function clearSelection(key) {
        volatileSelections.delete(key);
        try { localStorage.removeItem(key); } catch (_) {}
        try { sessionStorage.removeItem(fallbackPrefix + key); } catch (_) {}
    }

    function normalize(value) {
        const number = Number(value);
        return Number.isInteger(number) && number > 0 ? number : 1;
    }

    // The current Studio build embeds the complete image identity registry in
    // its HTML data. Preserve the original cover-memory component rather than
    // replacing it with a different, stripped-down build-only implementation.
    function studioImages(postId) {
        return window.Y1Data && typeof window.Y1Data.images === 'function'
            ? window.Y1Data.images(postId) : null;
    }

    function src(postId, imageNumber) {
        const images = studioImages(postId);
        if (images) {
            const image = images[normalize(imageNumber) - 1];
            return image ? (image.thumb || image.image || '') : '';
        }
        return Y1Data.image(postId,normalize(imageNumber),true);
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
        // Count actual issued image identities, not guessed numbered filenames.
        // A compact Studio URL can use any image extension and has no gaps.
        if (window.Y1Data && window.Y1Data.ready) {
            await window.Y1Data.ready;
        }
        const images = studioImages(postId);
        if (images) return images.length;

        if (coverCountCache.has(postId)) return coverCountCache.get(postId);
        let total = 0;
        for (let number = 1; number <= max; number++) {
            if (!await imageExists(src(postId, number))) break;
            total = number;
        }
        total = Math.max(total, 1);
        coverCountCache.set(postId, total);
        return total;
    }

    // Persist the actual selected asset identity as well as its index. The
    // numeric value remains compatible with existing visitor preferences;
    // stable identity keeps the same image chosen if the Post's image order
    // changes in a later Studio build.
    function selectedAssetKey(postId) {
        return PREFIX + postId + '.asset';
    }

    function get(postId) {
        const images = studioImages(postId);
        const selectedAsset = readSelection(selectedAssetKey(postId));
        if (selectedAsset && images) {
            const index = images.findIndex(image => image.asset_no === selectedAsset);
            if (index >= 0) return index + 1;
        }
        return normalize(readSelection(PREFIX + postId));
    }

    function set(postId, imageNumber) {
        const value = normalize(imageNumber);
        saveSelection(PREFIX + postId, String(value));
        const images = studioImages(postId);
        const asset = images && images[value - 1]?.asset_no;
        if (asset) saveSelection(selectedAssetKey(postId), asset);
        else clearSelection(selectedAssetKey(postId));
        return value;
    }

    window.YURI1Cover = {
        get,
        set,

        next(imageNumber, total) {
            const current = normalize(imageNumber);
            const count = Math.max(1, Number(total) || 1);
            return current >= count ? 1 : current + 1;
        },

        src,
        count
    };
})();
