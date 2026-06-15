# Day of Data Baton Rouge Website

This repository hosts the rebuilt public website for Day of Data Baton Rouge.

## Publication PR flow

Public website changes are proposed through a **Publication PR** and published only after that pull request is merged.

1. Create or update site content in a branch.
2. Open a Publication PR.
3. GitHub Actions builds the Hugo site for pull requests.
4. After the Publication PR is merged to `main`, GitHub Actions deploys the site to GitHub Pages.

## Local preview

Install [Hugo](https://gohugo.io/installation/) locally, then run:

```powershell
hugo server
```

Because the configured `baseURL` includes `/sqlsatbr-website/` for GitHub Pages, open the local preview at:

```text
http://localhost:1313/sqlsatbr-website/
```

If you want the local preview to live at the root instead, run:

```powershell
hugo server --baseURL http://localhost:1313/
```

To create the production build locally, run:

```powershell
hugo
```
