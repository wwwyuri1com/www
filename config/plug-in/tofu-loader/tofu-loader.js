Y1Data.ready.then(() => {
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
    let preferredMode = 'grid';
    let gridGeneration = 0;
    const viewModeKey = 'yuri1.codex.viewMode';
    let renderTimer = null;
    let catalogIndexPromise = null;
    const firstSelectorKey = 'yuri1.codex.catalogSelectorUsed';
    const firstCodexListKey = 'yuri1.codex.firstCodexList';
    // Only the first explicit selection of Codex in this tab defaults to
    // List. Subsequent Catalog navigation follows the saved mode preference.
    let initialCodexList = false;

    function sessionRead(key) {
        try { return sessionStorage.getItem(key); } catch (_) { return null; }
    }

    function sessionWrite(key, value) {
        try { sessionStorage.setItem(key, value); } catch (_) {}
    }

    function trackFirstCatalogSelection(event) {
        const select = event.target;
        if (!select?.matches?.('#codex-filter-catalog select')) return;
        if (sessionRead(firstSelectorKey) === '1') return;
        sessionWrite(firstSelectorKey, '1');
        if (select.value === 'All') sessionWrite(firstCodexListKey, '1');
    }

    // Capture before the Codex selector's own change handler navigates away.
    document.addEventListener('change', trackFirstCatalogSelection, true);

    init();

    function init() {
        buttons.forEach(button => {
            button.addEventListener('click', () => {
                if (button.dataset.viewMode === 'grid') {
                    showGrid();
                } else {
                    showList();
                }
            });
        });

        try {
            preferredMode = localStorage.getItem(viewModeKey) === 'list'
                ? 'list' : 'grid';
        } catch (_) { preferredMode = 'grid'; }
        const requestedCatalog = new URLSearchParams(location.search).get('catalog');
        initialCodexList = requestedCatalog === 'All' &&
            sessionRead(firstCodexListKey) === '1';
        if (initialCodexList) sessionWrite(firstCodexListKey, '0');

        // The Codex data / Catalog render is asynchronous. An initially empty
        // results element is NOT evidence that a Catalog has no covers.
        showList({ remember: false });
        if (resultRoot.dataset.studioReady === 'true') refreshView();

        document.addEventListener('y1:codex-rendered', refreshView);
        // Codex contains Lucide SVGs and reader/status controls. Those can be
        // replaced without any post or Catalog changing. Rebuilding Grid for
        // every descendant mutation creates a feedback loop:
        // setButtonState -> lucide.createIcons -> SVG replacement -> observer.
        // Only structural changes to post/Catalog nodes require a Grid refresh.
        const affectsCatalogContent = mutations => mutations.some(mutation => {
            if (mutation.type !== 'childList') return false;
            return [...mutation.addedNodes, ...mutation.removedNodes].some(node => {
                if (node.nodeType !== 1) return false;
                const selector = '.codex-post, .codex-catalog, .codex-post-list';
                return node.matches(selector) || Boolean(node.querySelector(selector));
            });
        });
        const observer = new MutationObserver(mutations => {
            if (!affectsCatalogContent(mutations)) return;
            clearTimeout(renderTimer);
            renderTimer = setTimeout(refreshView, 0);
        });
        observer.observe(resultRoot, { childList: true, subtree: true });
    }

    function refreshView() {
        if (resultRoot.dataset.studioReady !== 'true') return;
        if (initialCodexList || preferredMode === 'list') {
            if (currentMode !== 'list') showList({ remember: false });
            return;
        }
        showGrid({ remember: false });
    }

    // Grid is image-only. The presence of a Post is not proof that a
    // cover exists; empty image records must show the complete List instead.
    function hasGridCover(post) {
        const postId = post?.dataset?.postId || '';
        if (!postId || postId.startsWith('_') || postId.startsWith('~')) {
            return false;
        }
        // Studio's built WWW already has a complete image registry in memory.
        // Do not infer covers from a blank <img> left in the HTML template.
        if (window.Y1Data && typeof window.Y1Data.images === 'function') {
            return window.Y1Data.images(postId).some(
                image => image && (image.thumb || image.image)
            );
        }
        const img = post.querySelector('[data-codex="post-image-link"]');
        return Boolean(img && img.getAttribute('src'));
    }

    // Grid and List have separate content sources. A Catalog can deliberately
    // collapse its Notofu post rows without removing those posts (or their
    // covers) from the selected Catalog. Grid must never infer "no covers"
    // from the currently rendered List DOM.
    function readCatalogIndex() {
        if (!catalogIndexPromise) {
            catalogIndexPromise = window.Y1Data.request('w/catalog.html')
                .then(response => {
                    if (!response.ok) throw new Error('Codex Catalog unavailable');
                    return response.json();
                })
                .catch(error => {
                    catalogIndexPromise = null;
                    throw error;
                });
        }
        return catalogIndexPromise;
    }

    function selectedCatalogRoot(catalogs, query) {
        if (!query || query === 'All') return catalogs;
        const segments = String(query).split('/').filter(Boolean);
        function walk(nodes, path = '') {
            for (const [name, node] of Object.entries(nodes || {})) {
                const nextPath = path ? `${path}/${name}` : name;
                if (String(node?.id || '') === query || nextPath === query ||
                    (segments.length === 1 && name === query)) return node;
                const child = walk(node?.children, nextPath);
                if (child) return child;
            }
            return null;
        }
        return walk(catalogs);
    }

    function collectCatalogPosts(node, ids, seen) {
        if (!node || typeof node !== 'object') return;
        // A top-level Catalog map has no `posts`, only named children.
        if (Array.isArray(node.posts)) {
            for (const entry of node.posts) {
                const id = typeof entry === 'string' ? entry :
                    String(entry?.name || entry?.file || entry?.storage || '');
                if (id && !seen.has(id)) {
                    seen.add(id);
                    ids.push(id);
                }
            }
        }
        const children = node.children || (node.catalogs ? node.catalogs : null);
        for (const child of Object.values(children || {}))
            collectCatalogPosts(child, ids, seen);
    }

    function hiddenByReader(postId) {
        return localStorage.getItem('yuri1.reader.codex-hidden.' + postId) === 'true';
    }

    function virtualPost(postId) {
        const record = window.Y1Data.record(postId);
        if (!record || hiddenByReader(postId)) return null;
        return {
            dataset: { postId },
            querySelector(selector) {
                if (selector === '[data-codex="post-link"]') return {
                    href: `get/${encodeURIComponent(postId)}.html`,
                    textContent: record.title || postId
                };
                if (selector === '[data-codex="post-image-link"]') return {
                    alt: record.title || postId
                };
                return null;
            }
        };
    }

    async function activeGridPosts() {
        const params = new URLSearchParams(window.location.search);
        const query = params.get('catalog');
        // Tags, favorites and the reader's hidden-items view intentionally
        // use the actual filtered List DOM, not the entire Catalog index.
        if (params.has('tag') || query === 'Favorite' || query === 'Hidden') {
            return Array.from(resultRoot.querySelectorAll('.codex-post[data-post-id]'));
        }
        if (!window.Y1Data || typeof window.Y1Data.request !== 'function') {
            return Array.from(resultRoot.querySelectorAll('.codex-post[data-post-id]'));
        }
        const data = await readCatalogIndex();
        const catalogs = data?.catalogs || {};
        const root = selectedCatalogRoot(catalogs, query);
        if (!root) return [];
        const ids = [];
        const seen = new Set();
        if (root === catalogs) {
            for (const child of Object.values(catalogs))
                collectCatalogPosts(child, ids, seen);
        } else {
            collectCatalogPosts(root, ids, seen);
        }
        return ids.map(virtualPost).filter(Boolean);
    }

    function showGrid({ remember = true } = {}) {
        if (remember) {
            initialCodexList = false;
            preferredMode = 'grid';
            try { localStorage.setItem(viewModeKey, 'grid'); } catch (_) {}
        }
        // Keep the List visible until the selected Catalog's cover index
        // has been evaluated and at least one Grid card has been built.
        buildGrid({ navigateOnEmpty: remember }).catch(error => {
            console.error('TOFU render:', error);
            if (preferredMode === 'grid') showList({ remember: false });
        });
    }

    function showList({ remember = true } = {}) {
        if (remember) {
            initialCodexList = false;
            preferredMode = 'list';
            try { localStorage.setItem(viewModeKey, 'list'); } catch (_) {}
        }
        gridGeneration++; // Cancel any unfinished asynchronous Grid render.
        currentMode = 'list';
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

    function returnToCoverRoot() {
        const params = new URLSearchParams(window.location.search);
        const catalog = params.get('catalog');
        // Only a deliberate Grid click within a coverless Catalog navigates;
        // automatic fallback and root pages must never loop or leave their URL.
        if (!catalog || catalog === 'All' || params.has('tag')) return false;
        window.location.assign(new URL('w/index.html?catalog=All', document.baseURI).href);
        return true;
    }

    async function buildGrid({ navigateOnEmpty = false } = {}) {
        const generation = ++gridGeneration;
        const posts = await activeGridPosts();
        if (generation !== gridGeneration || preferredMode !== 'grid') return;
        if (!posts.some(hasGridCover)) {
            if (navigateOnEmpty && returnToCoverRoot()) return;
            showList({ remember: false });
            return;
        }
        // Build detached, commit only when at least one usable cover card exists.
        const grid = document.createElement('div');
        grid.className = 'codex-tofu-grid';

        // A favorite post may also appear in the normal Codex result list.
        // Tofu should render the same post only once, while keeping the
        // separate FAVO box intact. The first occurrence wins.
        const seenPostIds = new Set();

        posts.forEach(post => {
            const postId = post.dataset.postId;

            // IDs beginning with "_" or "~" are internal/news entries.
            // Keep them in List (Notofu), but never expose them in Tofu Grid.
            if (!postId || postId.startsWith("_") || postId.startsWith("~")) {
                return;
            }

            if (seenPostIds.has(postId)) {
                return;
            }

            seenPostIds.add(postId);
        });

        // Never navigate away from the selected Catalog just because it has
        // no Tofu-compatible cover. showList() preserves the current URL.

        // Render cards in the same order as the Codex result list.
        // Cover-count/storage reads are async, so appending each card directly
        // from renderTofuItem() can otherwise make the first Tofu rebuild
        // finish in a different order.
        const orderedPosts = [];
        const seenForRender = new Set();

        posts.forEach(post => {
            const postId = post.dataset.postId;

            if (!hasGridCover(post)) {
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

        if (generation !== gridGeneration || preferredMode !== 'grid') return;
        items.forEach(item => {
            if (item && item.dataset.coverFailed !== 'true') grid.appendChild(item);
        });
        if (!grid.children.length) {
            if (navigateOnEmpty && returnToCoverRoot()) return;
            showList({ remember: false });
            return;
        }
        tofuRoot.replaceChildren(grid);
        currentMode = 'grid';
        setButtonState('grid');
        notofuRoot.classList.add('is-hidden');
        tofuRoot.classList.remove('is-hidden');
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
        link.href = titleLink?.href || `get/${encodeURIComponent(postId)}.html`;
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
        if (coverCount < 1) return null;

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
                : Y1Data.image(postId,number,true);
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

            item.dataset.coverFailed = 'true';
            item.remove();
            // If every actual image has failed, keep the user in this Catalog
            // and render its readable Notofu content rather than a blank Grid.
            if (currentMode === 'grid' &&
                !tofuRoot.querySelector('.codex-tofu-item')) {
                showList({ remember: false });
            }
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
                : Y1Data.image(postId,nextCover,true);

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

                // Paint this card before writing the preference. A full or
                // unavailable localStorage must not turn a valid click into
                // an apparent no-op.
                coverNumber = next;
                const nextThumbnail = window.YURI1Cover
                    ? window.YURI1Cover.next(coverNumber, coverCount)
                    : (coverNumber >= coverCount ? 1 : coverNumber + 1);

                tofuImage.src = window.YURI1Cover
                    ? window.YURI1Cover.src(postId, coverNumber)
                    : Y1Data.image(postId,coverNumber,true);

                swapImage.src = window.YURI1Cover
                    ? window.YURI1Cover.src(postId, nextThumbnail)
                    : Y1Data.image(postId,nextThumbnail,true);
                if (window.YURI1Cover) {
                    try { window.YURI1Cover.set(postId, coverNumber); }
                    catch (error) { console.warn('Cover preference not saved:', error); }
                }
            });

            imageBlock.appendChild(swapButton);
        }

        item.appendChild(imageBlock);
        return item;
    }

}).catch(error=>console.error(error));