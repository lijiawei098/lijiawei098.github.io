const contentDir = 'contents/';
const configFile = 'config.yml';
const sectionNames = ['home', 'publications', 'CV', 'AoyuX', 'Blog'];

async function fetchTextOrThrow(path) {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${path}: ${response.status} ${response.statusText}`);
    }
    return response.text();
}

function applyYamlConfig(yml) {
    Object.entries(yml).forEach(([key, value]) => {
        const element = document.getElementById(key);
        if (!element) {
            console.warn(`Config key skipped (missing element id): ${key}`);
            return;
        }

        if (typeof value === 'string') {
            element.innerHTML = value.replace('{year}', String(new Date().getFullYear()));
        } else {
            element.textContent = String(value);
        }
    });
}

function renderMarkdownToContainer(markdown, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        return false;
    }
    const html = marked.parse(markdown);
    container.innerHTML = html;
    return true;
}

function splitNewsEntries(markdown) {
    const normalized = markdown.trim();
    if (!normalized) {
        return [];
    }

    return normalized
        .split(/\n\s*\n(?=-\s)/)
        .map(entry => entry.trim())
        .filter(entry => entry.startsWith('- '));
}

function parseNewsDate(entry) {
    const match = entry.match(/<strong>([^<]+)<\/strong>/i);
    if (!match) {
        return null;
    }

    const raw = match[1].trim().replace(/[–—]/g, '-');
    const yearMatch = raw.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? yearMatch[0] : '';

    let candidate = raw.includes('-') ? raw.split('-', 1)[0].trim() : raw;
    if (year && !/\b(19|20)\d{2}\b/.test(candidate)) {
        candidate = `${candidate}, ${year}`;
    }

    const parsed = Date.parse(candidate);
    if (Number.isNaN(parsed)) {
        return null;
    }

    return new Date(parsed);
}

function getSixMonthCutoff(now = new Date()) {
    const cutoff = new Date(now);
    cutoff.setMonth(cutoff.getMonth() - 6);
    cutoff.setHours(0, 0, 0, 0);
    return cutoff;
}

function deduplicateEntries(entries) {
    const seen = new Set();
    const unique = [];

    entries.forEach((entry) => {
        if (!seen.has(entry)) {
            seen.add(entry);
            unique.push(entry);
        }
    });

    return unique;
}

function partitionNewsEntries(entries, cutoff) {
    const recent = [];
    const archived = [];

    entries.forEach((entry) => {
        const date = parseNewsDate(entry);
        if (!date || date >= cutoff) {
            recent.push(entry);
            return;
        }
        archived.push(entry);
    });

    return { recent, archived };
}

function sortEntriesByDateDescending(entries) {
    return [...entries].sort((a, b) => {
        const dateA = parseNewsDate(a);
        const dateB = parseNewsDate(b);
        if (dateA && dateB) {
            return dateB.getTime() - dateA.getTime();
        }
        if (dateA) {
            return -1;
        }
        if (dateB) {
            return 1;
        }
        return 0;
    });
}

function buildArchivedMarkdownWithYearHeadings(entries) {
    if (entries.length === 0) {
        return '- _No archived activities yet._\n';
    }

    const groups = new Map();

    entries.forEach((entry) => {
        const date = parseNewsDate(entry);
        const year = date ? String(date.getFullYear()) : 'Unknown';
        if (!groups.has(year)) {
            groups.set(year, []);
        }
        groups.get(year).push(entry);
    });

    const sections = [];
    groups.forEach((yearEntries, year) => {
        sections.push(`#### ${year}\n\n${yearEntries.join('\n\n')}`);
    });

    return `${sections.join('\n\n')}\n`;
}

async function renderNewsAndActivitiesWithAutoSplit() {
    const hasNewsContainer = Boolean(document.getElementById('news-md'));
    const hasActivitiesContainer = Boolean(document.getElementById('activities-md'));

    if (!hasNewsContainer && !hasActivitiesContainer) {
        return;
    }

    const [newsResult, activitiesResult] = await Promise.allSettled([
        fetchTextOrThrow(`${contentDir}news.md`),
        fetchTextOrThrow(`${contentDir}activities.md`),
    ]);

    if (newsResult.status !== 'fulfilled') {
        console.error('Failed to load news.md for auto split:', newsResult.reason);
        return;
    }

    const newsEntries = splitNewsEntries(newsResult.value);
    const activityEntries = activitiesResult.status === 'fulfilled' ? splitNewsEntries(activitiesResult.value) : [];
    const merged = deduplicateEntries([...newsEntries, ...activityEntries]);
    const sorted = sortEntriesByDateDescending(merged);

    const cutoff = getSixMonthCutoff();
    const { recent, archived } = partitionNewsEntries(sorted, cutoff);

    if (hasNewsContainer) {
        const recentMarkdown = recent.length > 0 ? `${recent.join('\n\n')}\n` : '- _No recent news in the past six months._\n';
        renderMarkdownToContainer(recentMarkdown, 'news-md');
    }

    if (hasActivitiesContainer) {
        const archivedMarkdown = buildArchivedMarkdownWithYearHeadings(archived);
        renderMarkdownToContainer(archivedMarkdown, 'activities-md');
    }
}

function typesetMathIfNeeded() {
    if (window.MathJax?.typesetPromise) {
        window.MathJax.typesetPromise().catch(err => console.error('MathJax typeset failed:', err));
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    const mainNav = document.body.querySelector('#mainNav');
    if (mainNav) {
        new bootstrap.ScrollSpy(document.body, {
            target: '#mainNav',
            offset: 74,
        });
    }

    const navbarToggler = document.body.querySelector('.navbar-toggler');
    const responsiveNavItems = [].slice.call(document.querySelectorAll('#navbarResponsive .nav-link'));
    responsiveNavItems.forEach((responsiveNavItem) => {
        responsiveNavItem.addEventListener('click', () => {
            if (navbarToggler && window.getComputedStyle(navbarToggler).display !== 'none') {
                navbarToggler.click();
            }
        });
    });

    try {
        const configText = await fetchTextOrThrow(contentDir + configFile);
        const yml = jsyaml.load(configText);
        applyYamlConfig(yml);
    } catch (error) {
        console.error('Failed to load YAML config:', error);
    }

    marked.use({ mangle: false, headerIds: false });

    await renderNewsAndActivitiesWithAutoSplit();

    for (const name of sectionNames) {
        const targetId = `${name}-md`;
        if (!document.getElementById(targetId)) {
            continue;
        }

        try {
            const markdown = await fetchTextOrThrow(`${contentDir}${name}.md`);
            renderMarkdownToContainer(markdown, targetId);
        } catch (error) {
            console.error(`Failed to load section ${name}:`, error);
        }
    }

    typesetMathIfNeeded();
});
