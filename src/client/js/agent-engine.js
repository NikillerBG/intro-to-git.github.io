/**
 * COS 3100 AI Course Agent Engine (GitBot)
 * 
 * Supports:
 * 1. Built-in Local RAG Agent (Works immediately without any API keys or network connection)
 * 2. Frontier LLMs: Google Gemini (Free API Key), OpenAI, and Local Ollama (e.g. Llama 3 / Mistral)
 * 3. Interactive Quiz Mode with slide citations and feedback
 */

export const COURSE_QUIZ_BANK = [
  {
    id: 'quiz-trees',
    question: 'In Git architecture, what are the "Three Trees" (states) that track your files?',
    options: [
      'Working Directory, Staging Area (Index), and Repository (HEAD commit)',
      'Local Repository, Remote Repository, and Stash',
      'Master Branch, Main Branch, and Feature Branch',
      'Blob, Tree, and Commit Object'
    ],
    correct: 0,
    explanation: 'Git tracks changes across three distinct areas: the Working Directory (your local files on disk), the Staging Area / Index (prepared snapshot), and the Repository (permanent commits).',
    lessonUrl: '/lessons/intro-to-git',
    slideUrl: '/slides/intro-to-git#/15',
    lessonTitle: 'Intro to git'
  },
  {
    id: 'quiz-merge-ff',
    question: 'What is a "fast-forward" merge in Git?',
    options: [
      'A merge where Git skips conflict checking completely',
      'When the current branch has no new commits, Git simply moves the branch pointer forward to the target commit without creating a merge commit',
      'A merge performed automatically by GitHub Actions CI pipeline',
      'A rebase that compresses all commits into one'
    ],
    correct: 1,
    explanation: 'A fast-forward merge happens when there is no divergence: the target branch contains the current branch commit in its direct history, so Git only needs to advance the pointer.',
    lessonUrl: '/lessons/git-merging',
    slideUrl: '/slides/git-merging#/3',
    lessonTitle: 'Git merging'
  },
  {
    id: 'quiz-detached-head',
    question: 'What does it mean when Git is in a "detached HEAD" state?',
    options: [
      'The .git folder has been corrupted and deleted',
      'HEAD points directly to a specific commit hash rather than a named branch pointer',
      'You are pushing to a remote repository that does not exist',
      'A merge conflict has aborted in progress'
    ],
    correct: 1,
    explanation: 'In detached HEAD, HEAD points directly to a commit hash (e.g. after `git checkout <hash>`). Any new commits made in this state won\'t belong to any branch unless a new branch is created.',
    lessonUrl: '/lessons/git-branches',
    slideUrl: '/slides/git-branches#/10',
    lessonTitle: 'Git branches'
  },
  {
    id: 'quiz-chmod',
    question: 'What permissions does `chmod 755 script.sh` set on a file?',
    options: [
      'Read, write, execute for Owner; Read & execute for Group and Others (rwxr-xr-x)',
      'Read and write for Owner only (rw-------)',
      'Read, write, execute for Everyone (rwxrwxrwx)',
      'Execute permission for Owner, nothing for others'
    ],
    correct: 0,
    explanation: '7 = 4+2+1 (rwx for owner), 5 = 4+0+1 (r-x for group), 5 = 4+0+1 (r-x for others). Result: rwxr-xr-x.',
    lessonUrl: '/bonus/permissions',
    slideUrl: '/bonus/permissions',
    lessonTitle: 'File Permissions'
  },
  {
    id: 'quiz-git-objects',
    question: 'Which of the following are the 4 fundamental object types stored in Git\'s object database (`.git/objects`)?',
    options: [
      'Blob, Tree, Commit, and Annotated Tag',
      'File, Directory, Branch, and Remote',
      'Stash, Index, Working Tree, and HEAD',
      'Patch, Diff, Snapshot, and Revision'
    ],
    correct: 0,
    explanation: 'Git is fundamentally a content-addressable key-value store containing 4 object types: Blobs (file contents), Trees (directories and permissions), Commits (metadata and root tree pointer), and Annotated Tags.',
    lessonUrl: '/lessons/git-internals',
    slideUrl: '/slides/git-internals#/5',
    lessonTitle: 'Git internals'
  },
  {
    id: 'quiz-rebase-i',
    question: 'What does `git rebase -i HEAD~3` allow you to do?',
    options: [
      'Delete the last 3 commits permanently from Git reflog',
      'Interactively edit, squash, reorder, reword, or drop the last 3 commits before pushing',
      'Push the last 3 commits directly to origin main',
      'Create 3 new remote tracking branches'
    ],
    correct: 1,
    explanation: 'Interactive rebase (`git rebase -i`) lets you rewrite commit history: you can squash multiple commits into one, change commit messages, reorder commits, or delete unwanted commits.',
    lessonUrl: '/lessons/git-merging',
    slideUrl: '/slides/git-merging#/12',
    lessonTitle: 'Git merging & rebase'
  }
];

