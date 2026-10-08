(() => {
    const loader = document.getElementById("ai-loader");
    if (!loader) return;

    const postText = document.querySelector(".post-text.post");
    const aButton = loader.querySelector(".ai-btn.a");
    const pButton = loader.querySelector(".ai-btn.p");
    const hButton = loader.querySelector(".ai-btn.h");

    if (!postText || !aButton || !pButton || !hButton) return;

    // Current version status
    const status = document.createElement("div");
    status.className = "ai-version-status";
    loader.appendChild(status);

    function showStatus(mode) {
        const labels = {
            a: "AI Expansion (en)",
            h: "Human Draft (繁)",
            p: "Human Prompt (繁)"
        };

        if (!labels[mode]) {
            status.textContent = "";
            status.removeAttribute("data-mode");
            return;
        }

        status.textContent = labels[mode];
        status.dataset.mode = mode;
    }

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
        // Handmade view: hide instruction sections beginning with "!" or "！"
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

            if (trimmed.startsWith("!") || trimmed.startsWith("！")) {
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

        // Small, safe inline Markdown subset used by YURI1 posts:
        // **bold**, __bold__, *italic*, _italic_.
        // Avoid lookbehind so this also works reliably in cached / embedded
        // browser contexts. Single-underscore italics are accepted only when
        // the marker is not embedded inside an identifier such as file_name_x.
        const tokenPattern = /(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_)/g;
        let cursor = 0;
        let match;

        while ((match = tokenPattern.exec(line)) !== null) {
            const token = match[0];
            const tokenStart = match.index;
            const tokenEnd = tokenStart + token.length;
            const singleUnderscore =
                token.startsWith("_") && !token.startsWith("__");

            if (singleUnderscore) {
                const before = tokenStart > 0 ? line[tokenStart - 1] : "";
                const after = tokenEnd < line.length ? line[tokenEnd] : "";
                const wordLike = /[A-Za-z0-9_]/;

                if (wordLike.test(before) || wordLike.test(after)) {
                    continue;
                }
            }

            if (tokenStart > cursor) {
                parent.appendChild(
                    document.createTextNode(line.slice(cursor, tokenStart))
                );
            }

            const strong = token.startsWith("**") || token.startsWith("__");
            const edgeLength = strong ? 2 : 1;
            const element = document.createElement(strong ? "strong" : "em");
            element.textContent = token.slice(edgeLength, -edgeLength);
            parent.appendChild(element);

            cursor = tokenEnd;
        }

        if (cursor < line.length) {
            parent.appendChild(document.createTextNode(line.slice(cursor)));
        }
    }

    function isBlockquoteLine(line) {
        return /^\s*>/.test(line);
    }

    function getBlockquoteText(line) {
        return line.replace(/^\s*>\s?/, "");
    }

    function renderBlockContent(blockElement, lines, parseMarkup) {
        blockElement.textContent = "";

        let index = 0;

        while (index < lines.length) {
            const line = lines[index];

            // A standalone --- is a horizontal rule in every reading mode.
            if (line.trim() === "---") {
                blockElement.appendChild(
                    document.createElement("hr")
                );
                index += 1;
                continue;
            }

            // In AI-rendered content, consecutive Markdown quote lines are
            // rendered as one blockquote. A bare ">" line becomes a blank
            // line inside the quote instead of being printed literally.
            if (parseMarkup && isBlockquoteLine(line)) {
                const quote = document.createElement("blockquote");
                quote.className = "ai-markdown-quote";

                while (index < lines.length && isBlockquoteLine(lines[index])) {
                    appendInlineText(
                        quote,
                        getBlockquoteText(lines[index]),
                        true
                    );

                    if (index + 1 < lines.length && isBlockquoteLine(lines[index + 1])) {
                        quote.appendChild(document.createElement("br"));
                    }

                    index += 1;
                }

                blockElement.appendChild(quote);
                continue;
            }

            appendInlineText(blockElement, line, parseMarkup);

            const nextLine = lines[index + 1];
            const nextIsRule = nextLine !== undefined && nextLine.trim() === "---";
            const nextIsQuote = parseMarkup && nextLine !== undefined && isBlockquoteLine(nextLine);

            if (index < lines.length - 1 && !nextIsRule && !nextIsQuote) {
                blockElement.appendChild(
                    document.createElement("br")
                );
            }

            index += 1;
        }
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

    function setMode(mode, showVersionStatus = false) {
        renderAllBlocks(mode);
        loader.dataset.mode = mode;
        setButtons(mode);

        if (showVersionStatus) {
            showStatus(mode);
        } else if (mode === "all") {
            showStatus("all");
        }
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

        setMode("a");
    }

    aButton.addEventListener("click", () => {
        const currentMode = loader.dataset.mode || "all";
        const nextMode = currentMode === "a" ? "all" : "a";
        setMode(nextMode, nextMode !== "all");
    });

    pButton.addEventListener("click", () => {
        const currentMode = loader.dataset.mode || "all";
        const nextMode = currentMode === "p" ? "all" : "p";
        setMode(nextMode, nextMode !== "all");
    });

    hButton.addEventListener("click", () => {
        const currentMode = loader.dataset.mode || "all";
        const nextMode = currentMode === "h" ? "all" : "h";
        setMode(nextMode, nextMode !== "all");
    });

    document.addEventListener(
        "post:content-ready",
        refresh
    );

    refresh();
})();
