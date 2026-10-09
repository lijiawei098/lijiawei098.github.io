// Pre-render the existing Markdown with the same parser and news logic as the browser.
// No npm installation is needed. Run before publishing: node tools/build_seo.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const marked = require('../static/js/marked.min.js');
const yaml = require('../static/js/js-yaml.min.js');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, value) => fs.writeFileSync(path.join(root, file), value);
const origin = 'https://lijiawei098.github.io/';
const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const config = yaml.load(read('contents/config.yml'));
marked.use({ mangle: false, headerIds: false });

// Reuse the browser's date parsing, deduplication and six-month cutoff.
const newsContext = vm.createContext({ window: { addEventListener() {} } });
vm.runInContext(read('static/js/scripts.js'), newsContext);
newsContext.newsMarkdown = read('contents/news.md');
newsContext.activitiesMarkdown = read('contents/activities.md');
const news = vm.runInContext(String.raw`(() => {
    const entries = sortEntriesByDateDescending(deduplicateEntries([
        ...splitNewsEntries(newsMarkdown), ...splitNewsEntries(activitiesMarkdown)
    ]));
    const { recent, archived } = partitionNewsEntries(entries, getSixMonthCutoff());
    return {
        recent: recent.length ? recent.join('\n\n') : '- _No recent news in the past six months._',
        archived: buildArchivedMarkdownWithYearHeadings(archived)
    };
})()`, newsContext);

const pages = [
    ['index.html', '李佳威 Jiawei Li | 地震学 | 南方科技大学 SUSTech', '李佳威（Jiawei Li），南方科技大学 Risks-X 研究助理教授。研究方向：统计地震学、实时地震学、地震预测与地震损失估计。Academic homepage, publications and CV.'],
    ['CV.html', 'Curriculum Vitae | 李佳威 Jiawei Li', 'Education, academic appointments and research experience of Jiawei Li (李佳威), earthquake seismologist at SUSTech.'],
    ['publications.html', 'Publications | 李佳威 Jiawei Li', 'Research publications by Jiawei Li (李佳威) on statistical seismology, earthquake forecasting and earthquake loss estimation.'],
    ['activities.html', 'Activities & News | 李佳威 Jiawei Li', 'Academic activities, conference presentations and research news from Jiawei Li (李佳威).'],
    ['aoyux.html', 'AoyuX CSES Reports | 李佳威 Jiawei Li', 'AoyuX research group reports and earthquake seismology research.'],
    ['aoyux_about.html', 'About AoyuX | 李佳威 Jiawei Li', 'Meet the AoyuX research team and former team members.'],
    ['Blog.html', 'Blog | 李佳威 Jiawei Li', '李佳威的地震学博客：地震统计物理学、临界现象与地震模型。Seismology articles by Jiawei Li.'],
];

// Markers make repeat builds replace whole generated blocks, including nested HTML.
function fill(html, id, content) {
    const start = `<!-- prerender:${id} -->`;
    const end = `<!-- /prerender:${id} -->`;
    const block = `${start}${content.replace(/[ \t]+$/gm, '')}${end}`;
    if (html.includes(start)) {
        const before = html.indexOf(start);
        const after = html.indexOf(end, before);
        if (after < 0) throw new Error(`Missing end marker for ${id}`);
        return html.slice(0, before) + block + html.slice(after + end.length);
    }
    const pattern = new RegExp(`(<([a-z][a-z0-9]*)\\b[^>]*\\bid="${id}"[^>]*>)[\\s\\S]*?(</\\2>)`, 'i');
    if (!pattern.test(html)) throw new Error(`Missing element ${id}`);
    return html.replace(pattern, (_, opening, tag, closing) => opening + block + closing);
}

for (const [file, title, description] of pages) {
    let html = read(file);
    html = html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/, `<title id="title">${escape(title)}</title>`);
    html = html.replace(/<meta name="description"[^>]*\/>/, `<meta name="description" content="${escape(description)}" />`);
    const url = origin + (file === 'index.html' ? '' : file);
    const metadata = [
        '<!-- seo:start -->',
        `<link rel="canonical" href="${url}" />`,
        '<meta name="robots" content="index, follow" />',
        '<meta property="og:type" content="website" />',
        `<meta property="og:title" content="${escape(title)}" />`,
        `<meta property="og:description" content="${escape(description)}" />`,
        `<meta property="og:url" content="${url}" />`,
        `<meta property="og:image" content="${origin}static/assets/img/photo.jpg" />`,
    ];
    if (file === 'index.html') {
        const person = {
            '@context': 'https://schema.org', '@type': 'ProfilePage', '@id': origin + '#profile', url: origin,
            mainEntity: {
                '@type': 'Person', '@id': origin + '#person', name: 'Jiawei Li', alternateName: '李佳威',
                url: origin, image: origin + 'static/assets/img/photo.jpg', jobTitle: 'Research Assistant Professor',
                affiliation: { '@type': 'Organization', name: 'Southern University of Science and Technology (SUSTech)' },
                knowsAbout: ['Statistical seismology', 'Real-time seismology', 'Earthquake forecasting', 'Earthquake loss estimation'],
                sameAs: ['https://scholar.google.com.hk/citations?user=_IZjtm4AAAAJ&hl=zh-CN', 'https://www.researchgate.net/profile/Jiawei-Li-26', 'https://orcid.org/0000-0003-1226-8162']
            }
        };
        metadata.push(`<script type="application/ld+json">${JSON.stringify(person).replace(/</g, '\\u003c')}</script>`);
    }
    metadata.push('<!-- seo:end -->');
    const block = metadata.join('\n    ');
    html = html.includes('<!-- seo:start -->')
        ? html.replace(/<!-- seo:start -->[\s\S]*?<!-- seo:end -->/, () => block)
        : html.replace('</head>', () => `    ${block}\n</head>`);

    for (const [id, value] of Object.entries(config)) {
        if (id !== 'title' && html.includes(`id="${id}"`)) {
            html = fill(html, id, String(value).replace('{year}', String(new Date().getFullYear())));
        }
    }
    for (const section of ['home', 'CV', 'publications', 'AoyuX', 'Blog']) {
        if (html.includes(`id="${section}-md"`)) html = fill(html, `${section}-md`, marked.parse(read(`contents/${section}.md`)));
    }
    if (html.includes('id="news-md"')) html = fill(html, 'news-md', marked.parse(news.recent));
    if (html.includes('id="activities-md"')) html = fill(html, 'activities-md', marked.parse(news.archived));
    if (file === 'index.html') {
        html = html.replace(/<h2 id="home-subtitle">([\s\S]*?)<\/h2>/, '<h1 id="home-subtitle" class="h2">$1</h1>');
        html = html.replace('src="static/assets/img/photo.jpg" style=', 'src="static/assets/img/photo.jpg" alt="李佳威 Jiawei Li" style=');
    }
    write(file, html);
    console.log(`Pre-rendered ${file}`);
}

// Include only the real canonical pages, not an empty query-based article shell.
write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + pages.map(([file]) => `  <url><loc>${origin}${file === 'index.html' ? '' : file}</loc></url>`).join('\n') + '\n</urlset>\n');
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${origin}sitemap.xml\n`);
