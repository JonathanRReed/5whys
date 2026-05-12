import { defineCollection, z } from 'astro:content';

const blogCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().default('Jonathan R Reed'),
    tags: z.array(z.string()).default([]),
    category: z.enum([
      'career-reflection',
      'resume-tips',
      'interview-prep',
      'networking',
      'ai-career',
    ]),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
    ogImage: z.string().optional(),
  }),
});

export const collections = {
  blog: blogCollection,
};