export class CourseAIAgent {
  constructor(searchEngine) {
    this.searchEngine = searchEngine;
    this.config = this.loadConfig();
    this.conversationHistory = [];
  }

  loadConfig() {
    try {
      const saved = localStorage.getItem('cos3100_ai_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.model === 'gemini-2.0-flash') {
          parsed.model = 'gemini-3.8-flash';
        }
        return parsed;
      }
    } catch (e) {
      // ignore
    }
    return {
      provider: 'builtin', // 'builtin' | 'gemini' | 'openai' | 'ollama'
      apiKey: '',
      model: 'gemini-3.8-flash',
      ollamaUrl: 'http://localhost:11434',
      ollamaModel: 'llama3.2',
    };
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    try {
      localStorage.setItem('cos3100_ai_config', JSON.stringify(this.config));
    } catch (e) {
      console.error('Failed to save config to localStorage', e);
    }
  }

  async ask(question, onChunk = null) {
    const trimmed = (question || '').trim();
    if (!trimmed) return null;

    if (/quiz|test me|test my knowledge|practice question/i.test(trimmed)) {
      return this.handleQuizRequest();
    }

    const searchResult = this.searchEngine.search(trimmed, {
      type: 'all',
      limit: 6,
      semantic: true,
      fuzzy: true,
    });

    const relevantItems = searchResult.results.map(r => r.item);

    if (this.config.provider === 'gemini' && this.config.apiKey) {
      return await this.askGemini(trimmed, relevantItems, onChunk);
    } else if (this.config.provider === 'openai' && this.config.apiKey) {
      return await this.askOpenAI(trimmed, relevantItems, onChunk);
    } else if (this.config.provider === 'ollama') {
      return await this.askOllama(trimmed, relevantItems, onChunk);
    } else {
      return await this.askBuiltin(trimmed, relevantItems, onChunk);
    }
  }

  handleQuizRequest() {
    const randomQuiz = COURSE_QUIZ_BANK[Math.floor(Math.random() * COURSE_QUIZ_BANK.length)];
    return {
      type: 'quiz',
      quiz: randomQuiz,
      text: `### 📝 COS 3100 Knowledge Check\n\n**${randomQuiz.question}**`,
      citations: [
        {
          title: randomQuiz.lessonTitle,
          lessonUrl: randomQuiz.lessonUrl,
          slideUrl: randomQuiz.slideUrl,
        }
      ]
    };
  }

  /**
   * Built-in intelligent synthesis engine.
   * Dynamically tailors answers to specific concepts, commands, and slides.
   */
  async askBuiltin(question, relevantItems, onChunk = null) {
    const qLower = question.toLowerCase();
    let text = '';
    const citations = [];

    // Extract citations
    for (const item of relevantItems.slice(0, 4)) {
      citations.push({
        title: item.title,
        parentTitle: item.parentTitle || item.title,
        type: item.type,
        slideIndex: item.slideIndex,
        url: item.url,
        lessonUrl: item.lessonUrl,
      });
    }

    // 1. Specific High-Frequency Concepts
    if (qLower.includes('homework 1') || qLower.includes('hw1')) {
      text = `### 📋 Homework 1: Setup Your GitHub Page

In **Homework 1**, you set up your personal GitHub Pages website at \`https://{your-handle}.github.io\`.

**Key Requirements & Steps:**
1. **GitHub Setup**: Create a repository named exactly \`{your-handle}.github.io\`.
2. **Authentication**: Set up **both** a Classic Personal Access Token (PAT) with full \`repo\` scope and an SSH key pair (\`ssh-keygen -t ed25519\`).
3. **Local Repo**: Initialize a local repository (\`git init\`), add your remote (\`git remote add origin git@github.com:{user}/{user}.github.io.git\`).
4. **Deploy**: Create an \`index.html\` with a "Hello world" greeting, commit it, and push to GitHub.
5. **Daily Practice**: For **5 consecutive days**, make daily changes, commit them with meaningful messages, and push them to GitHub.

*Tip: Check status with \`git status\` and view commit history with \`git log --oneline\`!*`;
    } else if (qLower.includes('homework 2') || qLower.includes('hw2')) {
      text = `### 🏢 Homework 2: Team Collaboration at "git-be-gud inc"

In **Homework 2**, you simulate a real-world software engineering workflow:

**Requirements:**
1. **Pick a Backlog Task**: Select a task from the course GitHub Project backlog and assign it to yourself.
2. **Fork & Branch**: Fork the [fall26-homework-2](https://github.com/intro-to-git/fall26-homework-2) repository, create a feature branch, and implement your solution.
3. **Pull Request**: Open a PR with a clear description and verify that CI checks pass.
4. **Peer Review**: You must review at least one classmate's PR, write constructive comments, and approve it.
5. **Deadline**: **19.11.2026**.

**Extra Credit Opportunities:**
- Complete an additional backlog task.
- Provide reviews for 3 or more classmates.
- Build a creative project demonstrating engagement with Git course materials!`;
    } else if (qLower.includes('rebase') && (qLower.includes('merge') || qLower.includes('difference') || qLower.includes('vs'))) {
      text = `### 🔀 Git Merge vs Git Rebase

Both commands integrate changes from one branch into another, but they do it with fundamentally different philosophies:

#### 1. \`git merge\`
- **How it works**: Combines the histories of two branches. If histories have diverged, Git creates a **3-way merge commit** that has two parent commits.
- **Advantages**: Preserves the complete, true historical record of when branches branched and joined.
- **Disadvantages**: Can clutter the history with many "Merge branch..." commits.

\`\`\`bash
# Merge feature branch into main
git checkout main
git merge feature-login
\`\`\`

#### 2. \`git rebase\`
- **How it works**: Takes the commits from your current branch and "re-plays" them on top of the target branch, creating **brand new commit hashes**.
- **Advantages**: Results in a perfectly **linear, clean history** without unnecessary merge commits.
- **Golden Rule of Rebase**: *Never rebase commits that have already been pushed to a public/shared branch!*

\`\`\`bash
# Rebase feature onto the latest main
git checkout feature-login
git rebase main
\`\`\``;
    } else if (qLower.includes('staging') || qLower.includes('three trees') || (qLower.includes('tree') && qLower.includes('working'))) {
      text = `### 🌳 Git's Three Trees Architecture

In Git, changes move through **three distinct areas (trees)** before becoming part of permanent history:

1. **Working Directory (Sandbox)**
   - The actual files on your filesystem that you are editing in VS Code or nano.
   - Files here are either *untracked* or *modified*.

2. **Staging Area / Index (Proposed Next Commit)**
   - A staging cache that records exactly what changes will go into your next commit.
   - You add files here using \`git add <file>\`.

3. **Repository (HEAD / History)**
   - Git's permanent object database (\`.git/objects\`).
   - When you run \`git commit\`, Git takes the snapshot currently in the Staging Area and writes it as a permanent commit pointed to by **HEAD**.

\`\`\`bash
# Lifecycle:
Working Dir  --( git add )-->  Staging Area  --( git commit )-->  Repository (HEAD)
\`\`\``;
    } else if (qLower.includes('undo') || qLower.includes('revert') || qLower.includes('reset') || qLower.includes('restore')) {
      text = `### ↩️ Undoing Changes in Git

Git provides different commands depending on **where** the change is located:

#### 1. Discard Unstaged Changes in Working Directory:
\`\`\`bash
# Restore a specific file back to HEAD state
git restore <file>
\`\`\`

#### 2. Unstage Files from the Staging Area:
\`\`\`bash
# Keep file edits, but remove from staging
git restore --staged <file>
\`\`\`

#### 3. Undo Recent Commits:
\`\`\`bash
# Soft reset: undo commit, keep changes staged
git reset --soft HEAD~1

# Mixed reset (default): undo commit, keep changes unstaged
git reset HEAD~1

# Hard reset: PERMANENTLY discard commit and all changes!
git reset --hard HEAD~1
\`\`\`

#### 4. Undo Pushed Commits Safely:
\`\`\`bash
# Creates a NEW commit that inverts the previous commit
git revert <commit-hash>
\`\`\``;
    } else if (qLower.includes('branch') || qLower.includes('create branch') || qLower.includes('switch branch')) {
      text = `### 🌿 Working with Git Branches

Branches in Git are lightweight pointers that point to a specific commit.

#### Common Branching Commands:
\`\`\`bash
# List all local branches (* shows currently checked out)
git branch

# Create a new branch
git branch <branch-name>

# Create AND switch to a new branch in one command:
git checkout -b <branch-name>
# (or modern Git syntax)
git switch -c <branch-name>

# Switch to an existing branch:
git checkout <branch-name>
git switch <branch-name>

# Delete a branch that has already been merged:
git branch -d <branch-name>

# Force delete an unmerged branch:
git branch -D <branch-name>
\`\`\``;
    } else if (qLower.includes('stash')) {
      text = `### 📦 Stashing Changes in Git

\`git stash\` takes your uncommitted modifications (working directory and staged changes) and shelves them on a temporary stack so you can switch branches without committing unfinished work.

\`\`\`bash
# Save your current dirty working state
git stash

# Save with a descriptive message
git stash save "WIP: login form validation"

# List all stashed changes
git stash list

# Re-apply the most recent stash and remove it from stack
git stash pop

# Re-apply the stash but KEEP it in the stash list
git stash apply

# Drop/delete a specific stash
git stash drop stash@{0}
\`\`\``;
    } else if (qLower.includes('detached head') || qLower.includes('detached')) {
      text = `### 📍 Detached HEAD State

In Git, **HEAD** usually points to a named branch (like \`main\` or \`dev\`), which in turn points to the latest commit.

A **"Detached HEAD"** occurs when you checkout a specific commit hash or remote tag directly rather than a branch:
\`\`\`bash
git checkout 4f8a29b
\`\`\`

#### Why it matters:
- You can inspect files and compile code at that exact historical commit.
- **Warning**: If you make new commits while in detached HEAD, they will not belong to any branch and will eventually be deleted by Git garbage collection.

#### How to fix or save your work:
\`\`\`bash
# Create a new branch from this exact point to save your commits:
git switch -c my-saved-branch
\`\`\``;
    } else if (qLower.includes('internals') || qLower.includes('blob') || qLower.includes('hash-object') || qLower.includes('cat-file')) {
      text = `### 🔍 Git Internals: Objects and the \`.git\` Directory

Git is fundamentally a content-addressable storage database.

#### The 4 Core Object Types:
1. **Blob**: Stores pure file contents (data only, no file name or permissions).
2. **Tree**: Represents a directory. Maps file names and permission modes to Blob or Sub-tree SHA-1 hashes.
3. **Commit**: Points to a top-level Tree object, stores author/committer information, timestamp, commit message, and parent commit hash(es).
4. **Annotated Tag**: A permanent named reference pointing to a specific commit, with message and signature.

#### Plumbing Commands:
\`\`\`bash
# Hash content and store as blob
echo "hello aubg" | git hash-object -w --stdin

# Inspect object type and content
git cat-file -t <hash>   # prints 'blob', 'tree', or 'commit'
git cat-file -p <hash>   # pretty-prints object content
\`\`\``;
    } else if (qLower.includes('permission') || qLower.includes('chmod')) {
      text = `### 🔒 Linux File Permissions & \`chmod\`

In Unix/Linux, permissions are divided into 3 groups: **Owner (User)**, **Group**, and **Others**.

Each group has 3 permission bits:
- **Read (\`r\`)** = 4
- **Write (\`w\`)** = 2
- **Execute (\`x\`)** = 1

#### Common Numeric Permissions:
- \`chmod 755 file.sh\` \`rwxr-xr-x\` (Owner can read/write/execute; everyone else can read and execute. Standard for scripts!).
- \`chmod 644 file.txt\` \`rw-r--r--\` (Owner can read/write; others can only read. Standard for documents).
- \`chmod 600 id_ed25519\` \`rw-------\` (Owner read/write only. Required for private SSH keys!).
- \`chmod +x script.sh\` (Add execute permission for current user).`;
    } else if (qLower.includes('conflict') || qLower.includes('resolve conflict')) {
      text = `### 💥 Resolving Git Merge Conflicts

A merge conflict occurs when two branches modify the **same line** of a file differently, or one branch deletes a file that another modified.

#### Conflict Workflow:
1. Git will pause the merge and mark conflicting files as \`both modified\`.
2. Inspect conflicting files using \`git status\`.
3. Open the file and look for conflict markers:
\`\`\`diff
<<<<<<< HEAD (Current branch)
const apiUrl = "https://production.example.com";
=======
const apiUrl = "https://staging.example.com";
>>>>>>> feature-branch
\`\`\`
4. Edit the file to keep the desired code and remove the marker lines (\`<<<<<<<\`, \`=======\`, \`>>>>>>>\`).
5. Stage the resolved file: \`git add <file>\`.
6. Complete the merge: \`git commit\` (or \`git rebase --continue\` if rebasing).
7. If you get stuck and want to abort: \`git merge --abort\`.`;
    } else if (qLower.includes('bisect')) {
      text = `### 🎯 Git Bisect: Binary Search for Bugs

\`git bisect\` is a debugging tool that uses binary search to find which commit introduced a bug into your project.

\`\`\`bash
# Start bisect wizard
git bisect start

# Tell Git that the current version is broken
git bisect bad

# Tell Git a past commit hash where the bug did NOT exist
git bisect good v1.0.0

# Git will checkout a commit in the middle:
# Test your app, then tell Git:
git bisect good   # if working
git bisect bad    # if broken

# Once finished, return to original HEAD:
git bisect reset
\`\`\``;
    } else if (qLower.includes('remote') || qLower.includes('push') || qLower.includes('pull') || qLower.includes('fetch')) {
      text = `### 🌐 Git Remotes (Push, Pull, Fetch)

Remotes are versions of your project hosted on the internet or network (like GitHub or GitLab).

\`\`\`bash
# View configured remotes and their URLs
git remote -v

# Add a new remote named 'origin'
git remote add origin git@github.com:username/repo.git

# Push changes from local branch to remote and set tracking
git push -u origin main

# Fetch new changes from remote (downloads data without merging)
git fetch origin

# Pull changes from remote (fetches AND immediately merges into current branch)
git pull origin main
\`\`\``;
    } else if (qLower.includes('ssh') || qLower.includes('key')) {
      text = `### 🔑 Setting up SSH Keys for GitHub

SSH keys allow you to authenticate with GitHub without typing your password each time.

\`\`\`bash
# 1. Generate a new Ed25519 key pair:
ssh-keygen -t ed25519 -C "your_email@example.com"

# 2. Start the SSH agent in the background:
eval "$(ssh-agent -s)"

# 3. Add your private key to the agent:
ssh-add ~/.ssh/id_ed25519

# 4. View and copy your PUBLIC key to paste into GitHub Settings -> SSH Keys:
cat ~/.ssh/id_ed25519.pub

# 5. Test your connection:
ssh -T git@github.com
\`\`\``;
    } else if (qLower.includes('grading') || qLower.includes('grade') || qLower.includes('syllabus') || qLower.includes('schedule') || qLower.includes('exam')) {
      text = `### 📊 COS 3100 Grading Breakdown & Schedule

As outlined in the syllabus by lecturer Mihail Mikov:

| Assignment | Weight | Due Date |
| :--- | :--- | :--- |
| **In-class Attendance & Participation** | **10%** | Throughout course |
| **Homework 1** (Personal GitHub Page) | **15%** | 28.10.26 |
| **Midterm Test** | **25%** | 30.10.26 |
| **Homework 2** (PRs & Team Collaboration) | **20%** | 19.11.26 |
| **Final Test** | **30%** | 20.11.26 |`;
    } else if (qLower.includes('lecturer') || qLower.includes('professor') || qLower.includes('mikov')) {
      text = `### 👨‍🏫 Course Lecturer: Mihail Mikov

- **Name**: Mihail Mikov
- **Role**: Staff Engineer at SumUp
- **Alma Mater**: American University in Bulgaria (AUBG Class of 2009)
- **Course**: COS 3100 - Intro to Git
- **Office Hours**: Friday 9:30 - 10:30 & 14:00 - 15:00`;
    } else if (relevantItems.length > 0) {
      // DYNAMIC SYNTHESIS FOR ANY COURSE SLIDE / TOPIC
      const primary = relevantItems[0];
      const secondary = relevantItems.length > 1 ? relevantItems[1] : null;

      // Extract raw bullet points or code from slide markdown
      const cleanedMd = primary.rawMarkdown
        .replaceAll(/<[^>]+>/g, '')
        .replaceAll(/^#{1,4}\s+.*$/gm, '')
        .trim();

      const primaryCode = (primary.codeSnippets && primary.codeSnippets.length > 0)
        ? `\n\`\`\`bash\n${primary.codeSnippets[0]}\n\`\`\`\n`
        : '';

      const secondaryCode = (secondary && secondary.codeSnippets && secondary.codeSnippets.length > 0)
        ? `\n\`\`\`bash\n${secondary.codeSnippets[0]}\n\`\`\`\n`
        : '';

      text = `### 📖 ${primary.title}
*Topic from ${primary.parentTitle || 'COS 3100 Materials'}*

${cleanedMd ? cleanedMd.slice(0, 380) + '...' : primary.content.slice(0, 380)}
${primaryCode}
${secondary ? `#### Related Concept: ${secondary.title}\n${secondary.content.slice(0, 250)}...\n${secondaryCode}` : ''}

You can view the full interactive presentation slide directly in Reveal.js using the reference badge below!`;
    } else {
      text = `I couldn't find a direct match in the COS 3100 materials for "${question}".

Try asking about:
- **Git basics**: staging, commits, branches, remotes, diff
- **Advanced features**: rebase, cherry-pick, bisect, reflog, stash, internals
- **Bash & Linux**: file system navigation, permissions (\`chmod\`), scripting
- **Course assignments**: Homework 1, Homework 2, grading syllabus
- Or type **"quiz me"** to test your knowledge!`;
    }

    if (onChunk) {
      const words = text.split(' ');
      let accumulated = '';
      for (let i = 0; i < words.length; i++) {
        accumulated += (i > 0 ? ' ' : '') + words[i];
        onChunk(accumulated);
        if (i % 6 === 0) {
          await new Promise(r => setTimeout(r, 12));
        }
      }
    }

    return {
      type: 'answer',
      text,
      citations,
    };
  }

  /**
   * Google Gemini Frontier LLM Integration with injected RAG context.
   */
  async askGemini(question, relevantItems, onChunk = null) {
    const contextText = relevantItems.map(item => `
[Title: ${item.title}] [Type: ${item.type}] [URL: ${item.url}]
${item.content.slice(0, 600)}
${item.codeSnippets && item.codeSnippets.length ? 'Code:\n' + item.codeSnippets.slice(0, 2).join('\n') : ''}
---
`).join('\n');

    const prompt = `You are GitBot, the friendly expert AI Teaching Assistant for the course "COS 3100: Intro to Git" taught by Mihail Mikov at the American University in Bulgaria (AUBG).

Relevant course materials from the curriculum:
${contextText}

Student Question: "${question}"

Instructions:
1. Provide a clear, structured, pedagogically sound answer grounded in the course material.
2. Use markdown with headings, bullet points, and syntax-highlighted code blocks where appropriate.
3. Reference the course lesson or slide names where the concept is taught.
4. Keep the tone enthusiastic, encouraging, and technically precise.`;

    let primaryModel = this.config.model || 'gemini-3.8-flash';
    if (primaryModel === 'gemini-2.0-flash') primaryModel = 'gemini-3.8-flash';

    const candidateModels = Array.from(new Set([primaryModel, 'gemini-2.5-flash', 'gemini-1.5-flash']));
    let replyText = null;

    for (const model of candidateModels) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.config.apiKey}`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 1000,
            }
          })
        });

        if (res.ok) {
          const data = await res.json();
          replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (replyText) break;
        } else {
          if (res.status === 503 || res.status === 429 || res.status === 404) {
            continue;
          } else {
            const errorJson = await res.json().catch(() => ({}));
            throw new Error(`Gemini API Error (${res.status}): ${errorJson.error?.message || res.statusText}`);
          }
        }
      } catch (err) {
        if (err.message && (err.message.includes('403') || err.message.includes('API_KEY_INVALID'))) {
          throw err;
        }
      }
    }

    if (replyText) {
      if (onChunk) onChunk(replyText);
      const citations = relevantItems.slice(0, 4).map(item => ({
        title: item.title,
        parentTitle: item.parentTitle || item.title,
        type: item.type,
        slideIndex: item.slideIndex,
        url: item.url,
        lessonUrl: item.lessonUrl,
      }));
      return {
        type: 'answer',
        text: replyText,
        citations,
      };
    }

    // Graceful Fallback if Gemini servers blocked or down
    const fallbackAnswer = await this.askBuiltin(question, relevantItems, onChunk);
    fallbackAnswer.text = `> ⚡ *Notice: Gemini cloud connection unavailable. Providing instant answer via Built-in Course Engine:* \n\n${fallbackAnswer.text}`;
    return fallbackAnswer;
  }

  /**
   * OpenAI API Integration with injected RAG context.
   */
  async askOpenAI(question, relevantItems, onChunk = null) {
    const contextText = relevantItems.map(item => `
[${item.title}] (${item.url})
${item.content.slice(0, 500)}
`).join('\n');

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are GitBot, the AI Teaching Assistant for COS 3100: Intro to Git at AUBG. Use the course materials provided below to accurately answer student queries with clear explanations and code examples.\n\nCourse Context:\n${contextText}`
          },
          { role: 'user', content: question }
        ],
        temperature: 0.4,
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`OpenAI API Error: ${err.error?.message || res.statusText}`);
    }

    const data = await res.json();
    const replyText = data.choices?.[0]?.message?.content || 'No response generated.';

    if (onChunk) onChunk(replyText);

    return {
      type: 'answer',
      text: replyText,
      citations: relevantItems.slice(0, 4),
    };
  }

  /**
   * Local Ollama Integration.
   */
  async askOllama(question, relevantItems, onChunk = null) {
    const contextText = relevantItems.map(item => `[${item.title}]: ${item.content.slice(0, 400)}`).join('\n');
    const ollamaUrl = (this.config.ollamaUrl || 'http://localhost:11434').replace(/\/+$/, '');
    const model = this.config.ollamaModel || 'llama3.2';

    const res = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: `You are the teaching assistant for COS 3100: Intro to Git. Context:\n${contextText}`
          },
          { role: 'user', content: question }
        ],
        stream: false,
      })
    });

    if (!res.ok) {
      throw new Error(`Ollama Error: Could not connect to Ollama at ${ollamaUrl}. Make sure Ollama is running.`);
    }

    const data = await res.json();
    const replyText = data.message?.content || 'No response from local model.';

    if (onChunk) onChunk(replyText);

    return {
      type: 'answer',
      text: replyText,
      citations: relevantItems.slice(0, 4),
    };
  }
}
