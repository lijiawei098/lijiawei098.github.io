function slugifyHeading(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

const TOC_ENABLED_POSTS = new Set(['critical-phenomena-natural-science']);

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
    let definitionsRemoved = markdown;
    definitionsRemoved = definitionsRemoved.replace(definitionRegex, '').trimEnd();

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
        .map((key, idx) => `<li id="fn-${key}">${marked.parseInline(definitions.get(key))} <a href="#fnref-${key}" class="footnote-backref" aria-label="Back to reference">↩︎</a></li>`)
        .join('\n');

    return `${textWithSup}\n\n<section class="post-footnotes">\n<h2>脚注 | Footnotes</h2>\n<ol>\n${items}\n</ol>\n</section>\n`;
}

function buildSectionNavigation(markdown, safeSlug) {
    const tocContainer = document.getElementById('post-toc-content');
    if (!tocContainer) {
        return markdown;
    }

    const sectionRegex = /^##\s+([一二三四五六七八九十]+、.+)$/gm;
    const matches = Array.from(markdown.matchAll(sectionRegex));
    if (matches.length === 0) {
        tocContainer.innerHTML = '<p class="post-toc-placeholder">该文章暂无目录项。</p>';
        return markdown;
    }

    const sections = matches.map((match, i) => {
        const startIndex = match.index ?? 0;
        const endIndex = i + 1 < matches.length ? (matches[i + 1].index ?? markdown.length) : markdown.length;
        const title = match[1].trim();
        return {
            id: slugifyHeading(title) || `section-${i + 1}`,
            title,
            startIndex,
            endIndex,
        };
    });

    const urlParams = new URLSearchParams(window.location.search);
    const requested = urlParams.get('section');
    const active = sections.find(section => section.id === requested) ?? sections[0];

    tocContainer.innerHTML = '';
    sections.forEach((section) => {
        const item = document.createElement('div');
        item.className = 'toc-item toc-level-2';
        if (section.id === active.id) {
            item.classList.add('toc-item-active');
        }
        const link = document.createElement('a');
        link.className = 'toc-link';
        link.href = `blog_post.html?post=${safeSlug}&section=${section.id}`;
        link.textContent = section.title;
        item.appendChild(link);
        tocContainer.appendChild(item);
    });

    const prefixMarkdown = markdown.slice(0, sections[0].startIndex).trimEnd();
    const selectedMarkdown = markdown.slice(active.startIndex, active.endIndex).trim();
    return `${prefixMarkdown}\n\n${selectedMarkdown}\n`;
}

function typesetMathIfNeeded() {
    if (window.MathJax?.typesetPromise) {
        window.MathJax.typesetPromise().catch((error) => {
            console.error('MathJax typeset failed:', error);
        });
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
            markdownForRendering = buildSectionNavigation(markdown, safeSlug);
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

        const markdownWithFootnotes = enhanceFootnotes(markdownForRendering, globalFootnotes);
        postContainer.innerHTML = marked.parse(markdownWithFootnotes);
        typesetMathIfNeeded();
    } catch (error) {
        console.error(error);
        postContainer.innerHTML = `<p>Post not found: <code>${safeSlug}</code>.</p>`;
    }
});
