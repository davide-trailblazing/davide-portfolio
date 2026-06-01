# Your portfolio website — how to put it online

This folder is a complete, self-contained website. Two files:

- **index.html** — your portfolio page (the "V1 banker" version)
- **infographic.pdf** — your one-page Venture Portfolio. The **⬇ Download infographic (PDF)** button on the page serves this exact file.

Keep both files together in the same folder. The button looks for `infographic.pdf` sitting right next to `index.html`.

## Fastest way to get a live link (Netlify Drop — free, ~2 minutes)

1. Go to **app.netlify.com/drop**
2. Drag this whole folder (`2026-05-30-jpm-portfolio-website-deploy`) onto the page.
3. Netlify gives you a live URL immediately (something like `random-name-123.netlify.app`).
4. For a clean URL you control: create a free Netlify account, then in **Site settings → Change site name**, rename it (e.g. `davide-dantonio.netlify.app`) or add a custom domain. Once named, the link never changes.

## Updating later WITHOUT changing the URL

- Make a free Netlify account and keep the site (don't use anonymous one-off drops).
- To update: replace the files in this folder (for example drop in a newer `infographic.pdf`, or an updated `index.html`), then drag the folder onto your existing site's **Deploys** tab.
- The URL stays the same — only the content refreshes. This is exactly what you wanted: improve the infographic in a future chat, swap the file, redeploy, same link.

## Alternative: GitHub Pages

1. Create a public GitHub repo and upload `index.html` + `infographic.pdf`.
2. **Settings → Pages →** deploy from the `main` branch, root folder.
3. Your URL: `https://<username>.github.io/<repo>/`. Stable as long as the repo name stays the same.

## Using the link on your résumé / cover letter

Put the website URL as your **"Venture Portfolio"** hyperlink. Recruiters read the page and can click **Download** for the PDF one-pager. The single-page PDF in this bundle is **Style A** — if you'd rather serve Style B, Style C, or all three pages, just say so and I'll swap the file.
