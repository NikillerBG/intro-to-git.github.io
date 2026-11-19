import { getCollection } from 'astro:content';
import * as syllabusFile from '../content/syllabus.md';

export interface SearchItem {
  id: string;
  type: 'lesson' | 'slide' | 'bonus' | 'homework' | 'syllabus';
  slug: string;
  title: string;
  parentTitle?: string;
  order?: number;
  slideIndex?: number;
  url: string;
  lessonUrl?: string;
  slidesUrl?: string;
  tags: string[];
  description?: string;
  headings: string[];
  content: string;
  rawMarkdown: string;
  codeSnippets: string[];
  commands: string[];
}

export interface CourseIndex {
  items: SearchItem[];
  metadata: {
    totalLessons: number;
    totalSlides: number;
    totalBonus: number;
    totalHomeworks: number;
    allTags: string[];
    commands: { command: string; count: number; firstSeenUrl: string; firstSeenTitle: string }[];
  };
}

function cleanMarkdown(md: string): string {
  return md
    .replaceAll(/<bonus-content>.*?<\/bonus-content>/gs, '')
    .replaceAll(/<[^>]+>/g, ' ')
    .replaceAll(/```[\s\S]*?```/g, ' ')
    .replaceAll(/`([^`]+)`/g, '$1')
    .replaceAll(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replaceAll(/[#*_\->~`]/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function extractCodeBlocks(md: string): string[] {
  const blocks: string[] = [];
  const regex = /```(?:[a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(md)) !== null) {
    const code = match[1].trim();
    if (code) blocks.push(code);
  }
  return blocks;
}

function extractCommands(codeBlocks: string[], rawText: string): string[] {
  const commandsSet = new Set<string>();
  const combined = codeBlocks.join('\n') + '\n' + rawText;
  
  const gitRegex = /\bgit\s+([a-z0-9_-]+)/gi;
  let match;
  while ((match = gitRegex.exec(combined)) !== null) {
    const cmd = match[0].toLowerCase();
    if (!['git repository', 'git repo', 'git docs', 'git book', 'git server'].includes(cmd)) {
      commandsSet.add(cmd);
    }
  }

  const bashCommands = [
    'cd', 'ls', 'pwd', 'mkdir', 'rmdir', 'rm', 'cp', 'mv', 'touch', 'cat', 'less', 'head', 'tail',
    'grep', 'find', 'chmod', 'chown', 'echo', 'export', 'alias', 'ssh-keygen', 'ssh', 'curl', 'wget',
    'tar', 'man', 'ps', 'kill', 'killall', 'top', 'nano', 'vim'
  ];

  for (const bCmd of bashCommands) {
    const regex = new RegExp(`(?:^|[\\s;&|])${bCmd}(?:\\s|$)`, 'm');
    if (regex.test(combined)) {
      commandsSet.add(bCmd);
    }
  }

  return Array.from(commandsSet);
}

function extractHeadings(md: string): string[] {
  const headings: string[] = [];
  const regex = /^(?:#{1,4})\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(md)) !== null) {
    headings.push(match[1].trim());
  }
  return headings;
}

function cleanFirstSentence(text: string): string {
  const cleaned = cleanMarkdown(text);
  const firstSentence = cleaned.split(/[.?!]\s/)[0];
  if (firstSentence && firstSentence.length > 5) {
    return firstSentence.length > 70 ? firstSentence.slice(0, 67) + '...' : firstSentence;
  }
  return cleaned.slice(0, 50) + (cleaned.length > 50 ? '...' : '');
}

export async function buildCourseIndex(baseUrl: string = '/'): Promise<CourseIndex> {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  const items: SearchItem[] = [];
  const allTagsSet = new Set<string>();
  const commandMap = new Map<string, { count: number; firstSeenUrl: string; firstSeenTitle: string }>();

  // 1. Index Lessons and Slides
  const rawLessons = await getCollection('lessons');
  const lessons = rawLessons.sort((a, b) => a.data.order - b.data.order);

  let totalSlidesCount = 0;

  for (const lesson of lessons) {
    const lessonSlug = lesson.id;
    const lessonTitle = lesson.data.title;
    const lessonOrder = lesson.data.order;
    const lessonTags = lesson.data.tags || [];
    const lessonDesc = lesson.data.description || '';
    const hasSlides = lesson.data.hasSlides !== false;
    const lessonUrl = `${normalizedBase}lessons/${lessonSlug}`;
    const slidesBaseUrl = `${normalizedBase}slides/${lessonSlug}`;

    lessonTags.forEach(t => allTagsSet.add(t));

    const fullBody = lesson.body || '';
    const fullCleanText = cleanMarkdown(fullBody);
    const fullCodeBlocks = extractCodeBlocks(fullBody);
    const fullCommands = extractCommands(fullCodeBlocks, fullBody);
    const fullHeadings = extractHeadings(fullBody);

    // Register full lesson item
    items.push({
      id: `lesson-${lessonSlug}`,
      type: 'lesson',
      slug: lessonSlug,
      title: `${lessonOrder}. ${lessonTitle}`,
      parentTitle: lessonTitle,
      order: lessonOrder,
      url: lessonUrl,
      lessonUrl,
      slidesUrl: hasSlides ? slidesBaseUrl : undefined,
      tags: lessonTags,
      description: lessonDesc,
      headings: fullHeadings,
      content: `${lessonDesc} ${fullCleanText}`.trim(),
      rawMarkdown: fullBody,
      codeSnippets: fullCodeBlocks,
      commands: fullCommands,
    });

    for (const cmd of fullCommands) {
      if (!commandMap.has(cmd)) {
        commandMap.set(cmd, { count: 1, firstSeenUrl: lessonUrl, firstSeenTitle: `${lessonOrder}. ${lessonTitle}` });
      } else {
        commandMap.get(cmd)!.count++;
      }
    }

    if (hasSlides) {
      const cleanContentForSlides = fullBody.replaceAll(/<bonus-content>.*?<\/bonus-content>/gs, '');
      const slideParts = cleanContentForSlides.split(/\r?\n---\r?\n/);

      // Slide 0: Title Slide
      const slide0Url = `${slidesBaseUrl}#/0`;
      items.push({
        id: `slide-${lessonSlug}-0`,
        type: 'slide',
        slug: lessonSlug,
        title: `${lessonTitle} (Overview)`,
        parentTitle: `${lessonOrder}. ${lessonTitle}`,
        order: lessonOrder,
        slideIndex: 0,
        url: slide0Url,
        lessonUrl,
        slidesUrl: slidesBaseUrl,
        tags: lessonTags,
        description: lessonDesc || `Overview of Lesson ${lessonOrder}: ${lessonTitle}`,
        headings: [`${lessonOrder}. ${lessonTitle}`],
        content: `${lessonTitle} ${lessonDesc}`.trim(),
        rawMarkdown: `## ${lessonOrder}. ${lessonTitle}\n\n${lessonDesc}`,
        codeSnippets: [],
        commands: [],
      });
      totalSlidesCount++;

      let lastSeenSection = lessonTitle;

      // Slide 1..N
      for (let sIdx = 1; sIdx < slideParts.length; sIdx++) {
        const slideRaw = slideParts[sIdx].trim();
        if (!slideRaw) continue;

        const slideHeadings = extractHeadings(slideRaw);
        if (slideHeadings.length > 0) {
          lastSeenSection = slideHeadings[0];
        }

        let slideTitle = slideHeadings.length > 0 
          ? slideHeadings[0] 
          : `${lastSeenSection}: ${cleanFirstSentence(slideRaw)}`;

        if (!slideTitle || slideTitle.trim() === ':') {
          slideTitle = `Slide ${sIdx}`;
        }

        const slideCodeBlocks = extractCodeBlocks(slideRaw);
        const slideCommands = extractCommands(slideCodeBlocks, slideRaw);
        const slideCleanText = cleanMarkdown(slideRaw);
        const slideUrl = `${slidesBaseUrl}#/${sIdx}`;

        items.push({
          id: `slide-${lessonSlug}-${sIdx}`,
          type: 'slide',
          slug: lessonSlug,
          title: slideTitle,
          parentTitle: `${lessonOrder}. ${lessonTitle}`,
          order: lessonOrder,
          slideIndex: sIdx,
          url: slideUrl,
          lessonUrl,
          slidesUrl: slidesBaseUrl,
          tags: lessonTags,
          description: `Slide ${sIdx} of Lesson ${lessonOrder}: ${lessonTitle}`,
          headings: slideHeadings,
          content: `${slideTitle} ${slideCleanText}`.trim(),
          rawMarkdown: slideRaw,
          codeSnippets: slideCodeBlocks,
          commands: slideCommands,
        });
        totalSlidesCount++;
      }
    }
  }

  // 2. Index Bonus / Extras
  const bonusMaterials = await getCollection('bonus');
  for (const bonus of bonusMaterials) {
    const bonusSlug = bonus.id;
    const bonusTitle = bonus.data.title;
    const bonusDesc = bonus.data.description || '';
    const bonusUrl = `${normalizedBase}bonus/${bonusSlug}`;
    const body = bonus.body || '';
    const cleanText = cleanMarkdown(body);
    const codeBlocks = extractCodeBlocks(body);
    const commands = extractCommands(codeBlocks, body);
    const headings = extractHeadings(body);

    items.push({
      id: `bonus-${bonusSlug}`,
      type: 'bonus',
      slug: bonusSlug,
      title: bonusTitle,
      parentTitle: 'Extras & Bonus',
      url: bonusUrl,
      lessonUrl: bonusUrl,
      tags: ['bonus', 'extras'],
      description: bonusDesc,
      headings,
      content: `${bonusTitle} ${bonusDesc} ${cleanText}`.trim(),
      rawMarkdown: body,
      codeSnippets: codeBlocks,
      commands,
    });
  }

  // 3. Index Homeworks
  const homeworks = await getCollection('homeworks');
  for (const hw of homeworks) {
    const hwSlug = hw.id;
    const hwTitle = hw.data.title;
    const hwDesc = hw.data.description || '';
    const hwOrder = hw.data.order;
    const hwUrl = `${normalizedBase}homeworks/${hwSlug}`;
    const body = hw.body || '';
    const cleanText = cleanMarkdown(body);
    const codeBlocks = extractCodeBlocks(body);
    const commands = extractCommands(codeBlocks, body);
    const headings = extractHeadings(body);

    items.push({
      id: `homework-${hwSlug}`,
      type: 'homework',
      slug: hwSlug,
      title: hwTitle,
      parentTitle: 'Course Homeworks',
      order: hwOrder,
      url: hwUrl,
      lessonUrl: hwUrl,
      tags: ['homework', 'assignment'],
      description: hwDesc,
      headings,
      content: `${hwTitle} ${hwDesc} ${cleanText}`.trim(),
      rawMarkdown: body,
      codeSnippets: codeBlocks,
      commands,
    });
  }

  // 4. Index Syllabus
  try {
    const syllabusRaw = syllabusFile.rawContent ? syllabusFile.rawContent() : '';
    if (syllabusRaw) {
      const cleanSyllabus = cleanMarkdown(syllabusRaw);
      const syllabusHeadings = extractHeadings(syllabusRaw);
      const syllabusUrl = `${normalizedBase}syllabus/`;
      const syllabusSlidesUrl = `${normalizedBase}syllabus/slides`;

      items.push({
        id: 'syllabus-main',
        type: 'syllabus',
        slug: 'syllabus',
        title: 'Course Syllabus: COS 3100 Intro to Git',
        parentTitle: 'COS 3100 Syllabus',
        url: syllabusUrl,
        lessonUrl: syllabusUrl,
        slidesUrl: syllabusSlidesUrl,
        tags: ['syllabus', 'schedule', 'grading', 'aubg', 'lecturer'],
        description: 'Course outline, grading policy, office hours, and topics breakdown.',
        headings: syllabusHeadings,
        content: `COS 3100 Intro to Git Syllabus Mihail Mikov AUBG ${cleanSyllabus}`.trim(),
        rawMarkdown: syllabusRaw,
        codeSnippets: [],
        commands: [],
      });
    }
  } catch (e) {
    // fallback
  }

  const commandsList = Array.from(commandMap.entries())
    .map(([command, data]) => ({ command, ...data }))
    .sort((a, b) => b.count - a.count);

  return {
    items,
    metadata: {
      totalLessons: lessons.length,
      totalSlides: totalSlidesCount,
      totalBonus: bonusMaterials.length,
      totalHomeworks: homeworks.length,
      allTags: Array.from(allTagsSet).sort(),
      commands: commandsList,
    },
  };
}
