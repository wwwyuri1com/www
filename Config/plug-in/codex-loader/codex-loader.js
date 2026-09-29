(() => {
    const catalogRoot =
        document.getElementById("codex-filter-catalog");

    const tagRoot =
        document.getElementById("codex-filter-tag");

    const resultRoot =
        document.querySelector(
            ".codex-boss .codex-loader.codex-banshee .codex-results"
        );

    const catalogTemplate =
        document.getElementById(
            "codex-catalog-template"
        );

    const postTemplate =
        document.getElementById(
            "codex-post-template"
        );

    if (
        !catalogRoot &&
        !tagRoot &&
        !resultRoot
    ) {
        return;
    }

    let catalogDataPromise = null;
    let tagDataPromise = null;
    let catalogPostMarks = new Map();
    let catalogNodeMarks = new Map();
    let catalogPostStorageToPublic = new Map();
    let catalogPostPublicToStorage = new Map();
    let tagFilterData = null;
    let tagFilterPopup = null;
    let activeTagSelection = [];
    let tagFilterCountRequest = 0;

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
            catalogDataPromise = loadFreshJSON("Codex-W/W-Catalog.json");
        }
        return catalogDataPromise;
    }

    function getTagData() {
        if (!tagDataPromise) {
            tagDataPromise = loadFreshJSON("Codex-W/W-Tag.json");
        }
        return tagDataPromise;
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
            if (!nodes || typeof nodes !== "object" || Array.isArray(nodes)) return;

            for (const node of Object.values(nodes)) {
                if (!node || typeof node !== "object") continue;

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
    }

    loadSelectors();


    async function loadSelectors() {
        try {
            const requests = [];


            if (catalogRoot) {
                requests.push(
                    getCatalogData()
                        .then(data =>
                            buildCatalogSelector(data)
                        )
                );
            }


            if (tagRoot) {
                requests.push(
                    getTagData()
                        .then(data =>
                            buildTagSelector(data)
                        )
                );
            }


            if (resultRoot) {
                requests.push(
                    getCatalogData()
                        .then(data => {
                            catalogPostMarks =
                                buildCatalogPostMarks(data);
                            catalogNodeMarks =
                                buildCatalogNodeMarks(data);
                            indexCatalogPostIds(data?.catalogs || {});

                            return loadCodexResult();
                        })
                        .then(() => {
                            renderStatusIcons();
                        })
                );
            }


            await Promise.all(requests);

        } catch (error) {
            console.error(
                "Codex-W:",
                error
            );
        }
    }


    async function loadCodexResult() {
        const params =
            new URLSearchParams(
                window.location.search
            );

        const catalogQuery =
            params.get("catalog");

        const tagQueries =
            params.getAll("tag").filter(Boolean);

        const hasTagQuery =
            tagQueries.length > 0;

        try {
            if (
                catalogQuery === "Favorite" &&
                !hasTagQuery
            ) {
                await renderFavoriteResult();
                return;
            }

            if (
                catalogQuery === "Hidden" &&
                !hasTagQuery
            ) {
                await renderHiddenResult();
                return;
            }

            const requests = [];

            if (catalogQuery !== null) {
                requests.push(
                    getCatalogData()
                        .then(data => ({
                            type: "catalog",
                            data
                        }))
                );
            }

            if (hasTagQuery) {
                requests.push(
                    getTagData()
                        .then(data => ({
                            type: "tag",
                            data
                        }))
                );
            }

            if (
                catalogQuery === null &&
                !hasTagQuery
            ) {
                requests.push(
                    getCatalogData()
                        .then(data => ({
                            type: "catalog-all",
                            data
                        }))
                );
            }

            const results =
                await Promise.all(requests);

            const result =
                results[0];

            if (!result) {
                renderMessage(
                    "Unable to load Codex."
                );
                return;
            }

            if (result.type === "tag") {
                activeTagSelection =
                    tagQueries.map(tag =>
                        resolveTagId(
                            result.data,
                            tag
                        )
                    );

                await renderTagResult(
                    result.data,
                    activeTagSelection
                );
            } else {
                activeTagSelection = [];
                await renderCatalogResult(
                    result.data,
                    catalogQuery
                );
            }

        } catch (error) {
            console.error(
                "Codex result:",
                error
            );
            renderMessage(
                "Unable to load Codex."
            );
        }
    }


    async function renderFavoriteBox() {
        const favoriteIds =
            getFavoritePostIds();

        if (favoriteIds.length === 0) {
            return;
        }

        const posts =
            await loadPostData(favoriteIds);

        const visiblePosts = [];

        for (const postId of favoriteIds) {
            const post =
                createPostElement(
                    postId,
                    posts.get(postId),
                    0
                );

            if (post) {
                visiblePosts.push(post);
            }
        }

        if (visiblePosts.length === 0) {
            return;
        }

        const box =
            document.createElement("div");

        box.className =
            "codex-favo-box";

        const title =
            document.createElement("div");

        title.className =
            "codex-favo-title";

        title.textContent =
            "♥︎ FAVO";

        box.appendChild(title);

        const list =
            document.createElement("div");

        list.className =
            "codex-favo-list";

        for (const post of visiblePosts) {
            list.appendChild(post);
        }

        box.appendChild(list);

        resultRoot.appendChild(box);
    }


    async function renderFavoriteResult() {
        clearResult();

        appendResultHeader("♥︎ FAVORITE");

        const favoriteIds = getFavoritePostIds();

        if (favoriteIds.length === 0) {
            renderMessage("No favorite posts.");
            return;
        }

        const posts = await loadPostData(favoriteIds);

        const postList =
            document.createElement("div");

        postList.className =
            "codex-post-list";

        for (const postId of favoriteIds) {
            const post =
                createPostElement(
                    postId,
                    posts.get(postId),
                    0
                );

            if (post) {
                postList.appendChild(post);
            }
        }

        if (postList.children.length === 0) {
            renderMessage("No favorite posts.");
            return;
        }

        resultRoot.appendChild(postList);
    }

    async function renderHiddenResult() {
        clearResult();

        appendResultHeader("◈ HIDDEN");

        const data = await getCatalogData();
        const postIds = collectCatalogPostIds(data?.catalogs || {});
        const hiddenIds = postIds.filter(postId => isCodexHidden(postId));

        if (hiddenIds.length === 0) {
            renderMessage("No hidden posts.");
            return;
        }

        const posts = await loadPostData(hiddenIds);
        const postList = document.createElement("div");
        postList.className = "codex-post-list";

        for (const postId of hiddenIds) {
            const post = createPostElement(
                postId,
                posts.get(postId),
                0,
                true
            );

            if (post) {
                postList.appendChild(post);
            }
        }

        if (postList.children.length === 0) {
            renderMessage("No hidden posts.");
            return;
        }

        resultRoot.appendChild(postList);
    }

    function getPostStateId(postId) {
        return getPublicPostId(postId);
    }

    function getPostStateKey(prefix, postId) {
        return `${prefix}${getPostStateId(postId)}`;
    }

    function getLegacyPostStateKey(prefix, postId) {
        const storageId = getCatalogPostStorageId(postId);
        const publicId = getPostStateId(storageId);

        if (!storageId || storageId === publicId) {
            return null;
        }

        return `${prefix}${storageId}`;
    }

    function hasPostState(prefix, postId) {
        const canonicalKey = getPostStateKey(prefix, postId);
        if (localStorage.getItem(canonicalKey) === "true") {
            return true;
        }

        const legacyKey = getLegacyPostStateKey(prefix, postId);
        return Boolean(legacyKey && localStorage.getItem(legacyKey) === "true");
    }

    function setPostState(prefix, postId, active) {
        const canonicalKey = getPostStateKey(prefix, postId);
        const legacyKey = getLegacyPostStateKey(prefix, postId);

        if (active) {
            localStorage.setItem(canonicalKey, "true");
            if (legacyKey) {
                localStorage.removeItem(legacyKey);
            }
            return;
        }

        localStorage.removeItem(canonicalKey);
        if (legacyKey) {
            localStorage.removeItem(legacyKey);
        }
    }

    function isCodexHidden(postId) {
        return hasPostState(
            "yuri1.reader.codex-hidden.",
            postId
        );
    }

    function collectCatalogPostIds(nodes, result = [], seen = new Set()) {
        if (!nodes || typeof nodes !== "object" || Array.isArray(nodes)) {
            return result;
        }

        for (const node of Object.values(nodes)) {
            if (!node || typeof node !== "object") continue;

            if (Array.isArray(node.posts)) {
                for (const postId of node.posts) {
                    const storageId = getCatalogPostStorageId(postId);
                    if (!storageId || seen.has(storageId)) continue;
                    seen.add(storageId);
                    result.push(storageId);
                }
            }

            collectCatalogPostIds(node.children, result, seen);
        }

        return result;
    }

    function getStorageIdFromPublicId(postId) {
        const value = String(postId || "");

        const fixedStorage = catalogPostPublicToStorage.get(value);
        if (fixedStorage) {
            return fixedStorage;
        }

        let match = value.match(/^N(\d{6})-(\d{2})$/);
        if (match) {
            return `~${match[1]}-${match[2]}`;
        }

        match = value.match(/^P(\d{8})-(\d{2})$/);
        if (match) {
            return `${match[1]}-${match[2]}`;
        }

        return value;
    }

    function getFavoritePostIds() {
        const prefix =
            "yuri1.reader.favorite.";

        const ids = [];
        const seenPublicIds = new Set();

        for (let index = 0; index < localStorage.length; index++) {
            const key = localStorage.key(index);

            if (!key || !key.startsWith(prefix)) {
                continue;
            }

            if (localStorage.getItem(key) !== "true") {
                continue;
            }

            const stateId = key.slice(prefix.length);
            if (!stateId) continue;

            const publicId = getPostStateId(stateId);
            if (seenPublicIds.has(publicId)) continue;
            seenPublicIds.add(publicId);

            const storageId = getStorageIdFromPublicId(publicId);
            if (storageId && !ids.includes(storageId)) {
                ids.push(storageId);
            }
        }

        return ids;
    }

    async function renderCatalogResult(
        data,
        catalogQuery
    ) {
        clearResult();

        /*
         * Root Codex page:
         * show the user's favorites as a small
         * "user" style card above the normal Codex navigation.
         * This does not modify the Select UI.
         */
        if (
            catalogQuery === null &&
            new URLSearchParams(window.location.search).getAll("tag").filter(Boolean).length === 0
        ) {
            await renderFavoriteBox();
        }

        const title = "𖤐 Codex";

        appendResultHeader(title);

        const hidePosts =
            new Set(
                Array.isArray(
                    data?.selector?.hide_posts
                )
                    ? data.selector.hide_posts
                    : []
            );

        const separatorBefore =
            new Set(
                Array.isArray(
                    data?.selector?.separator_before
                )
                    ? data.selector.separator_before
                    : []
            );

        let node =
            data?.catalogs || {};

        if (
            catalogQuery &&
            catalogQuery !== "All"
        ) {
            const target =
                findCatalogTarget(
                    node,
                    catalogQuery
                );

            if (!target) {
                renderMessage(
                    "Catalog not found."
                );
                return;
            }

            if (target.id && String(target.id) !== String(catalogQuery)) {
                const canonicalURL = new URL(window.location.href);
                canonicalURL.searchParams.set("catalog", target.id);
                window.history.replaceState(null, "", canonicalURL);
            }

            await renderCatalogNode(
                target.name,
                target.node,
                target.path,
                0,
                true,
                false,
                false,
                target.id
            );
            return;
        }

        await renderCatalogNodes(
            node,
            "",
            true,
            hidePosts,
            separatorBefore
        );
    }


    async function renderCatalogNodes(
        nodes,
        parentPath = "",
        showAllRoots = false,
        hidePosts = new Set(),
        separatorBefore = new Set()
    ) {
        if (showAllRoots) {
            for (const [name, node] of Object.entries(nodes || {})) {
                if (!catalogHasPosts(node)) {
                    continue;
                }

                const entry = collapseSingleChildChain(
                    name,
                    node,
                    name
                );

                if (!entry) {
                    continue;
                }

                await renderCatalogNode(
                    entry.name,
                    entry.node,
                    entry.path,
                    0,
                    true,
                    hidePosts.has(name) || hidePosts.has(entry.name),
                    separatorBefore.has(name) || separatorBefore.has(entry.path),
                    entry.id
                );
            }

            return;
        }

        if (
            nodes &&
            typeof nodes === "object" &&
            !Array.isArray(nodes)
        ) {
            const name = getLastPathPart(parentPath);

            await renderCatalogNode(
                name,
                nodes,
                parentPath,
                0,
                true
            );
        }
    }


    async function renderCatalogNode(
        name,
        node,
        path,
        depth,
        showTitle = true,
        hideDirectPosts = false,
        separatorBefore = false,
        catalogId = ""
    ) {
        if (separatorBefore) {
            const divider =
                document.createElement("hr");

            divider.className =
                "codex-catalog-divider";

            resultRoot.appendChild(divider);
        }

        /*
         * Keep Codex rendering consistent with the
         * Catalog selector: empty Catalog branches
         * are hidden instead of being rendered.
         *
         * The Catalog ID still remains in W-Catalog,
         * even when its node has no Posts yet.
         */
        if (!catalogHasPosts(node)) {
            return;
        }

        const catalog =
            cloneTemplate(
                catalogTemplate
            );

        if (!catalog) {
            return;
        }

        const catalogTitle =
            catalog.querySelector(
                '[data-codex="catalog-title"]'
            );

        const catalogLink =
            catalog.querySelector(
                '[data-codex="catalog-link"]'
            );

        const catalogPrefix =
            catalog.querySelector(
                '[data-codex="catalog-prefix"]'
            );

        const catalogIcon =
            catalog.querySelector(
                '[data-codex="catalog-icon"]'
            );

        const catalogName =
            catalog.querySelector(
                '[data-codex="catalog-name"]'
            );

        if (
            showTitle &&
            catalogTitle &&
            catalogLink
        ) {
            const queryId =
                String(
                    catalogId ||
                    node?.id ||
                    path
                );

            catalogLink.href =
                `Codex.html?catalog=${encodeURIComponent(
                    queryId
                )}`;

            if (catalogPrefix) {
                catalogPrefix.textContent =
                    `${indent(depth)}✧`;
            }

            if (catalogName) {
                catalogName.textContent =
                    ` ${name}`;
            } else {
                catalogLink.appendChild(
                    document.createTextNode(
                        ` ${name}`
                    )
                );
            }

            const mark =
                catalogNodeMarks.get(path) ||
                catalogNodeMarks.get(name);

            if (catalogIcon) {
                catalogIcon.removeAttribute("data-lucide");
                catalogIcon.removeAttribute("style");
                catalogIcon.hidden = true;

                if (mark?.icon) {
                    catalogIcon.setAttribute(
                        "data-lucide",
                        mark.icon
                    );
                    catalogIcon.hidden = false;

                    if (mark.color) {
                        catalogIcon.style.color =
                            mark.color;
                    }
                }
            }
        } else if (catalogTitle) {
            catalogTitle.remove();
        }

        const postList =
            catalog.querySelector(
                '[data-codex="post-list"]'
            );

        const posts =
            Array.isArray(node?.posts)
                ? node.posts
                : [];

        if (
            postList &&
            posts.length > 0 &&
            !hideDirectPosts
        ) {
            const postData =
                await loadPostData(posts);

            for (const postRef of posts) {
                const storageId =
                    getCatalogPostStorageId(postRef);

                if (!storageId || isCodexHidden(storageId)) {
                    continue;
                }

                const post =
                    createPostElement(
                        storageId,
                        postData.get(storageId),
                        depth +
                            (showTitle ? 1 : 0),
                        false
                    );

                if (post) {
                    postList.appendChild(post);
                }
            }
        }

        resultRoot.appendChild(
            catalog
        );

        if (
            node?.children &&
            typeof node.children === "object"
        ) {
            for (
                const [
                    childName,
                    childNode
                ]
                of Object.entries(
                    node.children
                )
            ) {
                await renderCatalogNode(
                    childName,
                    childNode,
                    path
                        ? `${path}/${childName}`
                        : childName,
                    depth + 1,
                    true,
                    hideDirectPosts,
                    false,
                    String(
                        childNode?.id ||
                        ""
                    )
                );
            }
        }
    }


    async function renderTagResult(
        data,
        tags
    ) {
        clearResult();

        tagFilterData = data || tagFilterData || {};

        const selectedTags =
            Array.isArray(tags)
                ? tags
                    .filter(Boolean)
                    .map(tag =>
                        resolveTagId(
                            data,
                            tag
                        )
                    )
                : [];

        appendResultHeader(
            formatTagResultTitle(selectedTags)
        );

        if (selectedTags.length === 0) {
            renderMessage("Select at least one Tag.");
            return;
        }

        const postIds =
            getTagFilterPostIds(
                data,
                selectedTags
            );

        if (postIds.length === 0) {
            renderMessage(
                "No posts match these Tags."
            );
            return;
        }

        const posts =
            await loadPostData(
                postIds
            );

        const postList =
            document.createElement(
                "div"
            );

        postList.className =
            "codex-post-list";

        for (
            const postId
            of postIds
        ) {
            const post =
                createPostElement(
                    postId,
                    posts.get(postId),
                    0
                );

            if (post) {
                postList.appendChild(
                    post
                );
            }
        }

        if (postList.children.length === 0) {
            renderMessage(
                "No posts match these Tags."
            );
            return;
        }

        resultRoot.appendChild(
            postList
        );
    }


    function normalizeTagEntry(entry) {
        if (typeof entry === "string") {
            return {
                id: "",
                name: entry
            };
        }

        if (!entry || typeof entry !== "object") {
            return null;
        }

        return {
            id: String(entry.id || ""),
            name: String(entry.name || "")
        };
    }


    function getTagEntries(data) {
        const entries = [];

        for (const tags of Object.values(data?.groups || {})) {
            if (!Array.isArray(tags)) {
                continue;
            }

            for (const rawTag of tags) {
                const tag =
                    normalizeTagEntry(rawTag);

                if (
                    tag &&
                    tag.name
                ) {
                    entries.push(tag);
                }
            }
        }

        return entries;
    }


    function resolveTagName(data, ref) {
        const value = String(ref || "");

        const entry =
            getTagEntries(data).find(tag =>
                tag.id === value ||
                tag.name === value
            );

        if (entry) {
            return entry.name;
        }

        /*
         * Backward-compatible fallback for a historical
         * tag name that is still present in the posts map
         * but is no longer listed in the main groups.
         */
        if (
            Object.prototype.hasOwnProperty.call(
                data?.tags || {},
                value
            )
        ) {
            return value;
        }

        return value;
    }


    function resolveTagId(data, ref) {
        const value = String(ref || "");

        const entry =
            getTagEntries(data).find(tag =>
                tag.id === value ||
                tag.name === value
            );

        return entry?.id || value;
    }


    function formatTagLabel(tag) {
        const name =
            resolveTagName(
                tagFilterData || {},
                tag
            );

        return /^\p{Extended_Pictographic}/u.test(name)
            ? name
            : `#${name}`;
    }


    function formatTagResultTitle(tags) {
        if (!tags.length) {
            return "✦ Tags";
        }

        if (tags.length <= 3) {
            return `✦ ${tags.map(formatTagLabel).join(" + ")}`;
        }

        return `✦ ${tags.slice(0, 2).map(formatTagLabel).join(" + ")} + ${tags.length - 2} more`;
    }


    function getSingleSelectGroups(data) {
        const configured =
            data?._filter_settings?.single_select_groups;

        return new Set(
            Array.isArray(configured)
                ? configured.map(String)
                : []
        );
    }


    function getTagFilterPostIds(data, selectedTags) {
        if (!Array.isArray(selectedTags) || selectedTags.length === 0) {
            return [];
        }

        const tagSets = [];
        let baseOrder = null;

        for (const tagRef of selectedTags) {
            const tagName =
                resolveTagName(
                    data,
                    tagRef
                );

            const posts =
                Array.isArray(data?.tags?.[tagName]?.posts)
                    ? data.tags[tagName].posts
                    : [];

            const set = new Set();
            const order = [];

            for (const postId of posts) {
                if (isCodexHidden(postId)) continue;
                const id = String(postId);
                if (set.has(id)) continue;
                set.add(id);
                order.push(id);
            }

            if (baseOrder === null) {
                baseOrder = order;
            }

            tagSets.push(set);

            if (set.size === 0) {
                return [];
            }
        }

        return baseOrder.filter(postId =>
            tagSets.every(set => set.has(postId))
        );
    }


    async function loadPostData(
        postIds
    ) {
        const dataMap =
            new Map();


        await Promise.all(
            postIds.map(
                async postRef => {
                    const postId =
                        getCatalogPostStorageId(postRef);

                    try {
                        const response =
                            await fetch(
                                `Codex-Text/${encodeURIComponent(
                                    postId
                                )}.json`
                            );


                        if (!response.ok) {
                            return;
                        }


                        const data =
                            await response.json();


                        if (
                            data &&
                            data.id === postId
                        ) {
                            dataMap.set(
                                postId,
                                data
                            );
                        }

                    } catch {
                        /*
                         * Keep the Post ID.
                         * Renderer will fall back
                         * to a readable ID.
                         */
                    }
                }
            )
        );


        return dataMap;
    }


    function renderStatusIcons() {
        if (
            window.lucide &&
            typeof window.lucide.createIcons ===
                "function"
        ) {
            window.lucide.createIcons();
        }
    }


    function buildCatalogPostMarks(data) {
        const map = new Map();
        const marks =
            data?.catalog_marks &&
            typeof data.catalog_marks === "object"
                ? data.catalog_marks
                : {};

        const resolveMark = (path, name, inherited) => {
            const raw =
                Object.prototype.hasOwnProperty.call(marks, path)
                    ? marks[path]
                    : Object.prototype.hasOwnProperty.call(marks, name)
                        ? marks[name]
                        : inherited;

            if (!raw) return null;

            if (typeof raw === "string") {
                return { icon: raw, color: "" };
            }

            return {
                icon: String(raw.icon || ""),
                color: String(raw.color || "")
            };
        };

        const walk = (nodes, parentPath = "", inherited = null) => {
            if (!nodes || typeof nodes !== "object" || Array.isArray(nodes)) {
                return;
            }

            for (const [name, node] of Object.entries(nodes)) {
                if (!node || typeof node !== "object") continue;

                const path =
                    parentPath
                        ? `${parentPath}/${name}`
                        : name;

                const mark =
                    resolveMark(path, name, inherited);

                if (mark && Array.isArray(node.posts)) {
                    for (const postRef of node.posts) {
                        const storageId =
                            getCatalogPostStorageId(
                                postRef
                            );

                        if (storageId && !map.has(storageId)) {
                            map.set(storageId, mark);
                        }
                    }
                }

                walk(node.children, path, mark);
            }
        };

        walk(data?.catalogs);
        return map;
    }


    function buildCatalogNodeMarks(data) {
        const map = new Map();
        const marks =
            data?.catalog_marks &&
            typeof data.catalog_marks === "object"
                ? data.catalog_marks
                : {};

        const resolveMark = (path, name, inherited) => {
            const raw =
                Object.prototype.hasOwnProperty.call(marks, path)
                    ? marks[path]
                    : Object.prototype.hasOwnProperty.call(marks, name)
                        ? marks[name]
                        : inherited;

            if (!raw) return null;

            if (typeof raw === "string") {
                return { icon: raw, color: "" };
            }

            return {
                icon: String(raw.icon || ""),
                color: String(raw.color || "")
            };
        };

        const walk = (nodes, parentPath = "", inherited = null) => {
            if (!nodes || typeof nodes !== "object" || Array.isArray(nodes)) {
                return;
            }

            for (const [name, node] of Object.entries(nodes)) {
                if (!node || typeof node !== "object") continue;

                const path =
                    parentPath
                        ? `${parentPath}/${name}`
                        : name;

                const mark =
                    resolveMark(path, name, inherited);

                if (mark) {
                    map.set(path, mark);
                    if (!map.has(name)) {
                        map.set(name, mark);
                    }
                }

                walk(node.children, path, mark);
            }
        };

        walk(data?.catalogs);
        return map;
    }


    function createPostElement(
        postId,
        data,
        depth,
        showSeriesIcon = true
    ) {
        const post =
            cloneTemplate(
                postTemplate
            );


        if (!post) {
            return null;
        }


        post.dataset.postId =
            postId;


        const imageBlock =
            post.querySelector(
                '[data-codex="post-image"]'
            );


        const image =
            post.querySelector(
                '[data-codex="post-image-link"]'
            );


        const titleLink =
            post.querySelector(
                '[data-codex="post-link"]'
            );


        const date =
            post.querySelector(
                '[data-codex="post-date"]'
            );


        const displayTitle =
            data?.title ||
            humanizeId(postId);


        if (imageBlock && image) {
            image.className =
                "post codex";

            image.alt =
                displayTitle;

            let coverNumber = window.YURI1Cover
                ? window.YURI1Cover.get(postId)
                : 1;

            const applyCover = number => {
                coverNumber = number;
                image.src = window.YURI1Cover
                    ? window.YURI1Cover.src(postId, number)
                    : `Codex-Img/${encodeURIComponent(postId)}%20(${number}).jpg`;
            };

            image.loading =
                "lazy";

            image.decoding =
                "async";

            image.addEventListener(
                "error",
                () => {
                    if (coverNumber !== 1) {
                        coverNumber = 1;
                        if (window.YURI1Cover) {
                            window.YURI1Cover.set(postId, 1);
                        }
                        applyCover(1);
                        return;
                    }

                    imageBlock.remove();
                }
            );

            applyCover(coverNumber);
        }


        const titleContainer =
            post.querySelector(
                '[data-codex="post-title"]'
            );

        if (titleContainer && showSeriesIcon) {
            const seriesIcon =
                document.createElement("i");

            seriesIcon.className =
                "codex-series-icon";

            seriesIcon.setAttribute(
                "aria-hidden",
                "true"
            );

            const mark =
                catalogPostMarks.get(postId);

            if (mark?.icon) {
                seriesIcon.setAttribute(
                    "data-lucide",
                    mark.icon
                );
            }

            if (mark?.color) {
                seriesIcon.style.color =
                    mark.color;
            }

            titleContainer.insertBefore(
                seriesIcon,
                titleLink || titleContainer.firstChild
            );
        }

        if (titleLink) {
            titleLink.href =
                `Post.html?id=${encodeURIComponent(
                    getPublicPostId(postId)
                )}`;

            titleLink.textContent =
                displayTitle;

            titleLink.dataset.readDoneText =
                displayTitle;
        }

        const donePrefix =
            "yuri1.reader.done.";

        const favoritePrefix =
            "yuri1.reader.favorite.";

        let isReadDone =
            hasPostState(donePrefix, postId);

        let isFavorite =
            hasPostState(favoritePrefix, postId);

        if (
            titleContainer &&
            isReadDone
        ) {
            titleContainer.classList.add(
                "is-read-done"
            );
        }

        /*
         * Fixed right-side metadata: <date> <favorite> <read-done>.
         * Both status buttons are always visible so every Codex row
         * keeps the same alignment. Clicking an icon toggles its state.
         */
        const meta =
            document.createElement("div");

        meta.className =
            "codex-post-meta";

        post.appendChild(meta);

        if (date) {
            meta.appendChild(date);
        }

        const createStatusButton = (
            type,
            iconName,
            statePrefix,
            active,
            activeLabel,
            inactiveLabel
        ) => {
            const button =
                document.createElement("button");

            button.type =
                "button";

            button.className =
                `codex-post-status-slot ${type}`;

            button.setAttribute(
                "aria-pressed",
                String(active)
            );

            button.setAttribute(
                "aria-label",
                active ? activeLabel : inactiveLabel
            );

            button.setAttribute(
                "title",
                active ? activeLabel : inactiveLabel
            );

            const icon =
                document.createElement("i");

            icon.setAttribute(
                "data-lucide",
                iconName
            );

            icon.className =
                "codex-post-status-icon";

            button.appendChild(
                icon
            );

            button.classList.toggle(
                "is-active",
                active
            );

            button.addEventListener(
                "click",
                event => {
                    event.preventDefault();
                    event.stopPropagation();

                    const current =
                        hasPostState(statePrefix, postId);

                    const next =
                        !current;

                    setPostState(
                        statePrefix,
                        postId,
                        next
                    );

                    button.classList.toggle(
                        "is-active",
                        next
                    );

                    button.setAttribute(
                        "aria-pressed",
                        String(next)
                    );

                    const label =
                        next
                            ? activeLabel
                            : inactiveLabel;

                    button.setAttribute(
                        "aria-label",
                        label
                    );

                    button.setAttribute(
                        "title",
                        label
                    );

                    if (
                        type ===
                        "read-done" &&
                        titleContainer
                    ) {
                        titleContainer.classList.toggle(
                            "is-read-done",
                            next
                        );
                    }
                }
            );

            meta.appendChild(
                button
            );
        };

        createStatusButton(
            "favorite",
            "book-heart",
            favoritePrefix,
            isFavorite,
            "Remove from favorites",
            "Add to favorites"
        );

        createStatusButton(
            "read-done",
            "book-check",
            donePrefix,
            isReadDone,
            "Mark as unread",
            "Mark as read"
        );

        if (date) {
            const dateText =
                data?.date || "";


            const span =
                date.querySelector(
                    "span"
                );


            if (span) {
                span.textContent =
                    dateText;

            } else {
                date.textContent =
                    dateText;
            }
        }


        if (depth > 0) {
            post.style.marginLeft =
                `${depth}em`;
        }


        return post;
    }


    function cloneTemplate(
        template
    ) {
        if (!template) {
            return null;
        }


        const fragment =
            template.content.cloneNode(
                true
            );


        return fragment.firstElementChild;
    }


    function clearResult() {
        if (!resultRoot) {
            return;
        }


        resultRoot.replaceChildren();
    }


    function appendResultHeader(
        text
    ) {
        if (!resultRoot) {
            return;
        }


        /*
         * Show Hidden
         * A fixed Codex utility entry, kept above Home.
         */
        const hiddenHeader =
            document.createElement(
                "div"
            );

        hiddenHeader.className =
            "codex-header codex-hidden-header";

        const hiddenLink =
            document.createElement(
                "a"
            );

        hiddenLink.href =
            "Codex.html?catalog=Hidden";

        const hiddenIcon =
            document.createElement(
                "i"
            );

        hiddenIcon.setAttribute(
            "data-lucide",
            "eye-off"
        );

        hiddenIcon.className =
            "codex-hidden-link-icon";

        hiddenLink.appendChild(
            hiddenIcon
        );

        hiddenLink.appendChild(
            document.createTextNode(
                " Show Hidden"
            )
        );

        hiddenHeader.appendChild(
            hiddenLink
        );

        resultRoot.appendChild(
            hiddenHeader
        );

        renderStatusIcons();


        /*
         * Home
         */
        const homeHeader =
            document.createElement(
                "div"
            );

        homeHeader.className =
            "codex-header";


        const homeLink =
            document.createElement(
                "a"
            );

        homeLink.href =
            "index.html";

        homeLink.textContent =
            "⛶ Home";


        homeHeader.appendChild(
            homeLink
        );

        resultRoot.appendChild(
            homeHeader
        );


        /*
         * Codex
         */
        const codexHeader =
            document.createElement(
                "div"
            );

        codexHeader.className =
            "codex-header";


        const codexLink =
            document.createElement(
                "a"
            );

        codexLink.href =
            "Codex.html?catalog=All";

        codexLink.textContent =
            "𖤐 Codex";


        codexHeader.appendChild(
            codexLink
        );

        resultRoot.appendChild(
            codexHeader
        );


        /*
         * Current result title
         *
         * Only add it when it is not
         * already the Codex root.
         */
        if (
            text &&
            text !== "𖤐 Codex"
        ) {
            const currentHeader =
                document.createElement(
                    "div"
                );

            currentHeader.className =
                "codex-header";

            currentHeader.textContent =
                text;

            resultRoot.appendChild(
                currentHeader
            );
        }
    }


    function renderMessage(
        text
    ) {
        if (!resultRoot) {
            return;
        }


        const message =
            document.createElement(
                "div"
            );

        message.className =
            "codex-message";

        message.textContent =
            text;


        resultRoot.appendChild(
            message
        );
    }


    function getCatalogChildren(node) {
        if (
            !node ||
            typeof node !== "object" ||
            !node.children ||
            typeof node.children !== "object" ||
            Array.isArray(node.children)
        ) {
            return [];
        }

        return Object.entries(node.children)
            .filter(([, child]) => child && typeof child === "object");
    }

    function collapseSingleChildChain(
        name,
        node,
        path
    ) {
        let currentName = String(name || "");
        let currentNode = node;
        let currentPath = String(path || currentName);

        while (
            currentNode &&
            typeof currentNode === "object" &&
            !Array.isArray(currentNode.posts) &&
            getCatalogChildren(currentNode).length === 1
        ) {
            const [childName, childNode] = getCatalogChildren(currentNode)[0];
            currentName = childName;
            currentNode = childNode;
            currentPath = currentPath
                ? `${currentPath}/${childName}`
                : childName;
        }

        return {
            id: String(currentNode?.id || currentPath),
            name: currentName,
            path: currentPath,
            node: currentNode
        };
    }

    function findCatalogTarget(
        catalogs,
        query
    ) {
        const value = String(query || "").trim();

        if (!value) {
            return null;
        }

        const parts = value
            .split("/")
            .filter(Boolean);

        function findByNamedPath(
            nodes,
            pathParts,
            parentPath = ""
        ) {
            if (
                !nodes ||
                typeof nodes !== "object" ||
                Array.isArray(nodes) ||
                pathParts.length === 0
            ) {
                return null;
            }

            const wanted = pathParts[0];

            for (const [name, node] of Object.entries(nodes)) {
                if (!node || typeof node !== "object") {
                    continue;
                }

                if (
                    name !== wanted &&
                    String(node.id || "") !== wanted
                ) {
                    continue;
                }

                const path = parentPath
                    ? `${parentPath}/${name}`
                    : name;

                if (pathParts.length === 1) {
                    return collapseSingleChildChain(
                        name,
                        node,
                        path
                    );
                }

                const child = findByNamedPath(
                    node.children,
                    pathParts.slice(1),
                    path
                );

                if (child) {
                    return child;
                }
            }

            return null;
        }

        if (parts.length === 1) {
            function walk(nodes, parentPath = "") {
                if (
                    !nodes ||
                    typeof nodes !== "object" ||
                    Array.isArray(nodes)
                ) {
                    return null;
                }

                for (const [name, node] of Object.entries(nodes)) {
                    if (!node || typeof node !== "object") {
                        continue;
                    }

                    const path = parentPath
                        ? `${parentPath}/${name}`
                        : name;

                    if (
                        name === value ||
                        String(node.id || "") === value
                    ) {
                        return collapseSingleChildChain(
                            name,
                            node,
                            path
                        );
                    }

                    const child = walk(node.children, path);
                    if (child) {
                        return child;
                    }
                }

                return null;
            }

            return walk(catalogs);
        }

        return findByNamedPath(catalogs, parts);
    }


    async function buildCatalogSelector(
        data
    ) {
        const select =
            catalogRoot.querySelector(
                "select"
            );

        if (!select) {
            return;
        }

        const placeholder =
            select.querySelector(
                'option[value=""]'
            );

        select.textContent = "";

        if (placeholder) {
            select.appendChild(
                placeholder
            );
        } else {
            const option =
                createOption(
                    "",
                    "⛛ Select Catalog",
                    "placeholder"
                );

            option.disabled =
                true;

            option.selected =
                true;

            option.hidden =
                true;

            select.appendChild(
                option
            );
        }

        select.appendChild(
            createOption(
                "Favorite",
                "♥︎ FAVORITE",
                "favorite",
                "Favorite"
            )
        );

        select.appendChild(
            createOption(
                "All",
                "𖤐 Codex",
                "catalog",
                "All"
            )
        );

        const printPosts =
            new Set(
                Array.isArray(
                    data?.selector?.print_posts
                )
                    ? data.selector.print_posts
                    : []
            );

        const hidePosts =
            new Set(
                Array.isArray(
                    data?.selector?.hide_posts
                )
                    ? data.selector.hide_posts
                    : []
            );

        const separatorBefore =
            new Set(
                Array.isArray(
                    data?.selector?.separator_before
                )
                    ? data.selector.separator_before
                    : []
            );

        const catalogs =
            data?.catalogs || {};

        const visibleCatalogs =
            Object.fromEntries(
                Object.entries(catalogs)
                    .filter(([, node]) =>
                        catalogHasPosts(node)
                    )
            );

        if (Object.keys(visibleCatalogs).length === 0) {
            catalogRoot.hidden = true;
            return;
        }

        catalogRoot.hidden = false;

        await appendCatalogRoots(
            select,
            visibleCatalogs,
            printPosts,
            hidePosts,
            separatorBefore
        );

        select.appendChild(
            createOption(
                "Hidden",
                "⛞ Show Hidden",
                "hidden",
                "Hidden"
            )
        );

        select.appendChild(
            createOption(
                "Home",
                "⛶ Home",
                "home",
                "Home"
            )
        );

        select.addEventListener(
            "change",
            () => {
                const option =
                    select.options[
                        select.selectedIndex
                    ];

                if (!option) {
                    return;
                }

                if (
                    option.dataset.type ===
                    "favorite"
                ) {
                    window.location.href =
                        "Codex.html?catalog=Favorite";
                    return;
                }

                if (
                    option.dataset.type ===
                    "hidden"
                ) {
                    window.location.href =
                        "Codex.html?catalog=Hidden";
                    return;
                }

                if (
                    option.dataset.type ===
                    "home"
                ) {
                    window.location.href =
                        "index.html";
                    return;
                }

                if (
                    option.dataset.type ===
                    "post"
                ) {
                    window.location.href =
                        `Post.html?id=${encodeURIComponent(
                            getPublicPostId(
                                option.value
                            )
                        )}`;
                    return;
                }

                if (
                    option.value ===
                    "All"
                ) {
                    window.location.href =
                        "Codex.html";
                    return;
                }

                window.location.href =
                    `Codex.html?catalog=${encodeURIComponent(
                        option.value
                    )}`;
            }
        );
    }


    async function appendCatalogRoots(
        select,
        catalogs,
        printPosts,
        hidePosts,
        separatorBefore
    ) {
        for (const [rootName, rootNode] of Object.entries(catalogs || {})) {
            if (!catalogHasPosts(rootNode)) {
                continue;
            }

            const entry = collapseSingleChildChain(
                rootName,
                rootNode,
                rootName
            );

            if (!entry || !catalogHasPosts(entry.node)) {
                continue;
            }

            await appendCatalogEntry(
                select,
                entry.name,
                entry.node,
                entry.path,
                0,
                printPosts,
                hidePosts,
                separatorBefore,
                rootName
            );
        }
    }

    async function appendCatalogs(
        select,
        catalogs,
        parentPath,
        depth,
        printPosts,
        hidePosts,
        separatorBefore
    ) {
        for (const [name, node] of Object.entries(catalogs || {})) {
            if (!catalogHasPosts(node)) {
                continue;
            }

            const path = parentPath
                ? `${parentPath}/${name}`
                : name;

            await appendCatalogEntry(
                select,
                name,
                node,
                path,
                depth,
                printPosts,
                hidePosts,
                separatorBefore,
                path
            );
        }
    }

    async function appendCatalogEntry(
        select,
        name,
        node,
        path,
        depth,
        printPosts,
        hidePosts,
        separatorBefore,
        separatorKey
    ) {
        const catalogId = String(node?.id || path);

        if (
            separatorBefore.has(separatorKey) ||
            separatorBefore.has(path) ||
            separatorBefore.has(name)
        ) {
            const separatorOption = document.createElement("option");
            separatorOption.disabled = true;
            separatorOption.textContent = "────────────";
            select.appendChild(separatorOption);
        }

        const catalogOption = createOption(
            catalogId,
            `${indent(depth)}✧ ${name}`,
            "catalog",
            path
        );

        select.appendChild(catalogOption);

        const posts = Array.isArray(node?.posts) ? node.posts : [];

        if (
            printPosts.has(path) &&
            !hidePosts.has(path) &&
            posts.length > 0
        ) {
            const titles = await loadPostTitles(posts);

            posts.forEach(postRef => {
                const storageId = getCatalogPostStorageId(postRef);
                if (!storageId) return;

                const publicId = getCatalogPostPublicId(postRef);

                select.appendChild(
                    createOption(
                        publicId,
                        `${indent(depth + 1)}✦ ${
                            titles.get(storageId) || humanizeId(storageId)
                        }`,
                        "post",
                        storageId
                    )
                );
            });
        }

        if (
            node?.children &&
            typeof node.children === "object"
        ) {
            await appendCatalogs(
                select,
                node.children,
                path,
                depth + 1,
                printPosts,
                hidePosts,
                separatorBefore
            );
        }
    }


    function catalogHasPosts(
        node
    ) {
        if (!node || typeof node !== "object") {
            return false;
        }

        if (
            Array.isArray(node.posts) &&
            node.posts.some(
                postRef => {
                    const postId = getCatalogPostStorageId(postRef);
                    return postId && !isCodexHidden(postId);
                }
            )
        ) {
            return true;
        }

        if (
            node.children &&
            typeof node.children === "object"
        ) {
            return Object.values(
                node.children
            ).some(
                child => catalogHasPosts(child)
            );
        }

        return false;
    }


    async function loadPostTitles(
        postIds
    ) {
        const titles =
            new Map();


        await Promise.all(
            postIds.map(
                async postRef => {
                    const postId =
                        getCatalogPostStorageId(
                            postRef
                        );

                    if (!postId) return;

                    try {
                        const response =
                            await fetch(
                                `Codex-Text/${encodeURIComponent(
                                    postId
                                )}.json`
                            );


                        if (!response.ok) {
                            return;
                        }


                        const data =
                            await response.json();


                        /*
                         * Only trust the title
                         * when the Post JSON
                         * confirms its own ID.
                         */
                        if (
                            data &&
                            data.id === postId &&
                            data.title
                        ) {
                            titles.set(
                                postId,
                                data.title
                            );
                        }

                    } catch {
                        /*
                         * Falls back to
                         * readable Post ID.
                         */
                    }
                }
            )
        );


        return titles;
    }


    function buildTagSelector(
        data
    ) {
        tagFilterData = data || {};

        const select =
            tagRoot.querySelector(
                "select"
            );

        if (!select) {
            return;
        }

        const placeholder =
            select.querySelector(
                'option[value=""]'
            );

        select.textContent = "";

        const placeholderOption =
            placeholder ||
            createOption(
                "",
                "⛛ Select Tag",
                "placeholder"
            );

        placeholderOption.disabled = true;
        placeholderOption.selected = true;
        placeholderOption.hidden = false;
        select.appendChild(placeholderOption);

        let visibleGroupCount = 0;

        for (
            const [groupName, rawTags]
            of Object.entries(
                data?.groups || {}
            )
        ) {
            if (!Array.isArray(rawTags)) {
                continue;
            }

            const tagEntries =
                rawTags
                    .map(normalizeTagEntry)
                    .filter(Boolean);

            const visibleTags =
                tagEntries.filter(tag =>
                    Array.isArray(
                        data?.tags?.[tag.name]?.posts
                    ) &&
                    data.tags[tag.name].posts.length > 0
                );

            if (visibleTags.length === 0) {
                continue;
            }

            const group =
                document.createElement(
                    "optgroup"
                );

            group.label =
                `✥ ${groupName}`;

            visibleTags.forEach(
                tag => {
                    group.appendChild(
                        createOption(
                            tag.id || tag.name,
                            `#${tag.name}`,
                            "tag",
                            tag.name
                        )
                    );
                }
            );

            select.appendChild(group);
            visibleGroupCount += 1;
        }

        tagRoot.hidden =
            visibleGroupCount === 0;

        const currentTags =
            new URLSearchParams(
                window.location.search
            ).getAll("tag").filter(Boolean);

        activeTagSelection =
            currentTags.map(tag =>
                resolveTagId(
                    data,
                    tag
                )
            );

        updateTagSelectSummary(
            select,
            activeTagSelection
        );

        /* Native SELECT remains underneath as the fallback layer. */
        select.onchange = () => {
            const option =
                select.options[
                    select.selectedIndex
                ];

            if (!option || option.dataset.type !== "tag") {
                return;
            }

            window.location.href =
                `Codex.html?tag=${encodeURIComponent(
                    option.value
                )}`;
        };

        installTagFilterTrigger(select);
        ensureTagFilterPopup();
    }


    function updateTagSelectSummary(
        select,
        selectedTags
    ) {
        const placeholder =
            select.querySelector(
                'option[value=""]'
            );

        if (!placeholder) {
            return;
        }

        if (!selectedTags.length) {
            placeholder.textContent =
                "⛛ Select Tag";
        } else if (selectedTags.length === 1) {
            placeholder.textContent =
                `⛛ ${formatTagLabel(selectedTags[0])}`;
        } else {
            placeholder.textContent =
                `⛛ ${selectedTags.length} Tags Selected`;
        }
    }


    function installTagFilterTrigger(select) {
        if (tagRoot.dataset.codexTagPopupReady === "true") {
            return;
        }

        tagRoot.dataset.codexTagPopupReady = "true";
        tagRoot.style.position = "relative";

        const trigger =
            document.createElement("button");

        trigger.type = "button";
        trigger.className = "codex-tag-filter-trigger";
        trigger.setAttribute(
            "aria-label",
            "Open Tag Filter"
        );
        trigger.setAttribute(
            "aria-haspopup",
            "dialog"
        );
        trigger.title = "Tag Filter";

        trigger.addEventListener(
            "click",
            openTagFilterPopup
        );

        tagRoot.appendChild(trigger);

        /* Keep the original SELECT in place for fallback / future rollback. */
        select.tabIndex = -1;
        select.setAttribute(
            "aria-hidden",
            "true"
        );
        select.style.pointerEvents = "none";
    }


    function ensureTagFilterPopup() {
        if (tagFilterPopup) {
            return;
        }

        const modal =
            document.createElement("div");

        modal.id = "codex-tag-filter-modal";
        modal.className =
            "reader-data-modal codex-tag-filter-modal";
        modal.hidden = true;
        modal.setAttribute(
            "aria-hidden",
            "true"
        );

        const backdrop =
            document.createElement("div");
        backdrop.className =
            "reader-data-modal-backdrop";

        const dialog =
            document.createElement("div");
        dialog.className =
            "reader-data-dialog codex-tag-filter-dialog";
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-modal", "true");
        dialog.setAttribute(
            "aria-labelledby",
            "codex-tag-filter-title"
        );

        const titleRow =
            document.createElement("div");
        titleRow.className =
            "codex-tag-filter-title-row";

        const title =
            document.createElement("div");
        title.id =
            "codex-tag-filter-title";
        title.className =
            "reader-data-dialog-title codex-tag-filter-title";
        title.textContent =
            "Tag Filter";

        const close =
            document.createElement("button");
        close.type = "button";
        close.className =
            "codex-tag-filter-close";
        close.setAttribute(
            "aria-label",
            "Close Tag Filter"
        );
        close.title = "Close";

        const closeIcon =
            document.createElement("i");
        closeIcon.setAttribute(
            "data-lucide",
            "x"
        );
        close.appendChild(closeIcon);
        close.addEventListener(
            "click",
            closeTagFilterPopup
        );

        titleRow.append(
            title,
            close
        );

        const selected =
            document.createElement("div");
        selected.id =
            "codex-tag-filter-selected";
        selected.className =
            "codex-tag-filter-selected";

        const groups =
            document.createElement("div");
        groups.id =
            "codex-tag-filter-groups";
        groups.className =
            "codex-tag-filter-groups";

        const note =
            document.createElement("div");
        note.className =
            "codex-tag-filter-note";
        note.textContent =
            "All selected Tags must match.";

        const match =
            document.createElement("div");
        match.id =
            "codex-tag-filter-match";
        match.className =
            "codex-tag-filter-match";

        const actions =
            document.createElement("div");
        actions.className =
            "reader-data-dialog-actions codex-tag-filter-actions";

        const confirm =
            document.createElement("button");
        confirm.type = "button";
        confirm.className =
            "reader-data-dialog-button primary codex-tag-filter-confirm";
        confirm.textContent = "Confirm";
        confirm.addEventListener(
            "click",
            confirmTagFilter
        );

        actions.appendChild(confirm);
        dialog.append(
            titleRow,
            groups,
            note,
            selected,
            match,
            actions
        );
        modal.append(
            backdrop,
            dialog
        );
        document.body.appendChild(modal);

        tagFilterPopup = {
            modal,
            dialog,
            selected,
            groups,
            match,
            confirm,
            close
        };

        renderStatusIcons();

        document.addEventListener(
            "keydown",
            event => {
                if (
                    event.key === "Escape" &&
                    !modal.hidden
                ) {
                    closeTagFilterPopup();
                }
            }
        );
    }


    function openTagFilterPopup() {
        ensureTagFilterPopup();

        if (!tagFilterPopup) {
            return;
        }

        const current =
            new URLSearchParams(
                window.location.search
            ).getAll("tag")
            .filter(Boolean)
            .map(tag =>
                resolveTagId(
                    tagFilterData || {},
                    tag
                )
            );

        tagFilterPopup.modal._draftTags =
            new Set(current);

        tagFilterPopup.modal.hidden = false;
        tagFilterPopup.modal.setAttribute(
            "aria-hidden",
            "false"
        );

        renderTagFilterPopup();

        requestAnimationFrame(() => {
            tagFilterPopup.close.focus();
        });
    }


    function closeTagFilterPopup() {
        if (!tagFilterPopup) {
            return;
        }

        tagFilterPopup.modal.hidden = true;
        tagFilterPopup.modal.setAttribute(
            "aria-hidden",
            "true"
        );
    }


    function renderTagFilterPopup() {
        if (!tagFilterPopup) {
            return;
        }

        const draft =
            tagFilterPopup.modal._draftTags ||
            new Set();

        tagFilterPopup.selected.replaceChildren();

        for (const tag of draft) {
            const chip =
                document.createElement("span");
            chip.className =
                "codex-tag-filter-chip";
            chip.textContent =
                formatTagLabel(tag);
            tagFilterPopup.selected.appendChild(chip);
        }

        tagFilterPopup.selected.hidden =
            draft.size === 0;

        tagFilterPopup.groups.replaceChildren();

        const data =
            tagFilterData || {};
        const singleSelectGroups =
            getSingleSelectGroups(data);

        for (const [groupName, rawTags] of Object.entries(data.groups || {})) {
            if (!Array.isArray(rawTags)) continue;

            const tagEntries =
                rawTags
                    .map(normalizeTagEntry)
                    .filter(Boolean);

            const visibleTags =
                tagEntries.filter(tag =>
                    Array.isArray(data?.tags?.[tag.name]?.posts) &&
                    data.tags[tag.name].posts.length > 0
                );

            if (!visibleTags.length) continue;

            const isSingleSelect =
                singleSelectGroups.has(groupName);

            const group =
                document.createElement("section");
            group.className =
                "codex-tag-filter-group" +
                (isSingleSelect ? " is-single-select" : "");

            const heading =
                document.createElement("div");
            heading.className =
                "codex-tag-filter-group-title";
            heading.textContent =
                groupName;
            group.appendChild(heading);

            const optionWrap =
                document.createElement("div");
            optionWrap.className =
                "codex-tag-filter-options";

            for (const tag of visibleTags) {
                const button =
                    document.createElement("button");

                const tagId =
                    tag.id || tag.name;

                const active =
                    draft.has(tagId);

                button.type = "button";
                button.className =
                    "codex-tag-filter-option" +
                    (isSingleSelect ? " is-single" : "") +
                    (active ? " is-selected" : "");
                button.textContent =
                    formatTagLabel(tagId);
                button.setAttribute(
                    "aria-pressed",
                    String(active)
                );

                button.addEventListener(
                    "click",
                    () => {
                        if (isSingleSelect) {
                            if (draft.has(tagId)) {
                                return;
                            }

                            for (const otherTag of visibleTags) {
                                const otherId =
                                    otherTag.id || otherTag.name;
                                draft.delete(otherId);
                            }

                            draft.add(tagId);
                        } else if (draft.has(tagId)) {
                            draft.delete(tagId);
                        } else {
                            draft.add(tagId);
                        }

                        renderTagFilterPopup();
                    }
                );

                optionWrap.appendChild(button);
            }

            group.appendChild(optionWrap);
            tagFilterPopup.groups.appendChild(group);
        }

        updateTagFilterMatchCount();
    }


    async function updateTagFilterMatchCount() {
        if (!tagFilterPopup) {
            return;
        }

        const draft =
            tagFilterPopup.modal._draftTags ||
            new Set();

        const requestId =
            ++tagFilterCountRequest;

        tagFilterPopup.match.textContent =
            "Checking…";
        tagFilterPopup.confirm.disabled = true;

        try {
            const postIds =
                await getTagFilterMatchPostIdsAsync(
                    [...draft]
                );

            if (requestId !== tagFilterCountRequest || tagFilterPopup.modal.hidden) {
                return;
            }

            const count = postIds.length;
            tagFilterPopup.match.textContent =
                count === 1
                    ? "1 post matches"
                    : `${count} posts match`;

            tagFilterPopup.confirm.disabled =
                count === 0;
        } catch (error) {
            if (requestId !== tagFilterCountRequest || tagFilterPopup.modal.hidden) {
                return;
            }

            console.error(
                "Codex tag filter count:",
                error
            );
            tagFilterPopup.match.textContent =
                "Unable to calculate matches.";
            tagFilterPopup.confirm.disabled = true;
        }
    }


    async function getTagFilterMatchPostIdsAsync(
        selectedTags
    ) {
        if (!selectedTags.length) {
            const catalogData =
                await getCatalogData();

            return collectVisibleCodexPostIds(
                catalogData
            );
        }

        return getTagFilterPostIds(
            tagFilterData || {},
            selectedTags
        );
    }


    function collectVisibleCodexPostIds(data) {
        const result = [];
        const seen = new Set();

        const hideDirectRoots =
            new Set(
                Array.isArray(data?.selector?.hide_posts)
                    ? data.selector.hide_posts
                    : []
            );

        function walk(nodes, inheritedHidden = false) {
            if (!nodes || typeof nodes !== "object" || Array.isArray(nodes)) {
                return;
            }

            for (const [name, node] of Object.entries(nodes)) {
                if (!node || typeof node !== "object") continue;

                const hideDirect =
                    inheritedHidden ||
                    hideDirectRoots.has(name);

                if (!hideDirect && Array.isArray(node.posts)) {
                    for (const postRef of node.posts) {
                        const postId =
                            getCatalogPostStorageId(
                                postRef
                            );

                        if (!postId || seen.has(postId) || isCodexHidden(postId)) {
                            continue;
                        }
                        seen.add(postId);
                        result.push(postId);
                    }
                }

                walk(node.children, hideDirect);
            }
        }

        walk(data?.catalogs);
        return result;
    }


    async function confirmTagFilter() {
        if (!tagFilterPopup) {
            return;
        }

        const draft =
            tagFilterPopup.modal._draftTags ||
            new Set();

        const selected = [...draft];
        const postIds =
            await getTagFilterMatchPostIdsAsync(
                selected
            );

        if (postIds.length === 0) {
            return;
        }

        activeTagSelection = selected;
        closeTagFilterPopup();

        if (selected.length === 0) {
            window.location.href = "Codex.html";
            return;
        }

        const params = new URLSearchParams();
        for (const tag of selected) {
            params.append("tag", tag);
        }

        window.location.href =
            `Codex.html?${params.toString()}`;
    }


    function createOption(
        value,
        text,
        type,
        target = ""
    ) {
        const option =
            document.createElement(
                "option"
            );


        option.value =
            value;

        option.textContent =
            text;

        option.dataset.type =
            type;


        if (target) {
            option.dataset.target =
                target;
        }


        return option;
    }


    function indent(depth) {
        return "\u3000".repeat(
            depth
        );
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

        /*
         * News storage IDs:
         *   ~260929-01
         * Public URL:
         *   N260929-01
         */
        let match =
            value.match(
                /^~(\d{6})-(\d{2})$/
            );

        if (match) {
            return `N${match[1]}-${match[2]}`;
        }

        /*
         * Novel / Post storage IDs:
         *   20260929-02
         * Legacy files may still carry a human-readable suffix:
         *   20260929-02_S_Five-Bottles
         *
         * Both resolve to:
         *   P20260929-02
         */
        match =
            value.match(
                /^(\d{8})-(\d{2})(?:_|$)/
            );

        if (match) {
            return `P${match[1]}-${match[2]}`;
        }

        return value;
    }


    function humanizeId(id) {
        return String(id || "")
            .replace(/^_/, "")
            .replace(/[-_]+/g, " ")
            .trim();
    }
})();