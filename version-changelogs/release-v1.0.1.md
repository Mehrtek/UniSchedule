# Release v1.0.1 - UI Polish and Asset Refinement

This release focuses on visual consistency, premium UI enhancements, and critical asset fixes to ensure a seamless desktop and web experience.

## New Features and Enhancements

### Premium Custom Select Component

Replaced the default system dropdown for **Instructor Selection** with a custom-engineered component that features:

- **Glassmorphism Design**: Semi-transparent, blurred backgrounds that match the app's aesthetic.
- **Improved UX**: Better spacing and clear active states for currently selected instructors.
- **Smart Logic**: Automatically syncs with the hidden native select to maintain compatibility with existing scheduling logic.

### Asset Refinement

- **Vector Icon (SVG)**: Introduced a high-definition SVG version of the UniSchedule icon at `/src/images/icon.svg`.
- **True Transparency**: Fixed the "non-transparent" icon issue in browser tabs and application taskbars. The icon now correctly follows its squircle shape with no black/white background.
- **Sharper Branding**: Updated the header logo to use SVG for perfect scaling on high-resolution displays.

## Bug Fixes

- **Layout Repair**: Fixed a structural bug in the Instructor section where a missing grid wrapper caused buttons to stack incorrectly without gaps.
- **Favicon Fix**: Corrected the favicon linkage in `index.html` to prioritize the transparent SVG version.
- **Style Cleanup**: Removed ad-hoc utility styles in favor of a centralized design system in `src/css/input.css`.

## What's Changed

- `style: fix icon transparency and refine instructor select UI` (Commit: `3ad3168`)

---
**Team Mehrtek** - _Streamlining your university schedule, one pixel at a time._
