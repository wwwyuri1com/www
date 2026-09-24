(() => {
    const root = document.querySelector(".candy-loader");
    if (!root) return;

    const river = root.querySelector(".candy-river");
    if (!river) return;

    const catalogPath = "Codex-W/W-Catalog.json";

    loadNewestCover()
        .catch(error => {
            console.warn("Candy Loader: unable to load newest cover.", error);
        });

    async function loadNewestCover() {
        const boss = document.querySelector(".candy-boss");
        if (!boss) return;

        try {
            const response = await fetch(catalogPath, {
                cache: "no-store"
            });

            if (!response.ok) {
                throw new Error(
                    `W-Catalog request failed (${response.status})`
                );
            }

            const data = await response.json();
            const postIds = new Set();

            collectPosts(
                data?.catalogs || {},
                postIds
            );

            const posts = [...postIds].map(postId => ({
                postId,
                date: (String(postId).match(/^(\d{8})-/) || [])[1] || "",
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

            const src = window.YURI1Cover?.src
                ? window.YURI1Cover.src(newest.postId, 1)
                : `Codex-Img/${encodeURIComponent(newest.postId)}%20(1).jpg`;

            boss.style.backgroundImage = `url("${src}")`;
        } catch (error) {
            // Keep cover-def.jpg as the emergency fallback only.
            throw error;
        }
    }

    function getNumericIdOrder(postId) {
        const match = String(postId).match(/^\d{8}-(\d+)/);
        return match ? Number(match[1]) : -1;
    }

    loadPosts()
        .then(posts => {
            renderPosts(posts);
        })
        .catch(error => {
            console.error("Candy Loader:", error);
            river.textContent = "";
        });

    async function loadPosts() {
        const response = await fetch(catalogPath);

        if (!response.ok) {
            throw new Error(
                `W-Catalog request failed (${response.status})`
            );
        }

        const data = await response.json();

        const postIds = new Set();

        collectPosts(
            data?.catalogs || {},
            postIds
        );

        const posts = await loadPostData(
            [...postIds]
        );

        /*
         * Homepage order:
         * newest Post ID first.
         *
         * Example:
         * 20260829-01
         * 20260828-02
         * 20260828-01
         * 20260826-01
         */
        posts.sort((a, b) =>
            String(b.id).localeCompare(
                String(a.id),
                undefined,
                {
                    numeric: true,
                    sensitivity: "base"
                }
            )
        );

        return posts;
    }

    function collectPosts(catalogs, postIds) {
        for (const node of Object.values(catalogs)) {

            if (Array.isArray(node?.posts)) {
                node.posts.forEach(postId => {
                    if (postId) {
                        postIds.add(String(postId));
                    }
                });
            }

            if (
                node?.children &&
                typeof node.children === "object"
            ) {
                collectPosts(
                    node.children,
                    postIds
                );
            }
        }
    }

    async function loadPostData(postIds) {
        const posts = [];

        await Promise.all(
            postIds.map(async postId => {
                try {
                    const response = await fetch(
                        `Codex-Text/${encodeURIComponent(postId)}.json`
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
        river.replaceChildren();

        posts.forEach(post => {

            const row =
                document.createElement("div");

            row.className =
                "candy-guideline";

            const link =
                document.createElement("a");

            link.className =
                "post-link index";

            link.href =
                `Post.html?id=${encodeURIComponent(
                    post.id
                )}`;

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
                `Codex-Img/${encodeURIComponent(
                    post.id
                )}%20(1).jpg`;

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

})();