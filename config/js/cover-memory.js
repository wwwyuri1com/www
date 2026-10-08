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
        for (const [oldId, newId] of Object.entries(LEGACY_STORAGE_IDS)) {
            const from = PREFIX + oldId;
            const to = PREFIX + newId;
            if (localStorage.getItem(to) === null && localStorage.getItem(from) !== null) {
                localStorage.setItem(to, localStorage.getItem(from));
            }
        }
    } catch (error) {
        console.warn('YURI1 cover migration skipped', error);
    }


    function normalize(value) {
        const number = Number(value);
        return Number.isInteger(number) && number > 0 ? number : 1;
    }

    function src(postId, imageNumber) {
        return `codex-img/${encodeURIComponent(postId)}-${normalize(imageNumber)}.jpg`;
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
