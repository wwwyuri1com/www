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

    loadSelectors();


    async function loadSelectors() {
        try {
            const requests = [];


            if (catalogRoot) {
                requests.push(
                    fetch("Codex-W/W-Catalog.json")
                        .then(response => {
                            if (!response.ok) {
                                throw new Error(
                                    `W-Catalog request failed (${response.status})`
                                );
                            }

                            return response.json();
                        })
                        .then(data =>
                            buildCatalogSelector(data)
                        )
                );
            }


            if (tagRoot) {
                requests.push(
                    fetch("Codex-W/W-Tag.json")
                        .then(response => {
                            if (!response.ok) {
                                throw new Error(
                                    `W-Tag request failed (${response.status})`
                                );
                            }

                            return response.json();
                        })
                        .then(data =>
                            buildTagSelector(data)
                        )
                );
            }


            if (resultRoot) {
                requests.push(
                    loadCodexResult()
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

        const tagQuery =
            params.get("tag");


        try {
            const requests = [];


            if (catalogQuery !== null) {
                requests.push(
                    fetch("Codex-W/W-Catalog.json")
                        .then(async response => {
                            if (!response.ok) {
                                throw new Error(
                                    `W-Catalog request failed (${response.status})`
                                );
                            }

                            return {
                                type: "catalog",
                                data:
                                    await response.json()
                            };
                        })
                );
            }


            if (tagQuery !== null) {
                requests.push(
                    fetch("Codex-W/W-Tag.json")
                        .then(async response => {
                            if (!response.ok) {
                                throw new Error(
                                    `W-Tag request failed (${response.status})`
                                );
                            }

                            return {
                                type: "tag",
                                data:
                                    await response.json()
                            };
                        })
                );
            }


            if (
                catalogQuery === null &&
                tagQuery === null
            ) {
                requests.push(
                    fetch("Codex-W/W-Catalog.json")
                        .then(async response => {
                            if (!response.ok) {
                                throw new Error(
                                    `W-Catalog request failed (${response.status})`
                                );
                            }

                            return {
                                type: "catalog-all",
                                data:
                                    await response.json()
                            };
                        })
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
                await renderTagResult(
                    result.data,
                    tagQuery
                );

            } else {
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


    async function renderCatalogResult(
        data,
        catalogQuery
    ) {
        clearResult();


const title = "▧ Codex";

appendResultHeader(title);


        let node =
            data?.catalogs || {};


        if (
            catalogQuery &&
            catalogQuery !== "All"
        ) {
            node =
                findCatalogNode(
                    node,
                    catalogQuery.split("/")
                );
        }


        if (!node) {
            renderMessage(
                "Catalog not found."
            );

            return;
        }


        if (
            catalogQuery === null ||
            catalogQuery === "All"
        ) {
            await renderCatalogNodes(
                node,
                "",
                true
            );

        } else {
            await renderCatalogNode(
                getLastPathPart(
                    catalogQuery
                ),
                node,
                catalogQuery,
                0,
                true
            );
        }
    }


    async function renderCatalogNodes(
        nodes,
        parentPath = "",
        showAllRoots = false
    ) {
        if (showAllRoots) {

            for (
                const [name, node]
                of Object.entries(nodes)
            ) {
                await renderCatalogNode(
                    name,
                    node,
                    name,
                    0,
                    true
                );
            }

            return;
        }


        if (
            nodes &&
            typeof nodes === "object" &&
            !Array.isArray(nodes)
        ) {
            const name =
                getLastPathPart(
                    parentPath
                );

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
        showTitle = true
    ) {
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


        if (
            showTitle &&
            catalogTitle &&
            catalogLink
        ) {
            catalogLink.href =
                `Codex.html?catalog=${encodeURIComponent(
                    path
                )}`;

            catalogLink.textContent =
                `${indent(depth)}⛡ ${name}`;

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
            posts.length > 0
        ) {
            const postData =
                await loadPostData(posts);


            for (
                const postId
                of posts
            ) {
                const post =
                    createPostElement(
                        postId,
                        postData.get(postId),
                        depth +
                            (showTitle ? 1 : 0)
                    );


                if (post) {
                    postList.appendChild(
                        post
                    );
                }
            }
        }


        /*
         * Catalog is always rendered,
         * even when it has no Posts.
         */
        resultRoot.appendChild(
            catalog
        );


        /*
         * Children are independent
         * from Posts.
         */
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
                    true
                );
            }
        }
    }


    async function renderTagResult(
        data,
        tag
    ) {
        clearResult();


        appendResultHeader(
            `⇲ #${tag}`
        );


        const tagData =
            data?.tags?.[tag];


        if (
            !tagData ||
            !Array.isArray(
                tagData.posts
            )
        ) {
            renderMessage(
                "Tag not found."
            );

            return;
        }


        const posts =
            await loadPostData(
                tagData.posts
            );


        const postList =
            document.createElement(
                "div"
            );

        postList.className =
            "codex-post-list";


        for (
            const postId
            of tagData.posts
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


        resultRoot.appendChild(
            postList
        );
    }


    async function loadPostData(
        postIds
    ) {
        const dataMap =
            new Map();


        await Promise.all(
            postIds.map(
                async postId => {
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


    function createPostElement(
        postId,
        data,
        depth
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

            image.src =
                `Codex-Img/${encodeURIComponent(
                    postId
                )}%20(1).jpg`;

            image.loading =
                "lazy";

            image.decoding =
                "async";

            image.addEventListener(
                "error",
                () => imageBlock.remove(),
                { once: true }
            );
        }


        if (titleLink) {
            titleLink.href =
                `Post.html?id=${encodeURIComponent(
                    postId
                )}`;

            titleLink.textContent =
                displayTitle;
        }


        if (date) {
            const dateText =
                data?.date || "";


            const span =
                date.querySelector(
                    "span"
                );


            if (dateText) {

                if (span) {
                    span.textContent =
                        dateText;

                } else {
                    date.textContent =
                        dateText;
                }

            } else {
                date.remove();
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
            "⛚ Home";


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
            "▧ Codex";


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
            text !== "▧ Codex"
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


    function findCatalogNode(
        catalogs,
        parts
    ) {
        let current =
            catalogs;


        for (
            let i = 0;
            i < parts.length;
            i++
        ) {
            const part =
                parts[i];


            if (
                !current ||
                typeof current !== "object"
            ) {
                return null;
            }


            const node =
                current[part];


            if (!node) {
                return null;
            }


            if (
                i === parts.length - 1
            ) {
                return node;
            }


            current =
                node.children;
        }


        return null;
    }


    function getLastPathPart(
        path
    ) {
        const parts =
            String(path || "")
                .split("/");


        return (
            parts[parts.length - 1] ||
            "Codex"
        );
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


        /*
         * Home
         */
        select.appendChild(
            createOption(
                "Home",
                "⛚ Home",
                "home",
                "Home"
            )
        );


        /*
         * Codex root.
         */
        select.appendChild(
            createOption(
                "All",
                "⛞ Codex",
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


        await appendCatalogs(
            select,
            data?.catalogs || {},
            "",
            0,
            printPosts
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
                            option.value
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


    async function appendCatalogs(
        select,
        catalogs,
        parentPath,
        depth,
        printPosts
    ) {
        for (
            const [name, node]
            of Object.entries(
                catalogs
            )
        ) {
            const path =
                parentPath
                    ? `${parentPath}/${name}`
                    : name;


            select.appendChild(
                createOption(
                    path,
                    `${indent(depth)}⛡ ${name}`,
                    "catalog",
                    path
                )
            );


            if (
                printPosts.has(path) &&
                Array.isArray(
                    node?.posts
                )
            ) {
                const titles =
                    await loadPostTitles(
                        node.posts
                    );


                node.posts.forEach(
                    postId => {
                        select.appendChild(
                            createOption(
                                postId,
                                `${indent(depth + 1)}⇲ ${
                                    titles.get(postId) ||
                                    humanizeId(postId)
                                }`,
                                "post",
                                postId
                            )
                        );
                    }
                );
            }


            if (
                node?.children &&
                typeof node.children ===
                    "object"
            ) {
                await appendCatalogs(
                    select,
                    node.children,
                    path,
                    depth + 1,
                    printPosts
                );
            }
        }
    }


    async function loadPostTitles(
        postIds
    ) {
        const titles =
            new Map();


        await Promise.all(
            postIds.map(
                async postId => {
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


        if (placeholder) {
            select.appendChild(
                placeholder
            );

        } else {
            const option =
                createOption(
                    "",
                    "⛛ Select Tag",
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


        for (
            const [groupName, tags]
            of Object.entries(
                data?.groups || {}
            )
        ) {
            const group =
                document.createElement(
                    "optgroup"
                );


            group.label =
                `↘ ${groupName}`;


            if (Array.isArray(tags)) {
                tags.forEach(
                    tag => {
                        group.appendChild(
                            createOption(
                                tag,
                                `#${tag}`,
                                "tag",
                                tag
                            )
                        );
                    }
                );
            }


            select.appendChild(
                group
            );
        }


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


                window.location.href =
                    `Codex.html?tag=${encodeURIComponent(
                        option.value
                    )}`;
            }
        );
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


    function humanizeId(id) {
        return String(id || "")
            .replace(/^_/, "")
            .replace(/[-_]+/g, " ")
            .trim();
    }
})();