(() => {
    const tofuRoot =
        document.querySelector('[data-codex="tofu-grid"]');

    const notofuRoot =
        document.querySelector('.codex-notofu');

    const resultRoot =
        document.querySelector('.codex-results');

    const buttons =
        document.querySelectorAll('.codex-view-button');

    if (!tofuRoot || !notofuRoot || !resultRoot || !buttons.length) {
        return;
    }

    let currentMode = 'grid';
    const viewModeKey = 'yuri1.codex.viewMode';
    let renderTimer = null;

    init();

    function init() {
        buttons.forEach(button => {
            button.addEventListener('click', () => {
                const mode = button.dataset.viewMode;

                // On a direct Catalog page whose only Posts are intentionally
                // hidden from Tofu (for example IDs beginning with "_"),
                // clicking Tofu should not look like a broken button.
                // Return to the main Codex page instead.
                if (mode === 'grid' && isTofuHiddenOnlyCatalog()) {
                    // This Catalog has no Tofu-visible Posts. Return to the
                    // main Codex page, but explicitly keep the user's intent
                    // to use Tofu/Grid so the button does not appear broken.
                    localStorage.setItem(viewModeKey, 'grid');
                    window.location.href = 'Codex.html';
                    return;
                }

                if (mode === 'grid') {
                    showGrid();
                } else {
                    showList();
                }
            });
        });

        const savedMode = localStorage.getItem(viewModeKey);

        if (savedMode === 'list') {
            showList();
        } else {
            showGrid();
        }

        const observer = new MutationObserver(() => {
            clearTimeout(renderTimer);
            renderTimer = setTimeout(() => {
                if (currentMode === 'grid') {
                    buildGrid();
                }
            }, 0);
        });

        observer.observe(resultRoot, {
            childList: true,
            subtree: true
        });
    }

    function isTofuHiddenOnlyCatalog() {
        const catalogQuery =
            new URLSearchParams(window.location.search).get('catalog');

        if (
            !catalogQuery ||
            catalogQuery === 'All' ||
            catalogQuery === 'Favorite'
        ) {
            return false;
        }

        const posts =
            resultRoot.querySelectorAll('.codex-post[data-post-id]');

        if (!posts.length) {
            return false;
        }

        return Array.from(posts).every(post => {
            const postId = post.dataset.postId || '';
            return postId.startsWith('_');
        });
    }

    function showGrid() {
        currentMode = 'grid';
        localStorage.setItem(viewModeKey, 'grid');
        setButtonState('grid');
        notofuRoot.classList.add('is-hidden');
        tofuRoot.classList.remove('is-hidden');
        buildGrid();
    }

    function showList() {
        currentMode = 'list';
        localStorage.setItem(viewModeKey, 'list');
        setButtonState('list');
        tofuRoot.classList.add('is-hidden');
        notofuRoot.classList.remove('is-hidden');
    }

    function setButtonState(mode) {
        buttons.forEach(button => {
            const active = button.dataset.viewMode === mode;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', String(active));
        });

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }

        // Keep the toggle visibly usable even if the external icon library is unavailable.
        buttons.forEach(button => {
            if (button.querySelector("svg")) return;
            if (!button.querySelector(".codex-view-fallback")) {
                const fallback = document.createElement("span");
                fallback.className = "codex-view-fallback";
                fallback.textContent =
                    button.dataset.viewMode === "grid" ? "▦" : "☰";
                fallback.setAttribute("aria-hidden", "true");
                button.appendChild(fallback);
            }
        });
    }

    async function buildGrid() {
        const posts = resultRoot.querySelectorAll('.codex-post[data-post-id]');

        tofuRoot.replaceChildren();

        const grid = document.createElement('div');
        grid.className = 'codex-tofu-grid';
        tofuRoot.appendChild(grid);

        // A favorite post may also appear in the normal Codex result list.
        // Tofu should render the same post only once, while keeping the
        // separate FAVO box intact. The first occurrence wins.
        const seenPostIds = new Set();

        posts.forEach(post => {
            const postId = post.dataset.postId;

            // IDs beginning with "_" are internal/system entries.
            // Keep them in List (Notofu), but never expose them in Tofu Grid.
            if (!postId || postId.startsWith("_")) {
                return;
            }

            if (seenPostIds.has(postId)) {
                return;
            }

            seenPostIds.add(postId);
        });

        // If the selected Catalog contains only Posts that Tofu intentionally
        // hides (for example IDs beginning with "_"), an empty Grid looks
        // broken to users. Fall back to List instead of showing a blank page.
        // This applies to direct Catalog views; the root/Favorite views keep
        // their existing behavior.
        const catalogQuery =
            new URLSearchParams(window.location.search).get("catalog");

        if (
            catalogQuery &&
            catalogQuery !== "All" &&
            catalogQuery !== "Favorite" &&
            posts.length > 0 &&
            !Array.from(posts).some(post => {
                const postId = post.dataset.postId || "";
                return postId && !postId.startsWith("_");
            })
        ) {
            showList();
            return;
        }

        // Render cards in the same order as the Codex result list.
        // Cover-count/storage reads are async, so appending each card directly
        // from renderTofuItem() can otherwise make the first Tofu rebuild
        // finish in a different order.
        const orderedPosts = [];
        const seenForRender = new Set();

        posts.forEach(post => {
            const postId = post.dataset.postId;

            if (!postId || postId.startsWith("_")) {
                return;
            }

            if (seenForRender.has(postId)) {
                return;
            }

            seenForRender.add(postId);
            orderedPosts.push(post);
        });

        const items = await Promise.all(
            orderedPosts.map(post => renderTofuItem(post))
        );

        items.forEach(item => {
            if (item) {
                grid.appendChild(item);
            }
        });
    }

    async function renderTofuItem(post) {
        const postId = post.dataset.postId;
        const image = post.querySelector('[data-codex="post-image-link"]');
        const titleLink = post.querySelector('[data-codex="post-link"]');

        const item = document.createElement('div');
        item.className = 'codex-tofu-item';
        item.dataset.postId = postId;

        const imageBlock = document.createElement('div');
        imageBlock.className = 'post-image tofu';
        imageBlock.dataset.codex = 'post-image';

        const link = document.createElement('a');
        link.href = titleLink?.href || `Post.html?id=${encodeURIComponent(postId)}`;
        link.className = 'codex-tofu-cover-link';

        const tofuImage = document.createElement('img');
        tofuImage.className = 'post tofu';
        tofuImage.dataset.codex = 'post-image-link';
        tofuImage.alt = image?.alt || titleLink?.textContent || postId;
        tofuImage.loading = 'lazy';
        tofuImage.decoding = 'async';

        const coverCount = window.YURI1Cover
            ? await window.YURI1Cover.count(postId)
            : 1;

        let coverNumber = window.YURI1Cover
            ? window.YURI1Cover.get(postId)
            : 1;

        if (coverNumber > coverCount) {
            coverNumber = 1;
            if (window.YURI1Cover) {
                window.YURI1Cover.set(postId, coverNumber);
            }
        }

        const applyCover = number => {
            coverNumber = number;
            tofuImage.src = window.YURI1Cover
                ? window.YURI1Cover.src(postId, number)
                : `Codex-Img/${encodeURIComponent(postId)}%20(${number}).jpg`;
        };

        tofuImage.addEventListener('error', () => {
            if (coverNumber !== 1) {
                coverNumber = 1;
                if (window.YURI1Cover) {
                    window.YURI1Cover.set(postId, 1);
                }
                applyCover(1);
                return;
            }

            imageBlock.remove();
        }, { once: false });

        applyCover(coverNumber);
        link.appendChild(tofuImage);
        imageBlock.appendChild(link);

        // The small cover is always the NEXT cover in the sequence.
        // Example: 1 -> small 2, 2 -> small 3, 3 -> small 1.
        if (coverCount > 1) {
            const swapButton = document.createElement('button');
            swapButton.type = 'button';
            swapButton.className = 'codex-cover-swap';
            swapButton.setAttribute('aria-label', 'Show next cover');
            swapButton.title = 'Show next cover';

            const swapImage = document.createElement('img');
            swapImage.alt = '';
            swapImage.loading = 'lazy';
            swapImage.decoding = 'async';

            const nextCover = window.YURI1Cover
                ? window.YURI1Cover.next(coverNumber, coverCount)
                : (coverNumber >= coverCount ? 1 : coverNumber + 1);

            swapImage.src = window.YURI1Cover
                ? window.YURI1Cover.src(postId, nextCover)
                : `Codex-Img/${encodeURIComponent(postId)}%20(${nextCover}).jpg`;

            swapImage.addEventListener('error', () => {
                swapButton.remove();
            }, { once: true });

            swapButton.appendChild(swapImage);
            swapButton.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();

                const next = window.YURI1Cover
                    ? window.YURI1Cover.next(coverNumber, coverCount)
                    : (coverNumber >= coverCount ? 1 : coverNumber + 1);

                // Update ONLY this card. Rebuilding the whole grid here made
                // neighbouring cards re-render and appear to switch together.
                coverNumber = next;

                if (window.YURI1Cover) {
                    window.YURI1Cover.set(postId, coverNumber);
                }

                const nextThumbnail = window.YURI1Cover
                    ? window.YURI1Cover.next(coverNumber, coverCount)
                    : (coverNumber >= coverCount ? 1 : coverNumber + 1);

                tofuImage.src = window.YURI1Cover
                    ? window.YURI1Cover.src(postId, coverNumber)
                    : `Codex-Img/${encodeURIComponent(postId)}%20(${coverNumber}).jpg`;

                swapImage.src = window.YURI1Cover
                    ? window.YURI1Cover.src(postId, nextThumbnail)
                    : `Codex-Img/${encodeURIComponent(postId)}%20(${nextThumbnail}).jpg`;
            });

            imageBlock.appendChild(swapButton);
        }

        item.appendChild(imageBlock);
        return item;
    }

})();
