Y1Data.ready.then(() => {
    const root = document.querySelector(".candy-loader");
    if (!root) return;

    const river = root.querySelector(".candy-river");
    if (!river) return;

    const catalogPath = "w/catalog.html";
    let catalogPromise = null;

    function loadCatalog() {
        if (!catalogPromise) {
            catalogPromise = Y1Data.request(catalogPath, {
                cache: "no-cache"
            }).then(response => {
                if (!response.ok) {
                    throw new Error(
                        `W-Catalog request failed (${response.status})`
                    );
                }
                return response.json();
            });
        }
        return catalogPromise;
    }

    function getCatalogPostStorageId(postRef) {
        if (typeof postRef === "object" && postRef !== null) {
            return String(
                postRef.name ||
                postRef.file ||
                postRef.storage ||
                postRef.filename ||
                ""
            );
        }

        return String(postRef || "");
    }

    function getCatalogPostPublicId(postRef) {
        if (typeof postRef === "object" && postRef !== null) {
            const explicitId = String(postRef.id || "");
            if (explicitId) return explicitId;
        }

        const value = getCatalogPostStorageId(postRef);
        let match = value.match(/^news-(\d{6})-(\d{2})$/);
        if (match) return `N${match[1]}-${match[2]}`;

        match = value.match(/^post-(\d{8})-(\d{2})(?:-|$)/);
        if (match) return `P${match[1]}-${match[2]}`;

        return value;
    }

    loadNewestCover()
        .catch(error => {
            console.warn("Candy Loader: unable to load newest cover.", error);
        });

    async function loadNewestCover() {
        const boss = document.querySelector(".candy-boss");
        if (!boss) return;

        try {
            // Optional homepage hero override:
            // If codex-img-hd/yuri1-index.jpg exists, use it.
            // Otherwise fall back to the newest post cover.
            const overrideSrc = await loadOptionalIndexCover();
            if (overrideSrc) {
                boss.style.backgroundImage = `url("${overrideSrc}")`;
                return;
            }

            const data = await loadCatalog();
            const postRefs = new Map();

            collectPosts(
                data?.catalogs || {},
                postRefs
            );

            const posts = [...postRefs.keys()].map(postId => ({
                postId,
                date: Y1Data.date(postId),
                number: getNumericIdOrder(postId)
            }));

            posts.sort((a, b) => {
                if (a.date !== b.date) {
                    return b.date.localeCompare(a.date);
                }

                if (a.number !== b.number) {
                    return b.number - a.number;
                }

                return b.postId.localeCompare(a.postId);
            });

            const newest = posts[0];
            if (!newest) {
                throw new Error("No catalog post is available.");
            }

            // Index hero cover only: use the original image from
            // Codex-Img-hd for maximum visual quality.
            // The normal homepage list below continues to use Codex-Img.
            const originalSrc = await loadOriginalCover(
                newest.postId,
                1
            );

            const src = originalSrc || (
                window.YURI1Cover?.src
                    ? window.YURI1Cover.src(newest.postId, 1)
                    : Y1Data.image(newest.postId,1,true)
            );

            boss.style.backgroundImage = `url("${src}")`;
        } catch (error) {
            // Keep cover-def.jpg as the emergency fallback only.
            throw error;
        }
    }

    async function loadOptionalIndexCover() {
        const candidates = [
            "./config/img/yuri1-index.jpg",
            "./config/img/yuri1-index.jpeg",
            "./config/img/yuri1-index.png",
            "./config/img/yuri1-index.webp"
        ];

        for (const src of candidates) {
            try {
                await new Promise((resolve, reject) => {
                    const image = new Image();
                    image.onload = () => resolve();
                    image.onerror = () => reject(new Error("Image unavailable"));
                    image.src = src;
                });
                return src;
            } catch (error) {
                // Try the next extension.
            }
        }

        return null;
    }

    async function loadOriginalCover(postId,number=1){await Y1Data.ready;return Y1Data.images(postId).length?Y1Data.image(postId,number):null}

    function getNumericIdOrder(postId){return Number(String(postId).slice(11,14))}

    loadPosts()
        .then(posts => {
            renderPosts(posts);
        })
        .catch(error => {
            console.error("Candy Loader:", error);
            river.querySelectorAll(".candy-guideline").forEach(node => node.remove());
        });

    async function loadPosts() {
        const data = await loadCatalog();

        const postRefs = new Map();

        collectPosts(
            data?.catalogs || {},
            postRefs
        );

        // Homepage is intentionally restricted to:
        // 1) The two newest News entries (date + issue number).
        // 2) Every story Post, newest to oldest.
        // Policy, feature, guide and IP entries remain accessible in Codex.
        // Use canonical *storage filenames* rather than Catalog group labels,
        // so reorganizing the Catalog cannot silently change the homepage.
        const storageIds = [...postRefs.keys()];
        const newsIds = storageIds
            .filter(id => Y1Data.isNews(id))
            .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
            .slice(0, 2);
        const storyIds = storageIds
            .filter(id => !Y1Data.isNews(id))
            .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

        const orderedIds = [...newsIds, ...storyIds];
        const loaded = await loadPostData(
            orderedIds.map(id => [id, postRefs.get(id)])
        );
        // Fetches finish in arbitrary order, so restore the requested order.
        const byStorageId = new Map(loaded.map(post => [post.id, post]));
        return orderedIds.map(id => byStorageId.get(id)).filter(Boolean);
    }

    function collectPosts(catalogs, postRefs) {
        for (const node of Object.values(catalogs || {})) {
            if (Array.isArray(node?.posts)) {
                node.posts.forEach(postRef => {
                    const storageId = getCatalogPostStorageId(postRef);
                    if (!storageId || postRefs.has(storageId)) return;

                    postRefs.set(
                        storageId,
                        getCatalogPostPublicId(postRef)
                    );
                });
            }

            if (
                node?.children &&
                typeof node.children === "object"
            ) {
                collectPosts(
                    node.children,
                    postRefs
                );
            }
        }
    }

    async function loadPostData(postRefs) {
        const posts = [];

        await Promise.all(
            postRefs.map(async ([postId, publicId]) => {
                try {
                    const response = await Y1Data.request(
                        `record:${encodeURIComponent(postId)}`
                    );

                    if (!response.ok) return;

                    const data =
                        await response.json();

                    if (
                        data &&
                        data.id === postId
                    ) {
                        posts.push({
                            id: postId,
                            publicId: publicId || getCatalogPostPublicId(postId),
                            title:
                                data.title ||
                                postId
                        });
                    }

                } catch (error) {
                    console.warn(
                        `Candy: unable to load ${postId}`,
                        error
                    );
                }
            })
        );

        return posts;
    }

    function renderPosts(posts) {
        const intro = river.querySelector(".candy-intro");
        river.replaceChildren();
        if (intro) river.appendChild(intro);

        posts.forEach(post => {

            const row =
                document.createElement("div");

            row.className = Y1Data.isNews(post.id)
                ? "candy-guideline candy-news"
                : "candy-guideline candy-post";

            const link =
                document.createElement("a");

            link.className =
                "post-link index";

            link.href =
                `get/${encodeURIComponent(post.publicId || getCatalogPostPublicId(post.id))}.html`;

            const imageBlock =
                document.createElement("div");

            imageBlock.className =
                "post-image index";

            const image =
                document.createElement("img");

            image.className =
                "post index";

            image.alt =
                post.title;

            image.loading =
                "lazy";

            image.decoding =
                "async";

            image.addEventListener(
                "error",
                () => imageBlock.remove(),
                { once: true }
            );

            image.src =
                Y1Data.image(post.id,1,true);

            imageBlock.appendChild(image);

            const titleBlock =
                document.createElement("div");

            titleBlock.className =
                "post-title index";

            const title =
                document.createElement("h3");

            title.textContent =
                post.title;

            titleBlock.appendChild(title);

            link.appendChild(imageBlock);
            link.appendChild(titleBlock);

            row.appendChild(link);

            river.appendChild(row);
        });
    }

}).catch(error=>console.error(error));