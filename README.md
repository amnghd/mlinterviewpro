# MLInterviewPro

A professional ML interview preparation website featuring:
- **314+ LeetCode problems** (10 free, rest premium)
- **22 ML System Design cases** (5 free, rest premium)
- **50+ Behavioral questions** with STAR frameworks
- **ML Cheatsheet** for quick reference

## Quick Start (Local)

```bash
cd mlinterview_site
python3 -m http.server 8000
# Open http://localhost:8000
```

## Deployment Options

### Option 1: GitHub Pages (Free, Recommended)
```bash
# 1. Create a new GitHub repo
# 2. Push this folder to the repo
git init
git add .
git commit -m "Initial MLInterviewPro website"
git remote add origin https://github.com/YOUR_USERNAME/mlinterviewpro.git
git push -u origin main

# 3. Go to repo Settings > Pages > Source: main branch
# 4. Your site will be at https://YOUR_USERNAME.github.io/mlinterviewpro
```

### Option 2: Netlify (Free, Easy)
1. Go to https://netlify.com
2. Drag and drop this folder to deploy
3. Get a free .netlify.app domain

### Option 3: Vercel (Free)
```bash
npm i -g vercel
cd mlinterview_site
vercel
```

### Option 4: Custom Domain
1. Buy a domain (e.g., mlinterviewpro.com)
2. Deploy to any platform above
3. Configure custom domain in platform settings

## Customization

- Edit `index.html` for homepage content
- Edit `leetcode.html` for LeetCode problems
- Edit `ml-system-design.html` for ML cases
- Edit `behavioral.html` for behavioral content
- Edit `cheatsheet.html` for ML cheatsheet

## Tech Stack
- Pure HTML/CSS/JavaScript
- Tailwind CSS (via CDN)
- Font Awesome icons
- No build tools required

## Mentorship Link
All pages include prominent CTAs linking to:
https://mentorcruise.com/mentor/AminGhaderi/

---
Built with real interview experience.
