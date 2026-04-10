import type { Recipe, Pack } from '@quokka/shared'

export const socialSchedulePostRecipe: Recipe = {
  id: 'starter-social-schedule-post',
  name: 'Compose Post on X/Twitter',
  description: 'Compose and schedule a post on X (Twitter) with provided content',
  version: '1.0.0',
  schemaVersion: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  hosts: ['x.com', 'twitter.com'],
  slots: [
    { key: 'postContent', label: 'Post Content', type: 'string' },
  ],
  guards: [
    { type: 'url', expect: 'x.com|twitter.com', timeout: 5000 },
  ],
  steps: [
    {
      type: 'navigate',
      url: 'https://x.com/compose/post',
      description: 'Navigate to compose page',
    },
    {
      type: 'wait',
      target: { css: 'div[data-testid="tweetTextarea_0"]' },
      timeout: 8000,
      description: 'Wait for tweet composer to load',
    },
    {
      type: 'type',
      target: { css: 'div[data-testid="tweetTextarea_0"]' },
      value: '{{postContent}}',
      description: 'Type the post content',
    },
    {
      type: 'checkpoint',
      message: 'Post composed — review and send?',
    },
  ],
  meta: {
    createdFrom: 'code',
    tags: ['starter', 'social-media', 'twitter', 'posting'],
    pack: 'starter-social-media',
  },
}

export const socialEngagementMetricsRecipe: Recipe = {
  id: 'starter-social-engagement-metrics',
  name: 'Engagement Metrics Scraper',
  description: 'Extract engagement metrics (likes, reposts, replies) from an X/Twitter post',
  version: '1.0.0',
  schemaVersion: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  hosts: ['x.com', 'twitter.com'],
  slots: [
    { key: 'postUrl', label: 'Post URL', type: 'string' },
  ],
  guards: [
    { type: 'url', expect: 'x.com|twitter.com', timeout: 5000 },
  ],
  steps: [
    {
      type: 'navigate',
      url: '{{postUrl}}',
      description: 'Navigate to the post',
    },
    {
      type: 'wait',
      target: { css: 'article[data-testid="tweet"]' },
      timeout: 8000,
      description: 'Wait for post to load',
    },
    {
      type: 'extract',
      target: { css: 'div[data-testid="reply"] span.css-1jxf684' },
      as: 'replies',
      description: 'Extract reply count',
    },
    {
      type: 'extract',
      target: { css: 'div[data-testid="retweet"] span.css-1jxf684' },
      as: 'reposts',
      description: 'Extract repost count',
    },
    {
      type: 'extract',
      target: { css: 'div[data-testid="like"] span.css-1jxf684' },
      as: 'likes',
      description: 'Extract like count',
    },
    {
      type: 'checkpoint',
      message: 'Metrics extracted — save results?',
    },
  ],
  meta: {
    createdFrom: 'code',
    tags: ['starter', 'social-media', 'twitter', 'analytics'],
    pack: 'starter-social-media',
  },
}

export const socialAutoReplyRecipe: Recipe = {
  id: 'starter-social-auto-reply',
  name: 'Auto-Reply Template Inserter',
  description: 'Insert a template reply to a post on X/Twitter',
  version: '1.0.0',
  schemaVersion: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  hosts: ['x.com', 'twitter.com'],
  slots: [
    { key: 'postUrl', label: 'Post URL to Reply To', type: 'string' },
    { key: 'replyText', label: 'Reply Text', type: 'string' },
  ],
  guards: [
    { type: 'url', expect: 'x.com|twitter.com', timeout: 5000 },
  ],
  steps: [
    {
      type: 'navigate',
      url: '{{postUrl}}',
      description: 'Navigate to the target post',
    },
    {
      type: 'wait',
      target: { css: 'article[data-testid="tweet"]' },
      timeout: 8000,
      description: 'Wait for post to load',
    },
    {
      type: 'click',
      target: { css: 'div[data-testid="reply"]' },
      description: 'Click the reply button',
    },
    {
      type: 'wait',
      target: { css: 'div[data-testid="tweetTextarea_0"]' },
      timeout: 5000,
      description: 'Wait for reply composer to open',
    },
    {
      type: 'type',
      target: { css: 'div[data-testid="tweetTextarea_0"]' },
      value: '{{replyText}}',
      description: 'Type the reply text',
    },
    {
      type: 'checkpoint',
      message: 'Reply composed — review and send?',
    },
  ],
  meta: {
    createdFrom: 'code',
    tags: ['starter', 'social-media', 'twitter', 'reply'],
    pack: 'starter-social-media',
  },
}

export const socialMediaRecipes = [
  socialSchedulePostRecipe,
  socialEngagementMetricsRecipe,
  socialAutoReplyRecipe,
]

export const socialMediaPack: Pack = {
  id: 'starter-social-media',
  name: 'Social Media Management',
  description: 'Automate social media workflows: compose posts, scrape engagement metrics, and auto-reply',
  version: '1.0.0',
  recipeIds: socialMediaRecipes.map((r) => r.id),
}
