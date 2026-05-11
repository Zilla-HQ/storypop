# Sitebeat WordPress Plugin

Free WP plugin that runs the standard `/api/audit` flow from inside the WP admin dashboard.

## Local install

1. Zip the inner `sitebeat/` folder.
2. WP Admin → Plugins → Add New → Upload Plugin → upload zip.
3. Activate. Find **Sitebeat SEO** in the sidebar.

Or for development:

```bash
ln -s "$(pwd)/wordpress-plugin/sitebeat" /path/to/wordpress/wp-content/plugins/sitebeat
```

## Submitting to the WordPress.org plugin directory

1. Create an account on <https://wordpress.org/plugins/developers/add/>.
2. Submit a hosting request — they review the code and assign you an SVN repo (typically 2–6 weeks).
3. Commit `sitebeat/` to the SVN repo's `trunk/` directory.
4. Tag a release at `tags/1.0.0`.

The plugin must comply with the [WordPress.org plugin guidelines](https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/) — primarily: GPL-compatible license (we use GPLv2+), no obfuscated code, no upselling pop-ups in the admin (a single CTA banner is fine and we use one).

## Roadmap

- v1.1: pull historic scores from the API and chart them in admin.
- v1.2: show the most recent audit report inline in the admin (instead of linking out).
- v1.3: dismissible "schedule weekly monitoring" notice on the WP dashboard for non-subscribers.
