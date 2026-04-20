function slugifyHeading(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\u4e00-\u9fa5\s.-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[.]/g, '-')
        .replace(/-+/g, '-');
}

const TOC_ENABLED_POSTS = new Set(['critical-phenomena-natural-science']);

function protectMathDelimiters(markdown) {
    const tokens = [];
    const pushToken = (rawMath) => {
        const token = `@@MATH_TOKEN_${tokens.length}@@`;
        tokens.push({ token, rawMath });
        return token;
    };

    let result = markdown.replace(/\\\[((?:.|\n)*?)\\\]/g, (_, expr) => pushToken(`\\[${expr}\\]`));
    result = result.replace(/\\\((.+?)\\\)/g, (_, expr) => pushToken(`\\(${expr}\\)`));
    return { result, tokens };
}

function restoreMathTokens(html, tokens) {
    let restored = html;
    tokens.forEach(({ token, rawMath }) => {
        restored = restored.replaceAll(token, rawMath);
    });
    return restored;
}

function extractFootnoteDefinitions(markdown) {
    const definitionRegex = /^\[\^([^\]]+)\]:\s*(.+(?:\n(?: {2,}.+|\t.+)*)?)/gm;
    const definitions = new Map();
    let match;

    while ((match = definitionRegex.exec(markdown)) !== null) {
        const key = match[1].trim();
        const value = match[2].replace(/\n(?: {2,}|\t)/g, '\n').trim();
        definitions.set(key, value);
    }

    return definitions;
}

function enhanceFootnotes(markdown, sharedDefinitions = null) {
    const definitionRegex = /^\[\^([^\]]+)\]:\s*(.+(?:\n(?: {2,}.+|\t.+)*)?)/gm;
    const definitions = sharedDefinitions ?? extractFootnoteDefinitions(markdown);
    let definitionsRemoved = markdown.replace(definitionRegex, '').trimEnd();

    const order = [];
    const refRegex = /\[\^([^\]]+)\]/g;
    const textWithSup = definitionsRemoved.replace(refRegex, (_, rawKey) => {
        const key = rawKey.trim();
        if (!definitions.has(key)) {
            return `[^${key}]`;
        }
        if (!order.includes(key)) {
            order.push(key);
        }
        const index = order.indexOf(key) + 1;
        return `<sup id="fnref-${key}"><a href="#fn-${key}" class="footnote-ref">[${index}]</a></sup>`;
    });

    if (order.length === 0) {
        return textWithSup;
    }

    const items = order
        .map((key) => `<li id="fn-${key}">${marked.parseInline(definitions.get(key))}</li>`)
        .join('\n');

    return `${textWithSup}\n\n<section class="post-footnotes">\n<h2>脚注</h2>\n<ol>\n${items}\n</ol>\n</section>\n`;
}

