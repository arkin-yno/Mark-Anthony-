# Mark Anthony portfolio

A responsive navy portfolio with sidebar navigation and a private content editor. Built with Node.js and browser JavaScript; no third-party runtime packages are required. The Vercel build command validates deployment files.

## Run

Use Node.js 22 or later (tested with 24). From this checkout:

```sh
npm start
```

The default port is 3000. Configure `PORT` and `HOST` when needed. Run `npm ci --cache /tmp/portfolio-npm-cache` to install the development test dependency, then `npm test` for integration checks.

## Edit your website

Choose **Manage website** at the bottom of the sidebar to open the private admin area. On first startup, the server creates a random admin password in `.data/admin-password.txt`, readable only by the server account. Read this private local file to sign in; never commit or share it. Change your password in **Account** after signing in. Alternatively, securely set `ADMIN_PASSWORD` before the first run. This variable only initializes a new installation; it does not overwrite an existing password.

Use the editor to change website text, profile and project photos, contact links, services, tools, FAQs, and testimonials. Blog posts support ordered text and image blocks, cover images, captions, drafts, publishing, and unpublishing. **Preview** shows unsaved content; **Save changes** applies website edits and published posts to the public site. Uploaded images become public files, so do not upload confidential pictures. Removing a picture from content removes its reference, while the stored upload remains available for other uses.

### New editor sections

**Service pages:** Service cards on Home and Services open a dedicated page. In **Services**, edit the overview, task list, optional cover, and ordered text/image/website blocks. Use **Add portfolio website** or **Add project sample** inside a service to create a linked item, or assign **Related services** on existing Portfolio and Projects entries. Tools and testimonials follow their existing service assignments. Portfolio website links appear below tools on service cards and on the detail page. Links keep their assignments when service names change; deleting a service removes the associated references while preserving the work and reviews.

**My Process:** The sidebar places this page below Testimonials. Its starter layout has four numbered steps (Discover, Plan, Execute, Improve), with cards on desktop and a vertical layout on mobile. Edit the page heading, introduction, step names, descriptions, and icons; add, delete, or reorder steps in the **My Process** editor. The starter copy is a suggested workflow that you can personalize.

- **Portfolio** adds separate website showcases with highlighted names, screenshots, descriptions, and **Visit site** links. The sidebar places Portfolio directly below Home; existing Projects remain intact.
- **Social links** accepts any platform name and profile URL, with optional custom icons. Links appear in the sidebar and as larger labeled contact buttons. You can reorder or remove them.
- **About photos** adds pictures separately from your profile photo. Choose left, right, above, or below your biography, set the crop focus, and use the arrows to order photos. On mobile these positions become a vertical layout.
- **Testimonials** lets you select one or more services for each review. Visitors use **Testimonials for** to choose a service or view **All services**. Existing reviews remain visible under All services until you assign them. Service names and filter options follow your editable Services list.
- **Tools** is your complete tool list; each entry can have a custom logo, description, and website link. **Tools by role** creates headings such as SMM Tools, selects tools from the complete list, and links them to services. A tool can belong to several specialties. The matching service pages show only their assigned tools.

Older saved content is upgraded in memory without modifying the database. Saving in the editor stores the new fields; no SQL rerun is required. All original profile content, projects, and blog posts are retained. Photo and logo uploads accept PNG, JPG, WebP, or GIF up to 3 MB.

The name and initial tool list are editable starter content. Projects, testimonials, and blog posts start empty so no client results or endorsements are invented. Add your email or booking URL under **Photos & contact** to enable contact actions. Blog post text is plain text with preserved paragraphs.

## Online hosting with Vercel and Supabase

See [DEPLOYMENT.md](DEPLOYMENT.md) for the free-tier setup walkthrough. The hosted website uses Supabase Authentication, an owner-protected content table, and a public photo bucket. Vercel is explicitly configured with the **Other** preset (`framework: null`) and serves `public/` and a `/api/config` endpoint that exposes only the public project URL and publishable key. No service-role or secret API key is required. Initialize the database using [supabase/setup.sql](supabase/setup.sql). The browser adapter keeps draft posts private through the database public-read function, refreshes login sessions, and rejects saving stale content after another session edits it.

`npm run build` checks the Vercel deployment files. The local server lives in `scripts/local-server.js` so it cannot be auto-detected as the Vercel production entry point. Local `npm start` continues to use local data and generated-password authentication; local content is not automatically synced with Supabase. The cloud starts with the SQL script’s starter content. Follow the deployment walkthrough to publish and verify the real hosted site.

## Local storage

All saved content, image files, and authentication data live in the ignored `.data/` directory. Preserve and back up this directory; it contains the site's content and access credentials. `DATA_DIR` can point to a different persistent directory. Restarting the server preserves content and uploads; login sessions reset. This version is intended for one owner and one running server instance. Deploy on a Node-compatible server with a persistent writable volume, not a static-only host or ephemeral serverless filesystem. Use HTTPS and set `COOKIE_SECURE=true` for a public deployment. Do not expose `.data/` through another static server.

The contact section uses your real email or booking link; there is no simulated contact form or email delivery service. The website is built and runnable locally; hosting and domain publication are separate steps.
