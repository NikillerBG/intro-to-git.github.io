# COS 3100: Intro to Git

A short course about learning to use bash and git as a software developer.

> **Notice:** This repository is a fork created strictly for **educational and coursework assignment purposes** for the COS 3100 course at AUBG. Full credit for the curriculum, course materials, exercises, and slides belongs to **[Mihail Mikov](https://github.com/debel)**.

---

## Added Features

This fork adds tools to easily search and interact with the class materials:

- **Slide & Keyword Search (`/search`)**:
  - Searches through 330+ Reveal.js presentation slides and full lessons.
  - Typo-tolerant (fuzzy) search and Git concept expansion (e.g. `undo` finds `reset`, `revert`, `restore`).
  - Filter by slides, lessons, extras, and homeworks with inline slide previews.
  - Direct links to jump straight to the exact presentation slide.

- **Course Assistant (`/agent`)**:
  - Interactive Q&A grounded in the course materials with exact slide citations.
  - Built-in quiz mode (`quiz me`) to practice core Git and Bash exam concepts.
  - Guidance for Homework 1 & Homework 2 requirements.
  - Local "AI" chat bot and ability to use external API keys for Gemini, ChatGPT and local Ollama

---

## AI Usage Disclosure

AI tools were used during the development of this project to assist with implementation and debugging. AI-generated suggestions were reviewed, adapted, and tested as part of the development process.

---

## How to Run Locally

```bash
# 1. Install dependencies
npm install

# 2. Start local server
npm run dev
```

Visit [`http://localhost:4321`](http://localhost:4321) in your browser.

---

## Credits

- All course content compiled and prepared by **[Mihail Mikov](https://github.com/debel)** with linked attributions within the text.
- Primary sources: [Git documentation](https://git-scm.com/docs) and the [Pro Git Book](https://git-scm.com/book).
- Theme: Port of the [Hugo Terminal Theme](https://github.com/panr/hugo-theme-terminal) by [panr](https://github.com/panr). Astro port by [Dennis Klappe](https://github.com/dennisklappe).
