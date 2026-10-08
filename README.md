# Community OCR configurations for GameSentenceMiner

Share reusable OCR areas for games. Browse and download from **OCR → Find OCR configs** in [GameSentenceMiner](https://github.com/bpwhelan/GameSentenceMiner).

## Share a configuration

1. Select and test your OCR areas in GSM.
2. Choose **Share OCR config**. Check the game title, executable names, capture resolution, language, and platform. Add notes about patches, UI scale, menus, and limitations.
3. Optionally include recommended OCR settings.
4. Choose **Upload via GitHub**, review the prefilled issue, and click **Submit new issue**. For large submissions, paste the copied text into the issue body.

A GitHub account is required to submit, but not to browse or download. The submission becomes public under the MIT license. Automation validates the JSON and publishes it to `profiles/` and `catalog.json`, then closes the issue. Allow a few minutes and refresh GSM. An empty library means nobody has shared a configuration yet; it contains no invented or untested starter configurations.

Only area coordinates and types, the game metadata you review, notes, and optional OCR settings are published. Local paths, monitor positions, hotkeys, credentials, and screenshots are excluded. Review your own free-text notes for information you do not want to publish.

## Download and verify

Search by game title, executable name, language, resolution, or notes. Preview the areas before applying them to the active scene. Coordinates scale with the capture size; a different aspect ratio or UI scale may require adjustment.

GSM backs up existing areas and leaves general settings alone unless **Also apply the shared OCR settings** is checked. The only shareable settings are scan interval, scan image quality, furigana filtering, OCR engines, two-pass OCR, and second-scan optimization. Applying engines or scan interval selects advanced mode so those values remain effective. Engine installation and any online credentials remain your responsibility.

After testing dialogue, choices, and menus, return to the downloaded configuration, confirm that you tested it, and choose **Works for me** or **Needs adjustment**. Record your actual resolution and any useful notes, then submit the prefilled GitHub issue. Reports apply to one exact revision. The latest report from each independent GitHub account counts once; authors cannot verify their own uploads. These are community reports, not guarantees or maintainer reviews. Editing a configuration invalidates reports on earlier revisions.

## Update or withdraw

- Edit the JSON in your original submission issue to update it. A closed issue is still processed when edited. Each issue has a stable `profile-N` identity.
- To withdraw a configuration or report, close its issue with reason **not planned**. If it was automatically closed, reopen it first, then close as not planned. Deleting the issue also removes its published data on the next reconciliation. Git history retains previously published data.
- Maintainers can add the **hidden** label to exclude abusive or unsuitable submissions. Remove it to restore them. GitHub's normal spam controls remain available.
- Ordinary issues are ignored by the publisher. Tooling improvements are welcome as pull requests. Submit configuration changes through issues so attribution, removal, and verification stay consistent.

## Operation and recovery

There is no server, database, paid service, OAuth application, custom domain, or manually managed secret. GitHub Actions uses the repository's automatic token. New and edited issues rebuild the catalog from all current issues, including closed accepted submissions. Runs are serialized; a later run reconciles events queued during a busy period.

The owner occasionally handles abuse or a GitHub Actions outage. If publishing fails, check **Actions → Publish catalog** and rerun it, or use **Run workflow**. Keep Actions enabled and allow the publishing workflow to write contents and issues. Do not add a branch rule that prevents the Actions bot from updating `main` without providing a permitted publishing path. Public readers fetch the raw catalog without API credentials; GSM caches it for an hour and supports offline browsing.

For development, use Node 22.18+ (CI uses Node 24), then `npm test` and `npm run validate`. There are no package dependencies. Actions are pinned to reviewed commits. `lib/ocr_profiles.ts` is the versioned contract copied from GSM's `electron-src/shared/ocr_profiles.ts`; update both together and bump the schema for incompatible changes. The publisher treats issue bodies strictly as JSON, never executable code, and writes only controlled filenames.

The catalog contains complete validated profiles and revision hashes. Each `profiles/profile-N.json` file is also directly importable in GSM. Backups and local file import/export work without GitHub.
