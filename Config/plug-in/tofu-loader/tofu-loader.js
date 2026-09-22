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
    let renderTimer = null;

    init();

    function init() {
        buttons.forEach(button => {
            button.addEventListener('click', () => {
                const mode = button.dataset.viewMode;
                if (mode === 'grid') {
                    showGrid();
                } else {
                    showList();
                }
            });
        });

        setButtonState('grid');
        showGrid();

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

    function showGrid() {
        currentMode = 'grid';
        setButtonState('grid');
        notofuRoot.classList.add('is-hidden');
        tofuRoot.classList.remove('is-hidden');
        buildGrid();
    }

    function showList() {
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
    }

    function buildGrid() {
        const posts = resultRoot.querySelectorAll('.codex-post[data-post-id]');

        tofuRoot.replaceChildren();

        const grid = document.createElement('div');
        grid.className = 'codex-tofu-grid';

        posts.forEach(post => {
            const postId = post.dataset.postId;
            const image = post.querySelector('[data-codex="post-image-link"]');
            const titleLink = post.querySelector('[data-codex="post-link"]');

            if (!postId) {
                return;
            }

            const item = document.createElement('div');
            item.className = 'codex-tofu-item';
            item.dataset.postId = postId;

            const imageBlock = document.createElement('div');
            imageBlock.className = 'post-image tofu';
            imageBlock.dataset.codex = 'post-image';

            const link = document.createElement('a');
            link.href = titleLink?.href || `Post.html?id=${encodeURIComponent(postId)}`;

            const tofuImage = document.createElement('img');
            tofuImage.className = 'post tofu';
            tofuImage.dataset.codex = 'post-image-link';
            tofuImage.alt = image?.alt || titleLink?.textContent || postId;
            tofuImage.loading = 'lazy';
            tofuImage.decoding = 'async';

            if (image?.src) {
                tofuImage.src = image.src;
            }

            link.appendChild(tofuImage);
            imageBlock.appendChild(link);
            item.appendChild(imageBlock);
            grid.appendChild(item);
        });

        tofuRoot.appendChild(grid);
    }
})();
