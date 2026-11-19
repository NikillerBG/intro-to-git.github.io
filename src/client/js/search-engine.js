/**
 * Advanced Client-Side Course Search Engine for COS 3100: Intro to Git
 * Features:
 * - Typo tolerance via Levenshtein fuzzy distance
 * - Semantic concept & synonym query expansion
 * - Multi-field scoring (Title > Headings > Commands > Tags > Code > Content)
 * - Granular slide-level deep jumping to Reveal.js presentations
 * - Dynamic snippet extraction and keyword highlighting
 */

export const GIT_SYNONYMS = {
  undo: ['reset', 'revert', 'checkout', 'restore', 'clean', 'reflog', 'HEAD~1'],
  revert: ['undo', 'reset', 'restore', 'rollback'],
  cancel: ['reset', 'revert', 'restore', 'abort'],
  save: ['commit', 'add', 'stage', 'staging', 'snapshot', 'stash'],
  stash: ['temporary', 'shelf', 'save', 'pop', 'apply', 'list'],
  branch: ['checkout -b', 'switch', 'merge', 'rebase', 'HEAD', 'pointer'],
  branches: ['checkout -b', 'switch', 'merge', 'rebase', 'HEAD', 'pointer'],
  merge: ['rebase', 'fast-forward', 'conflict', '3-way', 'ours', 'theirs', 'abort'],
  rebase: ['merge', 'interactive', 'squash', 'onto', 'linear', 'history'],
  conflict: ['conflicts', 'merge conflict', 'resolve', 'ours', 'theirs', 'both modified'],
  conflicts: ['merge conflict', 'resolve', 'ours', 'theirs', 'both modified'],
  history: ['log', 'reflog', 'blame', 'diff', 'show', 'graph'],
  log: ['history', 'graph', 'oneline', 'commit', 'author'],
  diff: ['changes', 'difference', 'unstaged', 'staged', 'HEAD', 'inspect'],
  remote: ['push', 'pull', 'fetch', 'origin', 'upstream', 'clone', 'github'],
  remotes: ['push', 'pull', 'fetch', 'origin', 'upstream', 'clone', 'github'],
  upload: ['push', 'remote', 'origin'],
  download: ['pull', 'fetch', 'clone', 'remote'],
  share: ['remote', 'push', 'pull', 'github', 'collaboration'],
  tag: ['version', 'release', 'annotated', 'semantic versioning', 'v1.0'],
  tags: ['version', 'release', 'annotated', 'semantic versioning', 'v1.0'],
  stage: ['staging', 'add', 'index', 'cache', 'working directory'],
  staging: ['stage', 'add', 'index', 'cache', 'working directory'],
  internals: ['blob', 'tree', 'commit', 'tag', 'object', 'sha-1', 'plumbing', 'porcelain'],
  trees: ['working directory', 'staging area', 'repository', 'three trees'],
  permission: ['permissions', 'chmod', 'chown', 'rwx', '755', '644', 'executable', 'octal'],
  permissions: ['permission', 'chmod', 'chown', 'rwx', '755', '644', 'executable', 'octal'],
  process: ['processes', 'ps', 'kill', 'killall', 'top', 'jobs', 'fg', 'bg', 'daemon'],
  processes: ['process', 'ps', 'kill', 'killall', 'top', 'jobs', 'fg', 'bg', 'daemon'],
  terminal: ['shell', 'bash', 'zsh', 'sh', 'posix', 'cli', 'command line', 'emulator'],
  shell: ['bash', 'terminal', 'sh', 'zsh', 'posix', 'script', 'scripting'],
  script: ['scripting', 'bash', 'shebang', 'variables', 'loops', 'functions', 'arguments'],
  scripting: ['script', 'bash', 'shebang', 'variables', 'loops', 'functions', 'arguments'],
  regex: ['regular expression', 'pattern', 'grep', 'sed', 'wildcard'],
  ssh: ['ssh-keygen', 'public key', 'private key', 'pat', 'token', 'github authentication'],
  token: ['pat', 'personal access token', 'authentication', 'github'],
  homework: ['assignment', 'homework1', 'homework2', 'due date', 'pr', 'pull request'],
  homeworks: ['assignment', 'homework1', 'homework2', 'due date', 'pr', 'pull request'],
  grade: ['grading', 'attendance', 'midterm', 'final', 'weight', 'schedule', 'syllabus'],
  grading: ['grade', 'attendance', 'midterm', 'final', 'weight', 'schedule', 'syllabus'],
  professor: ['lecturer', 'Mihail Mikov', 'SumUp', 'AUBG', 'office hours'],
  lecturer: ['professor', 'Mihail Mikov', 'SumUp', 'AUBG', 'office hours']
};

