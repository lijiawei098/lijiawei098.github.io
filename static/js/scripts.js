const contentDir = 'contents/';
const configFile = 'config.yml';
const sectionNames = ['home', 'publications', 'news', 'CV', 'AoyuX', 'Blog'];

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
