(() => {
    const root = document.getElementById("post-loader");
    if (!root) return;

    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    if (!id) {
        root.textContent = "Post ID not found.";
        return;
    }

    const textPath = `Codex-Text/${encodeURIComponent(id)}.json`;

    fetch(textPath)
        .then(response => {
            if (!response.ok) {
                throw new Error(`JSON not found: ${textPath}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.id !== id) {
                throw new Error(
                    `ID mismatch: ${data.id || "(missing)"} !== ${id}`
                );
            }

            renderPost(data);
        })
        .catch(error => {
            root.textContent = error.message;
        });

    async function renderPost(data) {
        const catalog = root.querySelector(".post-catalog.post");
        const images = root.querySelector(".post-images.post");
        const date = root.querySelector(".post-date.post");
        const title = root.querySelector(".post-title.post");
        const content = root.querySelector(".post-text.post");
        const tag = root.querySelector(".post-tag.post");
        const readmore = root.querySelector(".post-readmore.post");
        const relatedLinks = root.querySelector(".post-related.post");

        if (!catalog || !images || !date || !title || !content || !tag || !readmore || !relatedLinks) {
            throw new Error("Post Loader DOM structure is incomplete.");
        }

        document.title = data.title
            ? `${data.title} | Derive Dimension Demon`
            : "Derive Dimension Demon Official Website";

        await renderCatalog(catalog, id);
        renderImages(images, id);
        renderText(date, data.date || "");
        renderTitle(title, data.title || "");
        renderContent(content, data.content || "");
        await renderTags(tag, id);
        renderRelatedLinks(
            relatedLinks,
            data.related_links
        );
        await renderReadmore(readmore, id);
    }

    async function renderCatalog(container, postId) {
        const wrapper = container.querySelector("span");
        if (!wrapper) return;

        wrapper.textContent = "";

        // 固定第一層：Home
        const homeLink = document.createElement("a");
        homeLink.className = "post-catalog-link post";
        homeLink.textContent = "⛚ Home";
        homeLink.href = "index.html";
        wrapper.appendChild(homeLink);

        wrapper.appendChild(document.createTextNode(" "));

        // 固定第二層：Codex
        const codexLink = document.createElement("a");
        codexLink.className = "post-catalog-link post";
        codexLink.textContent = "⛞ Codex";
        codexLink.href = "Codex.html";
        wrapper.appendChild(codexLink);

        const getLink = document.createElement("a");
        getLink.className = "post-get-link post";
        getLink.href = "#";
        getLink.textContent = "⿻ Get post link";

        getLink.addEventListener("click", async event => {
            event.preventDefault();

            const success = await copyPostLink();
            showPostLinkNotice(success ? "◈ Link Copied ◈" : "◈ Copy Failed ◈");
        });

        // Keep Get post link inside its own span,
        // so all Post links remain grouped inside span elements.
        const getLinkWrapper = document.createElement("span");
        getLinkWrapper.appendChild(getLink);
        container.appendChild(getLinkWrapper);

        try {
            // Catalog 的正式來源是 W-Catalog。
            // Post JSON 不需要重複保存 catalog。
            const response = await fetch("Codex-W/W-Catalog.json");

            if (!response.ok) {
                throw new Error(
                    `W-Catalog request failed (${response.status})`
                );
            }

            const data = await response.json();

            const path = findCatalogPath(
                data?.catalogs || {},
                postId,
                ""
            );

            if (!path) return;

            path.split("/")
                .filter(Boolean)
                .forEach((part, index, parts) => {
                    wrapper.appendChild(
                        document.createTextNode(" ")
                    );

                    const link = document.createElement("a");
                    link.className = "post-catalog-link post";
                    link.textContent = `⛡ ${part}`;

                    const cumulativePath =
                        parts.slice(0, index + 1).join("/");

                    link.href =
                        `Codex.html?catalog=${encodeURIComponent(cumulativePath)}`;

                    wrapper.appendChild(link);
                });

        } catch (error) {
            console.error(
                "Post Catalog Loader:",
                error
            );
        }
    }

    async function copyPostLink() {
        const url = window.location.href;

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

    async function renderReadmore(container, postId) {
        const previousWrapper = container.querySelector("span:first-child");
        const nextWrapper = container.querySelector("span:last-child");

        if (!previousWrapper || !nextWrapper) return;

        previousWrapper.textContent = "";
        nextWrapper.textContent = "";
        container.hidden = true;

        try {
            // W-Catalog 是上一篇／下一篇的唯一來源。
            // 只統計符合 YYYYMMDD-0x 的 Post ID。
            const response = await fetch("Codex-W/W-Catalog.json");

            if (!response.ok) {
                throw new Error(
                    `W-Catalog request failed (${response.status})`
                );
            }

            const data = await response.json();
            const postIds = collectReadmorePostIds(data?.catalogs || {});

            postIds.sort((a, b) => {
                const [dateA, numberA] = a.split("-");
                const [dateB, numberB] = b.split("-");

                return (
                    dateA.localeCompare(dateB) ||
                    Number(numberA) - Number(numberB)
                );
            });

            const currentIndex = postIds.indexOf(postId);
            if (currentIndex === -1) return;

            const previousId = postIds[currentIndex - 1];
            const nextId = postIds[currentIndex + 1];

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

            if (previousId || nextId) {
                container.hidden = false;
            }
        } catch (error) {
            console.error(
                "Post Readmore Loader:",
                error
            );
        }
    }

    function collectReadmorePostIds(catalogs, result = []) {
        const pattern = /^(\d{8})-(0[1-9])$/;

        for (const node of Object.values(catalogs || {})) {
            if (Array.isArray(node?.posts)) {
                node.posts.forEach(postId => {
                    const value = String(postId);
                    if (pattern.test(value) && !result.includes(value)) {
                        result.push(value);
                    }
                });
            }

            collectReadmorePostIds(
                node?.children || {},
                result
            );
        }

        return result;
    }

    function createReadmoreLink(postId, text, className) {
        const link = document.createElement("a");

        link.className = className;
        link.href = `Post.html?id=${encodeURIComponent(postId)}`;
        link.textContent = text;

        return link;
    }

    function findCatalogPath(
        catalogs,
        postId,
        parentPath
    ) {
        for (const [name, node] of Object.entries(catalogs || {})) {

            const path = parentPath
                ? `${parentPath}/${name}`
                : name;

            if (
                Array.isArray(node?.posts) &&
                node.posts.some(
                    id => String(id) === String(postId)
                )
            ) {
                return path;
            }

            const childPath = findCatalogPath(
                node?.children || {},
                postId,
                path
            );

            if (childPath) {
                return childPath;
            }
        }

        return "";
    }

    function renderImages(container, postId) {
        container.textContent = "";

        let imageNumber = 1;

        const loadNext = () => {
            const src =
                `Codex-Img/${postId} (${imageNumber}).jpg`;

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
    container.textContent = "";

    /*
     * 文章排版規則：
     *
     * 整篇文章只使用一個 <p>。
     * 每一個原始換行輸出為一個 <br>。
     *
     *   第一段。\n第二段。
     *
     * → <p>第一段。<br>第二段。</p>
     *
     *   第一段。\n\n第二段。
     *
     * → <p>第一段。<br><br>第二段。</p>
     *
     * 不再混用多個 <p> 的 margin 與 <br>。
     * 使用 text nodes + createElement("br")，
     * 不使用 innerHTML。
     */

    const p =
        document.createElement("p");

    const lines =
        String(value || "")
            .replace(/\r\n|\r/g, "\n")
            .split("\n");

    lines.forEach((line, index) => {
        p.appendChild(
            document.createTextNode(line)
        );

        if (index < lines.length - 1) {
            p.appendChild(
                document.createElement("br")
            );
        }
    });

    container.appendChild(p);
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
                    "相關連結 ⇲";

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
            link.textContent = item.url;

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
            const response =
                await fetch("Codex-W/W-Tag.json");

            if (!response.ok) {
                throw new Error(
                    `W-Tag request failed (${response.status})`
                );
            }

            const data =
                await response.json();

            const tags = [];

            for (
                const [tagName, node]
                of Object.entries(data?.tags || {})
            ) {
                if (
                    Array.isArray(node?.posts) &&
                    node.posts.includes(postId)
                ) {
                    tags.push(tagName);
                }
            }

            tags.forEach((tagText, index) => {
                const link =
                    document.createElement("a");

                link.className =
                    "post-tag-link post";

                link.textContent = tagText;

                link.href =
                    `Codex.html?tag=${encodeURIComponent(tagText)}`;

                wrapper.appendChild(link);

                if (index < tags.length - 1) {
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