(() => {
    const root = document.getElementById("post-loader");
    if (!root) return;

    const params =
        new URLSearchParams(
            window.location.search
        );

    const requestedId =
        params.get("id");

    if (!requestedId) {
        root.textContent = "Post ID not found.";
        return;
    }

    let catalogDataPromise = null;
    let tagDataPromise = null;
    let resolvedStorageId = requestedId;
    let resolvedPublicId = requestedId;

    function loadFreshJSON(path) {
        return fetch(path, { cache: "no-cache" }).then(async response => {
            if (!response.ok) {
                throw new Error(`JSON request failed (${response.status}): ${path}`);
            }
            return response.json();
        });
    }

    function getCatalogData() {
        if (!catalogDataPromise) {
            catalogDataPromise =
                loadFreshJSON(
                    "codex-w/w-catalog.json"
                );
        }

        return catalogDataPromise;
    }

    let catalogPostStorageToPublic = new Map();
    let catalogPostPublicToStorage = new Map();
    let catalogIndexReady = false;

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
            if (explicitId) {
                return explicitId;
            }
        }

        return getPublicPostId(
            getCatalogPostStorageId(postRef)
        );
    }

    function indexCatalogPostIds(catalogs) {
        catalogPostStorageToPublic = new Map();
        catalogPostPublicToStorage = new Map();

        function walk(nodes) {
            if (!nodes || typeof nodes !== "object" || Array.isArray(nodes)) {
                return;
            }

            for (const node of Object.values(nodes)) {
                if (!node || typeof node !== "object") {
                    continue;
                }

                if (Array.isArray(node.posts)) {
                    for (const postRef of node.posts) {
                        const storage = getCatalogPostStorageId(postRef);
                        const publicValue = getCatalogPostPublicId(postRef);
                        if (!storage || !publicValue) continue;
                        catalogPostStorageToPublic.set(storage, publicValue);
                        catalogPostPublicToStorage.set(publicValue, storage);
                    }
                }

                walk(node.children);
            }
        }

        walk(catalogs);
        catalogIndexReady = true;
    }

    function getTagData() {
        if (!tagDataPromise) {
            tagDataPromise =
                loadFreshJSON(
                    "codex-w/w-tag.json"
                );
        }

        return tagDataPromise;
    }

    function getPublicPostId(
        postId
    ) {
        const value =
            String(postId || "");

        const fixedPublicId =
            catalogPostStorageToPublic.get(value);

        if (fixedPublicId) {
            return fixedPublicId;
        }

        let match =
            value.match(
                /^news-(\d{6})-(\d{2})$/
            );

        if (match) {
            return `N${match[1]}-${match[2]}`;
        }

        match =
            value.match(
                /^post-(\d{8})-(\d{2})(?:-|$)/
            );

        if (match) {
            return `P${match[1]}-${match[2]}`;
        }

        return value;
    }

    function getPostIdCandidates(
        publicId
    ) {
        const value =
            String(publicId || "");

        const candidates = [];

        const fixedStorageId =
            catalogPostPublicToStorage.get(value);

        if (fixedStorageId) {
            candidates.push(fixedStorageId);
        }

        /*
         * News:
         *   N260929-01 -> ~260929-01
         */
        let match =
            value.match(
                /^N(\d{6})-(\d{2})$/
            );

        if (match) {
            candidates.push(
                `news-${match[1]}-${match[2]}`
            );
        }

        /*
         * Novel / Post:
         *   P20260929-02 -> 20260929-02
         */
        match =
            value.match(
                /^P(\d{8})-(\d{2})$/
            );

        if (match) {
            candidates.push(
                `post-${match[1]}-${match[2]}`
            );
        }

        if (!candidates.includes(value)) {
            candidates.push(value);
        }

        return [...new Set(candidates)];
    }

    async function tryLoadPostJSON(
        postId
    ) {
        try {
            const response =
                await fetch(
                    `codex-text/${encodeURIComponent(
                        postId
                    )}.json`,
                    {
                        cache: "no-cache"
                    }
                );

            if (!response.ok) {
                return null;
            }

            const data =
                await response.json();

            if (
                !data ||
                data.id !== postId
            ) {
                return null;
            }

            return data;
        } catch {
            return null;
        }
    }

    function findLegacyPostId(
        catalogs,
        publicId
    ) {
        const match =
            String(publicId || "")
                .match(
                    /^P(\d{8})-(\d{2})$/
                );

        if (!match) {
            return "";
        }

        const base =
            `post-${match[1]}-${match[2]}`;

        function walk(
            nodes
        ) {
            if (
                !nodes ||
                typeof nodes !== "object" ||
                Array.isArray(nodes)
            ) {
                return "";
            }

            for (const node of Object.values(nodes)) {
                if (!node || typeof node !== "object") {
                    continue;
                }

                if (Array.isArray(node.posts)) {
                    for (const postRef of node.posts) {
                        const value =
                            getCatalogPostStorageId(
                                postRef
                            );

                        if (
                            value === base ||
                            value.startsWith(
                                `${base}-`
                            )
                        ) {
                            return value;
                        }
                    }
                }

                const child =
                    walk(node.children);

                if (child) {
                    return child;
                }
            }

            return "";
        }

        return walk(catalogs);
    }

    async function resolvePost(
        publicOrStorageId
    ) {
        const requested =
            String(
                publicOrStorageId || ""
            );

        if (!catalogIndexReady) {
            indexCatalogPostIds(
                (await getCatalogData())?.catalogs || {}
            );
        }

        for (
            const candidate
            of getPostIdCandidates(requested)
        ) {
            const data =
                await tryLoadPostJSON(
                    candidate
                );

            if (data) {
                return {
                    storageId: candidate,
                    publicId: getPublicPostId(
                        candidate
                    ),
                    data
                };
            }
        }

        /*
         * Existing Novel JSON files may still use the legacy
         * human-readable suffix. Resolve those only as a compatibility
         * fallback through W-Catalog; new files do not need this.
         */
        const legacyId =
            findLegacyPostId(
                (await getCatalogData())?.catalogs || {},
                requested
            );

        if (legacyId) {
            const data =
                await tryLoadPostJSON(
                    legacyId
                );

            if (data) {
                return {
                    storageId: legacyId,
                    publicId: getPublicPostId(
                        legacyId
                    ),
                    data
                };
            }
        }

        return null;
    }

    resolvePost(requestedId)
        .then(result => {
            if (!result) {
                throw new Error(
                    `Post not found: ${requestedId}`
                );
            }

            resolvedStorageId =
                result.storageId;

            resolvedPublicId =
                result.publicId;

            // Provide the resolved public/storage pair to Reader so a
            // manually selected Backup Card cover can still address the
            // real legacy filename used in Codex-Img / Codex-Img-hd.
            window.YURI1PostStorageId =
                resolvedStorageId;
            window.YURI1PostPublicId =
                resolvedPublicId;

            /*
             * Canonicalize old / storage-facing URLs without
             * reloading the page. This keeps the existing JSON file
             * untouched while giving SEO/GA a stable public URL.
             */
            if (
                resolvedPublicId !==
                requestedId
            ) {
                const url =
                    new URL(
                        window.location.href
                    );

                url.searchParams.set(
                    "id",
                    resolvedPublicId
                );

                window.history.replaceState(
                    null,
                    "",
                    url
                );
            }

            renderPost(
                result.data,
                resolvedStorageId,
                resolvedPublicId
            );
        })
        .catch(error => {
            root.textContent =
                error.message;
        });

    async function renderPost(
        data,
        storageId,
        publicId
    ) {
        const catalog = document.querySelector(".post-catalog.post");
        const images = root.querySelector(".post-images.post");
        const date = root.querySelector(".post-date.post");
        const title = root.querySelector(".post-title.post");
        const content = root.querySelector(".post-text.post");
        const tag = root.querySelector(".post-tag.post");
        const readmore = root.querySelector(".post-readmore.post");
        const backto = root.querySelector(".post-backto.post");
        const relatedLinks = root.querySelector(".post-related.post");

        if (!catalog || !images || !date || !title || !content || !tag || !readmore || !backto || !relatedLinks) {
            throw new Error("Post Loader DOM structure is incomplete.");
        }

        updatePostMetadata(
            data,
            storageId,
            publicId
        );

        // Let the consent/analytics loader know the final dynamic page title
        // is ready before Google Analytics sends its automatic page_view.
        window.__YURI1_POST_ANALYTICS_READY = true;
        window.dispatchEvent(new CustomEvent("yuri1:post-ready", {
            detail: {
                title: document.title,
                publicId
            }
        }));

        await renderCatalog(
            catalog,
            storageId
        );
        renderImages(
            images,
            storageId
        );
        renderText(
            date,
            data.date || ""
        );
        renderTitle(
            title,
            data.title || ""
        );
        renderContent(
            content,
            data.content || ""
        );
        await renderTags(
            tag,
            storageId
        );
        renderRelatedLinks(
            relatedLinks,
            data.related_links
        );
        await renderReadmore(
            readmore,
            storageId
        );
        await renderBackTo(
            backto,
            storageId
        );
    }

    function updatePostMetadata(
        data,
        storageId,
        publicId
    ) {
        const siteName = "YURI NO1 – Girls Love ♡ AI Novels & Prompts";
        const pageTitle = data.title
            ? `${data.title} \\ ${siteName}`
            : siteName;

        const absoluteBase = "https://www.yuri1.com";
        const canonicalUrl =
            `${absoluteBase}/post.html?id=${encodeURIComponent(publicId)}`;
        const jsonUrl =
            `${absoluteBase}/codex-text/${encodeURIComponent(storageId)}.json`;

        document.title = pageTitle;

        const kind = String(publicId || "").charAt(0).toUpperCase();
        let description;
        let schemaType = "WebPage";
        let ogType = "website";

        switch (kind) {
            case "P":
                description = `${data.title || "YURI NO1 story"} — Girls' Love (Yuri) fiction from YURI NO1, created from human prompts with AI expansion.`;
                schemaType = "CreativeWork";
                ogType = "article";
                break;
            case "N":
                description = `${data.title || "YURI NO1 update"} — news and updates from YURI NO1.`;
                schemaType = "Article";
                ogType = "article";
                break;
            case "I":
                description = `${data.title || "YURI NO1 character"} — an original character profile from YURI NO1.`;
                break;
            case "Y":
                description = `${data.title || "YURI NO1 policy"} — YURI NO1 policy and site information.`;
                break;
            case "U":
                description = `${data.title || "YURI NO1 guide"} — YURI NO1 user guide and reading information.`;
                break;
            case "F":
                description = `${data.title || "YURI NO1 feature"} — information about YURI NO1 and its creative works.`;
                break;
            default:
                description = `${data.title || "YURI NO1"} — YURI NO1 Girls Love AI novels and prompts.`;
                break;
        }

        const setMeta = (selector, attrs) => {
            let node = document.head.querySelector(selector);
            if (!node) {
                node = document.createElement("meta");
                document.head.appendChild(node);
            }
            for (const [name, value] of Object.entries(attrs)) {
                node.setAttribute(name, value);
            }
        };

        setMeta('meta[name="description"]', {
            name: "description",
            content: description
        });
        setMeta('meta[property="og:title"]', {
            property: "og:title",
            content: data.title || siteName
        });
        setMeta('meta[property="og:description"]', {
            property: "og:description",
            content: description
        });
        setMeta('meta[property="og:url"]', {
            property: "og:url",
            content: canonicalUrl
        });
        setMeta('meta[property="og:type"]', {
            property: "og:type",
            content: ogType
        });
        setMeta('meta[name="twitter:title"]', {
            name: "twitter:title",
            content: data.title || siteName
        });
        setMeta('meta[name="twitter:description"]', {
            name: "twitter:description",
            content: description
        });
        setMeta('meta[name="yuri1:content-source"]', {
            name: "yuri1:content-source",
            content: jsonUrl
        });

        let canonical = document.getElementById("yuri1-canonical");
        if (!canonical) {
            canonical = document.createElement("link");
            canonical.id = "yuri1-canonical";
            canonical.rel = "canonical";
            document.head.appendChild(canonical);
        }
        canonical.href = canonicalUrl;

        let jsonAlternate = document.getElementById("yuri1-post-json-alternate");
        if (!jsonAlternate) {
            jsonAlternate = document.createElement("link");
            jsonAlternate.id = "yuri1-post-json-alternate";
            jsonAlternate.rel = "alternate";
            jsonAlternate.type = "application/json";
            jsonAlternate.title = "Machine-readable post data";
            document.head.appendChild(jsonAlternate);
        }
        jsonAlternate.href = jsonUrl;

        const dataLink = document.getElementById("yuri1-post-data-link");
        if (dataLink) {
            dataLink.href = jsonUrl;
            dataLink.type = "application/json";
            dataLink.title = "Machine-readable post data (JSON)";
        }

        const schema = {
            "@context": "https://schema.org",
            "@type": schemaType,
            "name": data.title || siteName,
            "url": canonicalUrl,
            "isAccessibleForFree": true,
            "isPartOf": {
                "@type": "WebSite",
                "name": "YURI NO1",
                "alternateName": "YURI1",
                "url": `${absoluteBase}/`
            },
            "encoding": {
                "@type": "MediaObject",
                "encodingFormat": "application/json",
                "contentUrl": jsonUrl
            }
        };

        if (kind === "P") {
            schema.genre = ["Girls' Love", "Yuri", "Fiction"];
            schema.contentRating = "16+ maximum";
        }

        if (data.date) {
            schema.datePublished = data.date;
        }

        let structured = document.getElementById("yuri1-structured-data");
        if (!structured) {
            structured = document.createElement("script");
            structured.id = "yuri1-structured-data";
            structured.type = "application/ld+json";
            document.head.appendChild(structured);
        }
        structured.textContent = JSON.stringify(schema);
    }

    async function renderCatalog(
        container,
        postId
    ) {
        const wrapper =
            container.querySelector(
                "span"
            );

        if (!wrapper) {
            return;
        }

        wrapper.textContent = "";

        const homeLink =
            document.createElement(
                "a"
            );

        homeLink.className =
            "post-catalog-link post";

        homeLink.textContent =
            "⛶ Home";

        homeLink.href =
            "index.html";

        wrapper.appendChild(
            homeLink
        );

        wrapper.appendChild(
            document.createTextNode(
                " "
            )
        );

        const codexLink =
            document.createElement(
                "a"
            );

        codexLink.className =
            "post-catalog-link post";

        codexLink.textContent =
            "𖤐 Codex";

        codexLink.href =
            "codex.html";

        wrapper.appendChild(
            codexLink
        );

        const getLink =
            document.createElement(
                "a"
            );

        getLink.className =
            "post-get-link post";

        getLink.href =
            "#";

        getLink.textContent =
            "⿻ Get post link";

        getLink.addEventListener(
            "click",
            async event => {
                event.preventDefault();

                const success =
                    await copyPostLink();

                showPostLinkNotice(
                    success
                        ? "◈ Link Copied ◈"
                        : "◈ Copy Failed ◈"
                );
            }
        );

        const getLinkWrapper =
            document.createElement(
                "span"
            );

        getLinkWrapper.appendChild(
            getLink
        );

        container.appendChild(
            getLinkWrapper
        );

        let topWrapper =
            container.querySelector(
                ".post-top-wrapper.post"
            );

        if (!topWrapper) {
            topWrapper =
                document.createElement(
                    "span"
                );

            topWrapper.className =
                "post-top-wrapper post";

            const topLink =
                document.createElement(
                    "a"
                );

            topLink.className =
                "post-top-link post";

            topLink.href =
                "#";

            topLink.textContent =
                "◌ TOP";

            topLink.addEventListener(
                "click",
                event => {
                    event.preventDefault();

                    window.scrollTo({
                        top: 0,
                        behavior: "smooth"
                    });
                }
            );

            topWrapper.appendChild(
                topLink
            );

            container.appendChild(
                topWrapper
            );
        }

        try {
            const data =
                await getCatalogData();

            const context =
                findCatalogContext(
                    data?.catalogs || {},
                    postId
                );

            if (!context) {
                return;
            }

            context.trail.forEach(
                (part, index) => {
                    wrapper.appendChild(
                        document.createTextNode(
                            " "
                        )
                    );

                    const link =
                        document.createElement(
                            "a"
                        );

                    link.className =
                        "post-catalog-link post";

                    link.textContent =
                        `✧ ${part.name}`;

                    link.href =
                        `codex.html?catalog=${encodeURIComponent(
                            part.id ||
                            part.path
                        )}`;

                    wrapper.appendChild(
                        link
                    );
                }
            );
        } catch (error) {
            console.error(
                "Post Catalog Loader:",
                error
            );
        }
    }


    async function copyPostLink() {
        const urlObject =
            new URL(
                window.location.href
            );

        urlObject.searchParams.set(
            "id",
            resolvedPublicId
        );

        const url =
            urlObject.toString();

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(url);
                return true;
            }
        } catch (error) {
            console.warn("Post Link Clipboard API:", error);
        }

        try {
            const textarea = document.createElement("textarea");
            textarea.value = url;
            textarea.setAttribute("readonly", "");
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";
            textarea.style.pointerEvents = "none";

            document.body.appendChild(textarea);
            textarea.select();
            textarea.setSelectionRange(0, textarea.value.length);

            const success = document.execCommand("copy");
            textarea.remove();

            return success;
        } catch (error) {
            console.error("Post Link Copy:", error);
            return false;
        }
    }

    function showPostLinkNotice(message) {
        const existing = document.querySelector(".post-link-notice.post");
        if (existing) existing.remove();

        const notice = document.createElement("div");
        notice.className = "post-link-notice post";
        notice.textContent = message;

        document.body.appendChild(notice);

        requestAnimationFrame(() => {
            notice.classList.add("is-visible");
        });

        setTimeout(() => {
            notice.classList.remove("is-visible");

            setTimeout(() => {
                notice.remove();
            }, 220);
        }, 900);
    }

    async function renderReadmore(
        container,
        postId
    ) {
        const previousWrapper =
            container.querySelector(
                "span:first-child"
            );

        const nextWrapper =
            container.querySelector(
                "span:last-child"
            );

        if (
            !previousWrapper ||
            !nextWrapper
        ) {
            return;
        }

        previousWrapper.textContent = "";
        nextWrapper.textContent = "";
        container.hidden = true;

        try {
            const data =
                await getCatalogData();

            const context =
                findCatalogContext(
                    data?.catalogs || {},
                    postId
                );

            if (!context) {
                return;
            }

            /*
             * Previous / Next is scoped to the current Catalog node.
             * This means future splits such as:
             *   News / Dev Log / Announcement
             * or
             *   Novel / Comic / a specific series
             * can remain independent without encoding that rule
             * into the Post filename.
             */
            const postIds =
                Array.isArray(
                    context.node?.posts
                )
                    ? [...new Set(
                        context.node.posts
                            .map(
                                getCatalogPostStorageId
                            )
                            .filter(Boolean)
                    )]
                    : [];

            postIds.sort(
                (a, b) => {
                    const keyA =
                        getReadmoreSortKey(a);

                    const keyB =
                        getReadmoreSortKey(b);

                    return (
                        keyA.date.localeCompare(
                            keyB.date
                        ) ||
                        keyA.number -
                            keyB.number ||
                        a.localeCompare(b)
                    );
                }
            );

            const currentIndex =
                postIds.indexOf(
                    String(postId)
                );

            if (
                currentIndex === -1
            ) {
                return;
            }

            const previousId =
                postIds[
                    currentIndex - 1
                ];

            const nextId =
                postIds[
                    currentIndex + 1
                ];

            if (previousId) {
                previousWrapper.appendChild(
                    createReadmoreLink(
                        previousId,
                        "‹ Previous",
                        "post-prev-link post"
                    )
                );
            }

            if (nextId) {
                nextWrapper.appendChild(
                    createReadmoreLink(
                        nextId,
                        "Next ›",
                        "post-next-link post"
                    )
                );
            }

            if (
                previousId ||
                nextId
            ) {
                container.hidden = false;
            }
        } catch (error) {
            console.error(
                "Post Readmore Loader:",
                error
            );
        }
    }


    async function renderBackTo(
        container,
        postId
    ) {
        const codexWrapper =
            container.querySelector(
                "span:first-child"
            );

        const parentWrapper =
            container.querySelector(
                "span:last-child"
            );

        if (
            !codexWrapper ||
            !parentWrapper
        ) {
            return;
        }

        codexWrapper.textContent = "";
        parentWrapper.textContent = "";
        container.hidden = true;

        codexWrapper.appendChild(
            createBackToLink(
                "codex.html",
                "‹ Back to Codex",
                "post-backto-codex post"
            )
        );

        try {
            const data =
                await getCatalogData();

            const context =
                findCatalogContext(
                    data?.catalogs || {},
                    postId
                );

            if (context) {
                parentWrapper.appendChild(
                    createBackToLink(
                        `codex.html?catalog=${encodeURIComponent(
                            context.leafId
                        )}`,
                        `Back to ${context.leafName} ›`,
                        "post-backto-parent post"
                    )
                );
            }

            container.hidden = false;
        } catch (error) {
            console.error(
                "Post BackTo Loader:",
                error
            );

            container.hidden = false;
        }
    }


    function createBackToLink(
        href,
        text,
        className
    ) {
        const link =
            document.createElement(
                "a"
            );

        link.className =
            className;

        link.href =
            href;

        link.textContent =
            text;

        return link;
    }


    function getReadmoreSortKey(
        postId
    ) {
        const match =
            String(postId)
                .match(
                    /^(?:news-|post-)(\d{6}|\d{8})-(\d{2})(?:-|$)/
                );

        if (!match) {
            return {
                date: "",
                number:
                    Number.MAX_SAFE_INTEGER
            };
        }

        return {
            date:
                match[1],
            number:
                Number(match[2])
        };
    }


    function createReadmoreLink(
        postId,
        text,
        className
    ) {
        const link =
            document.createElement(
                "a"
            );

        link.className =
            className;

        link.href =
            `post.html?id=${encodeURIComponent(
                getPublicPostId(postId)
            )}`;

        link.textContent =
            text;

        return link;
    }


    function findCatalogContext(
        catalogs,
        postId
    ) {
        function walk(
            nodes,
            trail = []
        ) {
            if (
                !nodes ||
                typeof nodes !== "object" ||
                Array.isArray(nodes)
            ) {
                return null;
            }

            for (
                const [name, node]
                of Object.entries(nodes)
            ) {
                if (
                    !node ||
                    typeof node !== "object"
                ) {
                    continue;
                }

                const current =
                    {
                        name,
                        id: String(
                            node.id ||
                            ""
                        ),
                        path:
                            trail.length
                                ? `${
                                    trail[
                                        trail.length - 1
                                    ].path
                                }/${name}`
                                : name,
                        node
                    };

                const nextTrail =
                    [
                        ...trail,
                        current
                    ];

                if (
                    Array.isArray(
                        node.posts
                    ) &&
                    node.posts.some(
                        postRef =>
                            getCatalogPostStorageId(
                                postRef
                            ) ===
                            String(postId)
                    )
                ) {
                    const root =
                        nextTrail[0];

                    const visibleTrail = [];

                    // The first Catalog entry is a namespace (N/P/F/U/I/Y),
                    // so it is never shown in the Post breadcrumb.
                    nextTrail.slice(1).forEach(part => {
                        const previous = visibleTrail[visibleTrail.length - 1];
                        // Structural nodes may intentionally reuse the same
                        // display name. Keep the deepest matching node so the
                        // breadcrumb links to the real selectable Catalog ID.
                        if (previous && previous.name === part.name) {
                            visibleTrail[visibleTrail.length - 1] = part;
                        } else {
                            visibleTrail.push(part);
                        }
                    });

                    return {
                        trail:
                            visibleTrail,
                        node,
                        leafName:
                            name,
                        leafId:
                            current.id ||
                            current.path,
                        rootId:
                            root.id ||
                            root.path
                    };
                }

                const child =
                    walk(
                        node.children,
                        nextTrail
                    );

                if (child) {
                    return child;
                }
            }

            return null;
        }

        return walk(catalogs);
    }


    function renderImages(container, postId) {
        container.textContent = "";

        let imageNumber = 1;

        const loadNext = () => {
            const src =
                `codex-img-hd/${postId}-${imageNumber}.jpg`;

            const img = new Image();

            img.alt =
                `${postId} (${imageNumber})`;

            img.onload = () => {
                const imageBlock =
                    document.createElement("div");

                imageBlock.className =
                    "post-image post";

                imageBlock.appendChild(img);
                container.appendChild(imageBlock);

                imageNumber += 1;
                loadNext();
            };

            img.onerror = () => {
                // Image numbering is intentionally contiguous:
                // the first missing number ends the image sequence.
            };

            img.src = src;
        };

        loadNext();
    }

    function renderText(container, value) {
        const target =
            container.querySelector("span");

        if (target) {
            target.textContent = value;
        }
    }

    function renderTitle(container, value) {
        const target =
            container.querySelector("h2");

        if (target) {
            target.textContent = value;
        }
    }

    function renderContent(container, value) {
        const target =
            container.querySelector("p");

        const normalized = String(value || "")
            .replace(/\r\n|\r/g, "\n");

        // Store the source text as generic Post data.
        // Optional plug-ins can interpret this without Post Loader knowing how.
        container.dataset.rawContent = normalized;

        if (target) {
            target.remove();

            const lines = normalized.split("\n");
            let block = createContentBlock();

            lines.forEach((line, index) => {
                // A standalone --- becomes a real horizontal rule.
                // This is intentionally line-based so normal hyphens are untouched.
                if (line.trim() === "---") {
                    if (block.hasChildNodes()) {
                        container.appendChild(block);
                        block = createContentBlock();
                    }

                    container.appendChild(
                        document.createElement("hr")
                    );

                    return;
                }

                appendInlineMarkup(block, line);

                if (index < lines.length - 1 && lines[index + 1].trim() !== "---") {
                    block.appendChild(
                        document.createElement("br")
                    );
                }
            });

            if (block.hasChildNodes() || lines.length === 0) {
                container.appendChild(block);
            }
        }

        document.dispatchEvent(
            new CustomEvent("post:content-ready")
        );
    }

    function createContentBlock() {
        const block = document.createElement("p");
        block.className = "post-content-block post";
        return block;
    }

    function appendInlineMarkup(parent, line) {
        let rest = String(line || "");
        const tokenPattern = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/;

        while (rest) {
            const match = rest.match(tokenPattern);

            if (!match) {
                parent.appendChild(
                    document.createTextNode(rest)
                );
                return;
            }

            const index = match.index;

            if (index > 0) {
                parent.appendChild(
                    document.createTextNode(
                        rest.slice(0, index)
                    )
                );
            }

            const token = match[0];
            const strong = token.startsWith("**");
            const element = document.createElement(
                strong ? "strong" : "em"
            );

            element.textContent = strong
                ? token.slice(2, -2)
                : token.slice(1, -1);

            parent.appendChild(element);
            rest = rest.slice(index + token.length);
        }
    }

    function renderRelatedLinks(container, value) {
        const wrapper =
            container.querySelector("span");

        if (!wrapper) return;

        wrapper.textContent = "";

        if (
            !Array.isArray(value) ||
            value.length === 0
        ) {
            container.hidden = true;
            return;
        }

        container.hidden = false;

        value.forEach((item, index) => {
            if (!item || !item.url) return;

            if (index === 0) {
                const label =
                    document.createElement("span");

                label.className =
                    "post-related-label";

                label.textContent =
                    "Related Links:";

                wrapper.appendChild(label);
                wrapper.appendChild(
                    document.createElement("br")
                );
            }

            const link =
                document.createElement("a");

            link.className =
                "post-related-link post";

            link.href = item.url;
            link.textContent = item.label || item.text || item.url;

            if (item._blank === true) {
                link.target = "_blank";
                link.rel = "noopener";
            }

            wrapper.appendChild(link);

            if (index < value.length - 1) {
                wrapper.appendChild(
                    document.createTextNode(" ")
                );
            }
        });
    }

    async function renderTags(container, postId) {
        const wrapper =
            container.querySelector("span");

        if (!wrapper) return;

        wrapper.textContent = "";

        try {
            const data = await getTagData();

            const tagEntries = [];

            for (
                const [tagName, node]
                of Object.entries(data?.tags || {})
            ) {
                if (
                    !Array.isArray(node?.posts) ||
                    !node.posts.includes(postId)
                ) {
                    continue;
                }

                let tagId = tagName;

                for (const rawGroup of Object.values(data?.groups || {})) {
                    if (!Array.isArray(rawGroup)) {
                        continue;
                    }

                    const entry =
                        rawGroup.find(
                            item =>
                                typeof item === "object" &&
                                item !== null &&
                                String(item.name || "") === tagName
                        );

                    if (entry?.id) {
                        tagId =
                            String(entry.id);
                        break;
                    }
                }

                tagEntries.push({
                    name: tagName,
                    id: tagId
                });
            }

            tagEntries.forEach((tag, index) => {
                const link =
                    document.createElement("a");

                link.className =
                    "post-tag-link post";

                link.textContent =
                    tag.name;

                link.href =
                    `codex.html?tag=${encodeURIComponent(tag.id)}`;

                wrapper.appendChild(link);

                if (index < tagEntries.length - 1) {
                    wrapper.appendChild(
                        document.createTextNode(" ")
                    );
                }
            });

        } catch (error) {
            console.error(
                "Post Tag Loader:",
                error
            );
        }
    }
})();