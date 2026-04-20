function slugifyHeading(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

function ensureHeadingIds(postContainer) {
    const seen = new Map();
    const headings = Array.from(postContainer.querySelectorAll('h1, h2, h3'));

    headings.forEach((heading) => {
        const base = slugifyHeading(heading.textContent || 'section') || 'section';
        const count = seen.get(base) || 0;
        seen.set(base, count + 1);
        heading.id = count === 0 ? base : `${base}-${count}`;
    });

    return headings;
}

function buildHeadingTree(headings) {
    const root = [];
    const stack = [];

    headings.forEach((heading) => {
        const node = {
            id: heading.id,
            title: heading.textContent || '',
            level: Number(heading.tagName.slice(1)),
            children: [],
        };

        while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
            stack.pop();
        }

        if (stack.length === 0) {
            root.push(node);
        } else {
            stack[stack.length - 1].children.push(node);
        }
        stack.push(node);
    });

    return root;
}

function renderTocNode(node) {
    const item = document.createElement('div');
    item.className = `toc-item toc-level-${node.level}`;

    if (node.children.length === 0) {
        const link = document.createElement('a');
        link.className = 'toc-link';
        link.href = `#${node.id}`;
        link.textContent = node.title;
        item.appendChild(link);
        return item;
    }

    const details = document.createElement('details');
    details.open = true;

    const summary = document.createElement('summary');
    const summaryInner = document.createElement('span');
    summaryInner.className = 'toc-summary-inner';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'toc-toggle';
    toggle.setAttribute('aria-label', '展开或折叠子目录');
    toggle.textContent = '▾';

    const link = document.createElement('a');
    link.className = 'toc-link';
    link.href = `#${node.id}`;
    link.textContent = node.title;

    details.addEventListener('toggle', () => {
        toggle.textContent = details.open ? '▾' : '▸';
    });

    toggle.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        details.open = !details.open;
    });

    summaryInner.append(toggle, link);
    summary.appendChild(summaryInner);
    details.appendChild(summary);

    const children = document.createElement('div');
    children.className = 'toc-children';
    node.children.forEach((child) => {
        children.appendChild(renderTocNode(child));
    });
    details.appendChild(children);

    item.appendChild(details);
    return item;
}

function renderToc(postContainer) {
    const tocContainer = document.getElementById('post-toc-content');
    if (!tocContainer) {
        return;
    }

    const headings = ensureHeadingIds(postContainer);
    if (headings.length === 0) {
        tocContainer.innerHTML = '<p class="post-toc-placeholder">该文章暂无目录项。</p>';
        return;
    }

    const tree = buildHeadingTree(headings);
    tocContainer.innerHTML = '';
    tree.forEach((node) => {
        tocContainer.appendChild(renderTocNode(node));
    });
}

function enhanceFootnotes(markdown) {
    const definitionRegex = /^\[\^([^\]]+)\]:\s*(.+(?:\n(?: {2,}.+|\t.+)*)?)/gm;
    const definitions = new Map();
    let definitionsRemoved = markdown;
    let match;

    while ((match = definitionRegex.exec(markdown)) !== null) {
        const key = match[1].trim();
        const value = match[2].replace(/\n(?: {2,}|\t)/g, '\n').trim();
        definitions.set(key, value);
    }

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

function typesetMathIfNeeded() {
    if (window.MathJax?.typesetPromise) {
        window.MathJax.typesetPromise().catch((error) => {
            console.error('MathJax typeset failed:', error);
        });
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    const postContainer = document.getElementById('post-md');
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
        const markdownWithFootnotes = enhanceFootnotes(markdown);
        postContainer.innerHTML = marked.parse(markdownWithFootnotes);
        renderToc(postContainer);
        typesetMathIfNeeded();
    } catch (error) {
        console.error(error);
        postContainer.innerHTML = `<p>Post not found: <code>${safeSlug}</code>.</p>`;
    }
});
