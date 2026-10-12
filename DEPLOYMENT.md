# Put your portfolio online with Vercel and Supabase

This setup serves the website from Vercel and stores content, photos, and owner authentication in Supabase. Both services offer free tiers with quotas and provider-specific usage conditions. Choose the free options and review the plan terms; Vercel Hobby is for personal, noncommercial use. If your portfolio's use falls outside Hobby eligibility, choose a compatible host or paid plan. No domain purchase is required.

## 1. Create your Supabase project

1. In the Supabase dashboard, choose **New project** in a Free organization.
2. Name it `my-portfolio`, choose a region near you, and set a database password. Keep this password private; the website does not need it.
3. Wait until the project is ready.

## 2. Create your private editor login

1. In your project, go to **Authentication → Users**.
2. Choose **Add user → Create new user**.
3. Enter your own email and a strong password of at least 12 characters. Enable **Auto Confirm User** if offered.
4. In **Authentication → Sign In / Providers → Email**, turn off **Allow new users to sign up** if available. The website has no signup form and its database policies allow only the designated owner regardless.

This email and password are what you will use in the website's **Manage website** editor. They are separate from your Supabase dashboard login and database password. If you forget the editor password, reset it through Supabase's user management; the website has no email password-reset screen yet.

## 3. Initialize your saved content and photo storage

1. Open [supabase/setup.sql](supabase/setup.sql) from this repository and copy the entire script.
2. In Supabase, choose **SQL Editor → New query** and paste it.
3. Find the line `owner_email text := 'YOUR_OWNER_EMAIL_HERE';`. Replace the placeholder with the exact email created in step 2. Keep the single quotes. If your email contains an apostrophe, escape it as two consecutive apostrophes in SQL.
4. Click **Run**. The script must complete without an error.

The script creates the website content table, the public read function, image bucket, and access policies. It starts with the portfolio's default content. Repeating it with the same owner preserves saved content. Only that owner's user ID can read drafts, save website content, or upload pictures. The public function filters out unpublished posts. Pictures uploaded to the public image bucket are publicly accessible even if associated with a draft; upload only images intended for eventual public viewing.

For a different owner, first back up the site and intentionally update the private owner table; running setup with a different email will refuse to silently replace the current owner.

## 4. Get the two public configuration values

In Supabase, open **Project Settings → API Keys** (some layouts use **Connect** for the Project URL):

- Copy the **Project URL**, such as `https://your-project-id.supabase.co`.
- Copy the **Publishable key**, starting with `sb_publishable_`.

These two values are designed for browser use. This implementation requires the new publishable key format, not the older anon JWT key. Never use a secret key (`sb_secret_`), service-role key, database password, or dashboard password in these fields. No privileged key is needed.

## 5. Put the website code in GitHub

The repository is `arkin-yno/Mark-Anthony-`. The website files must be committed and pushed to it before Vercel can import them. Local workspace files alone do not appear in GitHub. Exclude `.data/`, `.env`, and `node_modules/`; these are already ignored. Publishing code is separate from publishing this cloud environment.

## 6. Deploy in Vercel

1. Choose **Add New → Project** and import `arkin-yno/Mark-Anthony-`. If it is not listed, grant the Vercel GitHub integration access to that repository.
2. Select framework preset **Other**. The root directory is the repository root; `vercel.json` supplies the build command and public output directory.
3. Expand **Environment Variables** and add these to Production and Preview:

   | Name | Value |
   | --- | --- |
   | `SUPABASE_URL` | Your Supabase Project URL |
   | `SUPABASE_PUBLISHABLE_KEY` | Your Supabase Publishable key |

4. Click **Deploy**. Vercel will give you an HTTPS address ending in `.vercel.app`.
5. If you add or change variables after deployment, redeploy so the new configuration is applied.

## 7. Check your website and editor

1. Open the deployed address. Confirm the home page and every sidebar section load.
2. Choose **Manage website**, sign in using the editor user created in step 2, and add your real name, photo, contact email, and booking link.
3. Click **Preview**, then **Save changes**. Reload the public page to confirm the edits are saved.
4. Add a blog post with text and a photo. Save it as **Draft** and confirm that it is absent from the public Blog page.
5. Set it to **Published**, save, and confirm that it appears. Then unpublish or delete the test post and save again.

There is no public deployment until these steps are completed and the actual deployed URL has been checked. Free projects may pause when inactive or reach provider quotas; check the service dashboards if the site stops loading. Back up saved content and images before changing or deleting the Supabase project.
