# Mark Anthony portfolio

A responsive navy portfolio with continuous scrolling, sidebar navigation, and a private content editor. Built with Node.js and browser JavaScript; no third-party runtime packages are required. The Vercel build command validates deployment files.

The main website flows vertically from Home to Portfolio and through every section to FAQs & contact. Sidebar buttons jump to the matching section, and the active button follows visitors as they scroll. Direct section links still work. Service details, individual blog posts, and experience details retain their own views, with links back to the corresponding section.

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

**Gallery:** Organize photos into albums so visitors see a cover and photo count before opening an album's pictures. In **Gallery → Albums**, choose **Add album**, enter its title and description, then use **Manage pictures** to add photos or move existing pictures into it. Choose a cover from the album's pictures; otherwise its first picture becomes the cover. Empty albums remain in the editor until you add a picture. Photos without an album appear under **Other pictures**. Use the arrows to order albums and the pictures inside them. Deleting an album moves its pictures to **Other pictures** and keeps their existing website placements and image references.

In **Gallery → Pictures**, upload photos, add titles and captions, and choose an album for each picture. Photos can also appear in selected website sections or attach to specific blog posts, portfolio websites, services, projects, and experience entries. These placements continue to show the selected pictures. Existing photo and logo fields offer **Choose from Gallery**, with an album filter, so one uploaded picture can be reused throughout the site. Removing a Gallery picture removes its Gallery placements; photos already chosen in other image fields remain in those fields. Upload files remain stored for reuse. No SQL rerun is required.

**Service pages:** Service cards on Home and Services open a dedicated page. In **Services**, edit the overview, task list, optional cover, and ordered text/image/website blocks. Use **Add portfolio website** or **Add project sample** inside a service to create a linked item, or assign **Related services** on existing Portfolio and Projects entries. Tools and testimonials follow their existing service assignments. Portfolio website links appear below tools on service cards and on the detail page. Links keep their assignments when service names change; deleting a service removes the associated references while preserving the work and reviews.

**My Process:** Each service has its own independent workflow, with its own title, introduction, and ordered steps. In the **My Process** editor, choose **Edit process for** → **General process** or a service. If that service has no workflow yet, choose **Create process**, then add, delete, or reorder its steps and edit their text and icons. Each workflow starts at step 1. Visitors can choose a service or see **All services**, where workflows appear in separate labeled sections. Search matches a complete workflow and keeps its entire sequence visible.

The general process retains its suggested four-step starter layout (Discover, Plan, Execute, Improve) and Home summary. Cards appear across the page on desktop and vertically on mobile. Older steps assigned to services migrate into separate editable workflows for those services; previously unassigned steps remain in the general process. Edit each workflow to match how you work. No SQL rerun is needed.

**My Experience:** Add companies or people you have worked with, including a photo or logo, your role, dates, an overview, and highlights. Each experience card opens a page with more information and related work. In the editor, link an experience to services, portfolio websites, projects, tools, testimonials, process steps, and blog posts, or add labeled website URLs. The linked sections reuse their original content, and matching services show the related experience so visitors can browse in either direction. Deleting linked content removes its references without deleting the experience or other collections. Experience starts empty; add only your own work history.

- **Portfolio** adds separate website showcases with highlighted names, screenshots, descriptions, and **Visit site** links. The sidebar places Portfolio directly below Home; existing Projects remain intact.
- **Social links** accepts any platform name and profile URL, with optional custom icons. Links appear in the sidebar and as larger labeled contact buttons. You can reorder or remove them.
- **About photos** adds pictures separately from your profile photo. Choose left, right, above, or below your biography, set the crop focus, and use the arrows to order photos. On mobile these positions become a vertical layout.
- **Testimonials** lets you select one or more services for each review. Visitors use **Testimonials for** to choose a service or view **All services**. Existing reviews remain visible under All services until you assign them. Service names and filter options follow your editable Services list.
- **Tools** is your complete tool list; each entry can have a custom logo, description, and website link. **Tools by role** creates headings such as SMM Tools, selects tools from the complete list, and links them to services. A tool can belong to several specialties. The matching service pages show only their assigned tools.

Older saved content is upgraded in memory without modifying the database. Saving in the editor stores the new fields; no SQL rerun is required. All original profile content, projects, and blog posts are retained. Photo and logo uploads accept PNG, JPG, WebP, or GIF up to 3 MB.

The name and initial tool list are editable starter content. Projects, testimonials, experience entries, and blog posts start empty so no client results or endorsements are invented. Add your email or booking URL under **Photos & contact** to enable contact actions. Blog post text is plain text with preserved paragraphs.

## Online hosting with Vercel and Supabase

See [DEPLOYMENT.md](DEPLOYMENT.md) for the free-tier setup walkthrough. The hosted website uses Supabase Authentication, an owner-protected content table, and a public photo bucket. Vercel is explicitly configured with the **Other** preset (`framework: null`) and serves `public/` and a `/api/config` endpoint that exposes only the public project URL and publishable key. No service-role or secret API key is required. Initialize the database using [supabase/setup.sql](supabase/setup.sql). The browser adapter keeps draft posts private through the database public-read function, refreshes login sessions, and rejects saving stale content after another session edits it.

`npm run build` checks the Vercel deployment files. The local server lives in `scripts/local-server.js` so it cannot be auto-detected as the Vercel production entry point. Local `npm start` continues to use local data and generated-password authentication; local content is not automatically synced with Supabase. The cloud starts with the SQL script’s starter content. Follow the deployment walkthrough to publish and verify the real hosted site.

## Local storage

All saved content, image files, and authentication data live in the ignored `.data/` directory. Preserve and back up this directory; it contains the site's content and access credentials. `DATA_DIR` can point to a different persistent directory. Restarting the server preserves content and uploads; login sessions reset. This version is intended for one owner and one running server instance. Deploy on a Node-compatible server with a persistent writable volume, not a static-only host or ephemeral serverless filesystem. Use HTTPS and set `COOKIE_SECURE=true` for a public deployment. Do not expose `.data/` through another static server.

The contact section uses your real email or booking link; there is no simulated contact form or email delivery service. The website is built and runnable locally; hosting and domain publication are separate steps.