function parseHeadingStructure(markdown) {
    const lines = markdown.split('\n');
    const headings = [];
    const firstDepthOneIndex = lines.findIndex(line => /^#\s+/.test(line));

    lines.forEach((line, lineIndex) => {
        const matched = line.match(/^(#{1,3})\s+(.+)$/);
        if (!matched) {
            return;
        }

        const depth = matched[1].length;
        const title = matched[2].trim();
        headings.push({
            depth,
            title,
            lineIndex,
            id: slugifyHeading(title) || `section-${headings.length + 1}`,
            h1Id: null,
            h2Id: null,
            endLineIndex: lines.length,
        });
    });

    for (let i = 0; i < headings.length; i += 1) {
        const current = headings[i];
        for (let j = i + 1; j < headings.length; j += 1) {
            if (headings[j].depth <= current.depth) {
                current.endLineIndex = headings[j].lineIndex;
                break;
            }
        }
    }

    let currentH1 = null;
    let currentH2 = null;
    headings.forEach((heading) => {
        if (heading.depth === 1) {
            currentH1 = heading.id;
            currentH2 = null;
        } else if (heading.depth === 2) {
            currentH2 = heading.id;
        }

        heading.h1Id = currentH1;
        heading.h2Id = currentH2;
    });

    return {
        lines,
        headings,
        prefaceLineEnd: firstDepthOneIndex === -1 ? lines.length : firstDepthOneIndex,
    };
}

function buildTocTree(headings) {
    const root = [];
    const byId = new Map();

    headings.filter(h => h.depth <= 3).forEach((heading) => {
        const node = {
            id: heading.id,
            title: heading.title,
            depth: heading.depth,
            h1Id: heading.h1Id,
            h2Id: heading.h2Id,
            children: [],
        };
        byId.set(node.id, node);

        if (node.depth === 1) {
            root.push(node);
            return;
        }

        const parentId = node.depth === 2 ? node.h1Id : node.h2Id;
        const parent = byId.get(parentId);
        if (parent) {
            parent.children.push(node);
        } else {
            root.push(node);
        }
    });

    return root;
}

function nodeContainsId(node, targetId) {
    if (node.id === targetId) {
        return true;
    }
    return node.children.some(child => nodeContainsId(child, targetId));
}

function renderTocNode(node, activeUnitId, safeSlug) {
    const wrapper = document.createElement('div');
    wrapper.className = `toc-item toc-level-${node.depth}`;

    const unitLinkForNode = `blog_post.html?post=${safeSlug}&unit=${node.id}`;

    const details = document.createElement('details');
    details.open = nodeContainsId(node, activeUnitId);

    const row = document.createElement('div');
    row.className = 'toc-row';

    if (node.children.length > 0) {
        const toggleButton = document.createElement('button');
        toggleButton.type = 'button';
        toggleButton.className = 'toc-toggle';
        toggleButton.setAttribute('aria-label', '展开或收起目录');
        toggleButton.addEventListener('click', (event) => {
            event.preventDefault();
            details.open = !details.open;
        });
        row.appendChild(toggleButton);
    } else {
        const marker = document.createElement('span');
        marker.className = 'toc-leaf-marker';
        marker.textContent = '•';
        row.appendChild(marker);
    }

    const rowLink = document.createElement('a');
    rowLink.className = 'toc-link';
    if (node.id === activeUnitId) {
        rowLink.classList.add('toc-link-active');
    }
    rowLink.href = unitLinkForNode;
    rowLink.textContent = node.title;
    row.appendChild(rowLink);
    details.appendChild(row);

    const children = document.createElement('div');
    children.className = 'toc-children';
    node.children.forEach((child) => {
        children.appendChild(renderTocNode(child, activeUnitId, safeSlug));
    });
    details.appendChild(children);

    wrapper.appendChild(details);
    return wrapper;
}

function buildSingleUnitMarkdown(markdown, safeSlug) {
    const tocContainer = document.getElementById('post-toc-content');
    if (!tocContainer) {
        return markdown;
    }

    const structure = parseHeadingStructure(markdown);
    const tocTree = buildTocTree(structure.headings);
    const selectableSections = structure.headings.filter(h => h.depth <= 3);
    if (selectableSections.length === 0) {
        tocContainer.innerHTML = '<p class="post-toc-placeholder">该文章暂无可分页的三级目录。</p>';
        return markdown;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const requestedUnit = urlParams.get('unit');
    const active = selectableSections.find(section => section.id === requestedUnit) ?? selectableSections[0];

    tocContainer.innerHTML = '';
    tocTree.forEach((node) => {
        tocContainer.appendChild(renderTocNode(node, active.id, safeSlug));
    });

    if (active.depth === 1) {
        const firstH2 = structure.headings.find(h => h.depth === 2 && h.h1Id === active.id && h.lineIndex > active.lineIndex);
        const h1End = firstH2 ? firstH2.lineIndex : active.endLineIndex;
        const directContent = structure.lines.slice(active.lineIndex + 1, h1End).join('\n').trim();
        if (!directContent) {
            return '';
        }
        const h1Block = [`# ${active.title}`, directContent].join('\n\n').trim();
        return `${h1Block}\n`;
    }

    if (active.depth === 2) {
        const firstH3 = structure.headings.find(h => h.depth === 3 && h.h2Id === active.id && h.lineIndex > active.lineIndex);
        const h2End = firstH3 ? firstH3.lineIndex : active.endLineIndex;
        const selectedBlock = structure.lines.slice(active.lineIndex + 1, h2End).join('\n').trim();
        if (!selectedBlock) {
            return '';
        }

        const h1 = structure.headings.find(h => h.id === active.h1Id);
        const parts = [];
        if (h1) {
            parts.push(`# ${h1.title}`);
        }
        parts.push(`## ${active.title}`);
        parts.push(selectedBlock);
        return `${parts.join('\n\n')}\n`;
    }

    const h1 = structure.headings.find(h => h.id === active.h1Id);
    const h2 = structure.headings.find(h => h.id === active.h2Id);
    const selectedBlock = structure.lines.slice(active.lineIndex + 1, active.endLineIndex).join('\n').trim();
    if (!selectedBlock) {
        return '';
    }

    const parts = [];
    if (h1) {
        parts.push(`# ${h1.title}`);
    }
    if (h2) {
        parts.push(`## ${h2.title}`);
    }
    parts.push(selectedBlock);

    return `${parts.join('\n\n')}\n`;
}


function applyPostHero(safeSlug) {
    const heroTitle = document.getElementById('post-hero-title');
    const heroSubtitle = document.getElementById('post-hero-subtitle');
    if (!heroTitle || !heroSubtitle) {
        return;
    }

    if (safeSlug === 'critical-phenomena-natural-science') {
        heroTitle.textContent = '自然科学中的临界现象：';
        heroTitle.classList.add('post-hero-title-custom');
        heroSubtitle.textContent = '混沌、分形、自组织与无序的概念及方法';
        heroSubtitle.classList.add('post-hero-subtitle-custom');
        return;
    }

    heroTitle.textContent = 'Blog Post';
    heroSubtitle.textContent = '';
}

function typesetMathIfNeeded(retryLeft = 12) {
    if (window.MathJax?.typesetPromise) {
        window.MathJax.typesetPromise().catch((error) => {
            console.error('MathJax typeset failed:', error);
        });
        return;
    }

    if (retryLeft > 0) {
        window.setTimeout(() => typesetMathIfNeeded(retryLeft - 1), 200);
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    const postContainer = document.getElementById('post-md');
    const tocPanel = document.getElementById('post-toc');
    if (!postContainer) {
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const postSlug = urlParams.get('post');

    if (!postSlug) {
        postContainer.innerHTML = '<p>Post not specified. Please open from <a href="Blog.html">Blog</a>.</p>';
        return;
    }

    const safeSlug = postSlug.replace(/[^a-zA-Z0-9-_]/g, '');
    const postPath = `contents/blog_posts/${safeSlug}.md`;
    applyPostHero(safeSlug);

    try {
        const response = await fetch(postPath);
        if (!response.ok) {
            throw new Error(`Failed to load ${postPath}`);
        }

        marked.use({ mangle: false, headerIds: false });
        const markdown = await response.text();
        const globalFootnotes = extractFootnoteDefinitions(markdown);
        const tocEnabled = TOC_ENABLED_POSTS.has(safeSlug);

        let markdownForRendering = markdown;
        if (tocEnabled) {
            markdownForRendering = buildSingleUnitMarkdown(markdown, safeSlug);
            if (tocPanel) {
                tocPanel.classList.remove('d-none');
            }
        } else if (tocPanel) {
            tocPanel.classList.add('d-none');
            const layout = document.querySelector('.blog-post-layout');
            const contentCol = postContainer.closest('.col-lg-9');
            if (layout) {
                layout.classList.add('blog-post-layout-single');
            }
            if (contentCol) {
                contentCol.classList.remove('col-lg-9');
                contentCol.classList.add('col-12');
            }
        }

        const protectedMath = protectMathDelimiters(markdownForRendering);
        const markdownWithFootnotes = enhanceFootnotes(protectedMath.result, globalFootnotes);
        const parsedHtml = marked.parse(markdownWithFootnotes);
        postContainer.innerHTML = restoreMathTokens(parsedHtml, protectedMath.tokens);
        typesetMathIfNeeded();
    } catch (error) {
        console.error(error);
        postContainer.innerHTML = `<p>Post not found: <code>${safeSlug}</code>.</p>`;
    }
});
