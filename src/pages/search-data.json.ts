import type { APIRoute } from 'astro';
import { buildCourseIndex } from '../lib/courseIndexer';
import { baseUrl } from '../helpers.astro';

export const GET: APIRoute = async () => {
  const index = await buildCourseIndex(baseUrl);
  return new Response(JSON.stringify(index), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
