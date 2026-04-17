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
        const markdown = await response.text();
        postContainer.innerHTML = marked.parse(markdown);
    } catch (error) {
        console.error(error);
        postContainer.innerHTML = `<p>Post not found: <code>${safeSlug}</code>.</p>`;
    }
});
