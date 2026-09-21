(() => {
    const loader = document.getElementById("ai-loader");
    if (!loader) return;

    const postText = document.querySelector(".post-text.post");
    const aButton = loader.querySelector(".ai-btn.a");
    const pButton = loader.querySelector(".ai-btn.p");
    const hButton = loader.querySelector(".ai-btn.h");

    if (!postText || !aButton || !pButton || !hButton) return;

    let blocks = [];

    function normalize(value) {
        return String(value || "")
            .replace(/\r\n|\r/g, "\n");
    }

    function parseSourceBlocks(value) {
        const lines = normalize(value).split("\n");
        const sourcePattern = /^(user|ChatGPT)\s*$/i;
        const result = [];

        let current = null;

        lines.forEach(line => {
            const match = line.trim().match(sourcePattern);

            if (match) {
                if (current) result.push(current);

                const sourceLabel = match[1];
                current = {
                    source: sourceLabel.toLowerCase() === "user"
                        ? "user"
                        : "llm",
                    label: sourceLabel,
                    lines: []
                };
                return;
            }

            if (!current) {
                current = {
                    source: "user",
                    label: "user",
                    lines: []
                };
            }

            current.lines.push(line);
        });

        if (current) result.push(current);

        return result;
    }

    function getHLines(lines) {
        // Handmade view: hide instruction sections beginning with "！"
        // until the next / or \ separator. Separators themselves are hidden.
        // "！END" is the one exception: show it as "（完結）".
        const result = [];
        let hidden = false;

        lines.forEach(line => {
            const trimmed = line.trim();
            const isSeparator =
                trimmed === "/" ||
                trimmed === "\\" ||
                trimmed === "／" ||
                trimmed === "＼";

            if (trimmed.toLowerCase() === "!end" || trimmed.toLowerCase() === "！end") {
                result.push("（完結）");
                hidden = false;
                return;
            }

            if (trimmed.startsWith("！")) {
                hidden = true;
                return;
            }

            if (isSeparator) {
                hidden = false;
                return;
            }

            if (!hidden) result.push(line);
        });

        return result;
    }

    function appendInlineText(parent, line, parseMarkup) {
        if (!parseMarkup) {
            parent.appendChild(document.createTextNode(line));
            return;
        }

        let rest = line;
        const tokenPattern = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/;

        while (rest) {
            const match = rest.match(tokenPattern);

            if (!match) {
                parent.appendChild(document.createTextNode(rest));
                return;
            }

            const index = match.index;
            if (index > 0) {
                parent.appendChild(
                    document.createTextNode(rest.slice(0, index))
                );
            }

            const token = match[0];
            const strong = token.startsWith("**");
            const element = document.createElement(strong ? "strong" : "em");
            element.textContent = strong
                ? token.slice(2, -2)
                : token.slice(1, -1);

            parent.appendChild(element);
            rest = rest.slice(index + token.length);
        }
    }

    function renderBlockContent(blockElement, lines, parseMarkup) {
        blockElement.textContent = "";

        lines.forEach((line, index) => {
            appendInlineText(blockElement, line, parseMarkup);

            if (index < lines.length - 1) {
                blockElement.appendChild(
                    document.createElement("br")
                );
            }
        });
    }

    function renderAllBlocks(mode) {
        postText.textContent = "";

        let visible = blocks;

        if (mode === "a") {
            visible = blocks.filter(block => block.source === "llm");
        } else if (mode === "p") {
            visible = blocks.filter(block => block.source === "user");
        } else if (mode === "h") {
            visible = blocks.filter(block => block.source === "user");
        }

        visible.forEach((block, index) => {
            const blockElement = document.createElement("div");
            blockElement.className = block.source;

            let lines = block.lines;
            if (mode === "h") {
                lines = getHLines(lines);
            }

            renderBlockContent(
                blockElement,
                lines,
                block.source === "llm"
            );

            if (mode === "all") {
                const label = document.createElement("strong");
                label.className = "ai-source-label";
                label.textContent = block.label;

                blockElement.insertBefore(
                    label,
                    blockElement.firstChild
                );
            }

            postText.appendChild(blockElement);

            if (index < visible.length - 1) {
                postText.appendChild(
                    document.createElement("hr")
                );
            }
        });
    }

    function setButtons(mode) {
        const inactiveColor = "#69696970";
        const activeColor = "#fa6699";

        aButton.style.color =
            mode === "a"
                ? activeColor
                : inactiveColor;

        pButton.style.color =
            mode === "p"
                ? activeColor
                : inactiveColor;

        hButton.style.color =
            mode === "h"
                ? activeColor
                : inactiveColor;
    }

    function setMode(mode) {
        renderAllBlocks(mode);
        loader.dataset.mode = mode;
        setButtons(mode);
    }

    function toggleMode(mode) {
        const currentMode = loader.dataset.mode || "all";
        setMode(currentMode === mode ? "all" : mode);
    }

    function refresh() {
        const raw = postText.dataset.rawContent || "";
        blocks = parseSourceBlocks(raw);

        const hasUser = blocks.some(block => block.source === "user");
        const hasAi = blocks.some(block => block.source === "llm");

        loader.hidden = !(hasUser && hasAi);

        if (loader.hidden) return;

        setMode("all");
    }

    aButton.addEventListener("click", () => toggleMode("a"));
    pButton.addEventListener("click", () => toggleMode("p"));
    hButton.addEventListener("click", () => toggleMode("h"));

    document.addEventListener(
        "post:content-ready",
        refresh
    );

    refresh();
})();