function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  if (a === b) return 0;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export class CourseSearchEngine {
  constructor(data = null) {
    this.data = data;
    this.items = data ? data.items : [];
    this.metadata = data ? data.metadata : null;
    this.isLoaded = !!data;
  }

  async load(url = '/search-data.json') {
    if (this.isLoaded) return;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      this.data = await res.json();
      this.items = this.data.items || [];
      this.metadata = this.data.metadata || null;
      this.isLoaded = true;
    } catch (err) {
      console.error('Failed to load search data:', err);
      throw err;
    }
  }

  search(query, options = {}) {
    if (!this.isLoaded || !this.items.length) {
      return { results: [], total: 0, query, executionTimeMs: 0 };
    }

    const startTime = performance.now();
    const rawQuery = (query || '').trim();
    if (!rawQuery) {
      return { results: [], total: 0, query: '', executionTimeMs: 0 };
    }

    const {
      type = 'all',         // 'all' | 'slide' | 'lesson' | 'bonus' | 'homework' | 'code'
      tag = null,           // specific tag filter
      fuzzy = true,         // enable Levenshtein fuzzy matching
      semantic = true,      // enable concept / synonym expansion
      limit = 40,
    } = options;

    const queryLower = rawQuery.toLowerCase();
    const queryTokens = queryLower
      .split(/[\s,.;:!?+*&/\\|()[\]{}"]+/)
      .filter(t => t.length > 1);

    // Expand query with synonyms
    const expandedTokens = new Set(queryTokens);
    const semanticMatches = new Set();

    if (semantic) {
      for (const token of queryTokens) {
        if (GIT_SYNONYMS[token]) {
          for (const syn of GIT_SYNONYMS[token]) {
            const synTokens = syn.toLowerCase().split(/\s+/);
            synTokens.forEach(st => {
              if (st.length > 1) {
                expandedTokens.add(st);
                semanticMatches.add(st);
              }
            });
          }
        }
      }
    }

    const expandedList = Array.from(expandedTokens);
    const scoredResults = [];

    for (const item of this.items) {
      // Type filtering
      if (type !== 'all') {
        if (type === 'code') {
          if (!item.codeSnippets || item.codeSnippets.length === 0) continue;
        } else if (item.type !== type) {
          continue;
        }
      }

      // Tag filtering
      if (tag && (!item.tags || !item.tags.includes(tag))) {
        continue;
      }

      let score = 0;
      const matchedTerms = new Set();
      const titleLower = item.title.toLowerCase();
      const contentLower = item.content.toLowerCase();
      const headingsLower = (item.headings || []).join(' ').toLowerCase();
      const commandsLower = (item.commands || []).join(' ').toLowerCase();
      const tagsLower = (item.tags || []).join(' ').toLowerCase();
      const codeLower = (item.codeSnippets || []).join('\n').toLowerCase();

      // 1. Exact phrase match
      if (titleLower.includes(queryLower)) {
        score += 80;
        matchedTerms.add(queryLower);
      }
      if (commandsLower.includes(queryLower)) {
        score += 55;
        matchedTerms.add(queryLower);
      }
      if (headingsLower.includes(queryLower)) {
        score += 40;
        matchedTerms.add(queryLower);
      }
      if (codeLower.includes(queryLower)) {
        score += 35;
        matchedTerms.add(queryLower);
      }
      if (contentLower.includes(queryLower)) {
        score += 20;
        matchedTerms.add(queryLower);
      }

      // 2. Token based matching
      for (const token of queryTokens) {
        let tokenMatched = false;

        // Title token match
        if (titleLower.includes(token)) {
          score += 30;
          tokenMatched = true;
          matchedTerms.add(token);
        }

        // Commands match (very high priority for git commands)
        if (commandsLower.includes(token)) {
          score += 35;
          tokenMatched = true;
          matchedTerms.add(token);
        }

        // Headings match
        if (headingsLower.includes(token)) {
          score += 25;
          tokenMatched = true;
          matchedTerms.add(token);
        }

        // Tag match
        if (tagsLower.includes(token)) {
          score += 25;
          tokenMatched = true;
          matchedTerms.add(token);
        }

        // Code snippet match
        if (codeLower.includes(token)) {
          score += 20;
          tokenMatched = true;
          matchedTerms.add(token);
        }

        // Content match
        if (contentLower.includes(token)) {
          score += 10;
          tokenMatched = true;
          matchedTerms.add(token);
        }

        // Fuzzy match if token didn't match directly
        if (!tokenMatched && fuzzy && token.length >= 4) {
          // Check words in title
          const titleWords = titleLower.split(/\s+/);
          for (const tw of titleWords) {
            if (tw.length >= 4 && Math.abs(tw.length - token.length) <= 2) {
              const dist = levenshtein(token, tw);
              if (dist === 1) {
                score += 18;
                matchedTerms.add(tw);
                tokenMatched = true;
                break;
              } else if (dist === 2 && token.length >= 6) {
                score += 10;
                matchedTerms.add(tw);
                tokenMatched = true;
                break;
              }
            }
          }

          // Check commands for fuzzy match
          if (!tokenMatched && item.commands) {
            for (const cmd of item.commands) {
              const cmdSub = cmd.replace(/^git\s+/, '');
              if (cmdSub.length >= 4 && Math.abs(cmdSub.length - token.length) <= 2) {
                const dist = levenshtein(token, cmdSub);
                if (dist <= 2) {
                  score += 22;
                  matchedTerms.add(cmd);
                  tokenMatched = true;
                  break;
                }
              }
            }
          }
        }
      }

      // 3. Semantic / Synonym matching
      if (semantic) {
        for (const sToken of semanticMatches) {
          if (commandsLower.includes(sToken)) {
            score += 18;
            matchedTerms.add(sToken);
          } else if (titleLower.includes(sToken)) {
            score += 15;
            matchedTerms.add(sToken);
          } else if (headingsLower.includes(sToken)) {
            score += 12;
            matchedTerms.add(sToken);
          } else if (codeLower.includes(sToken)) {
            score += 10;
            matchedTerms.add(sToken);
          } else if (contentLower.includes(sToken)) {
            score += 6;
            matchedTerms.add(sToken);
          }
        }
      }

      // Boost specific types if explicitly looking for homeworks or commands
      if (queryLower.includes('homework') && item.type === 'homework') {
        score += 50;
      }
      if (queryLower.includes('syllabus') && item.type === 'syllabus') {
        score += 50;
      }

      if (score > 0) {
        // Build highlighted snippet
        const snippet = this.buildSnippet(item.content, matchedTerms);
        const highlightedTitle = this.highlightText(item.title, matchedTerms);

        // Find best matching code snippet if applicable
        let bestCodeSnippet = null;
        if (item.codeSnippets && item.codeSnippets.length > 0) {
          for (const code of item.codeSnippets) {
            const codeLower = code.toLowerCase();
            if (queryTokens.some(t => codeLower.includes(t)) || Array.from(matchedTerms).some(t => codeLower.includes(t))) {
              bestCodeSnippet = code;
              break;
            }
          }
          if (!bestCodeSnippet) bestCodeSnippet = item.codeSnippets[0];
        }

        scoredResults.push({
          item,
          score,
          matchedTerms: Array.from(matchedTerms),
          highlightedTitle,
          highlightedSnippet: snippet,
          matchingCodeSnippet: bestCodeSnippet,
        });
      }
    }

    // Sort descending by score
    scoredResults.sort((a, b) => b.score - a.score);

    const executionTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

    return {
      results: scoredResults.slice(0, limit),
      total: scoredResults.length,
      query: rawQuery,
      executionTimeMs,
      appliedFilters: { type, tag, fuzzy, semantic },
    };
  }

  buildSnippet(content, terms, maxLength = 180) {
    if (!content) return '';
    const clean = content.replace(/\s+/g, ' ').trim();
    if (!terms || terms.size === 0) {
      return clean.length > maxLength ? clean.slice(0, maxLength) + '...' : clean;
    }

    const lower = clean.toLowerCase();
    let bestPos = -1;

    for (const term of terms) {
      const pos = lower.indexOf(term.toLowerCase());
      if (pos !== -1) {
        if (bestPos === -1 || pos < bestPos) {
          bestPos = pos;
        }
      }
    }

    if (bestPos === -1) {
      return clean.length > maxLength ? clean.slice(0, maxLength) + '...' : clean;
    }

    const start = Math.max(0, bestPos - 45);
    const end = Math.min(clean.length, start + maxLength);
    let snippet = clean.slice(start, end);

    if (start > 0) snippet = '...' + snippet;
    if (end < clean.length) snippet = snippet + '...';

    return this.highlightText(snippet, terms);
  }

  highlightText(text, terms) {
    if (!text || !terms || terms.size === 0) return text || '';
    const sortedTerms = Array.from(terms).filter(Boolean).sort((a, b) => b.length - a.length);
    if (!sortedTerms.length) return text;

    const escaped = sortedTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(`(${escaped})`, 'gi');

    return text.replace(regex, '<mark class="search-highlight">$1</mark>');
  }
}
