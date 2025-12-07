export const siteConfig = {
  siteUrl: 'https://5whys.jonathanrreed.com',
  siteName: '5 Whys Career Reflection Tools',
  titleTemplate: '%s · 5 Whys Career Reflection Tools',
  description:
    'Interactive career reflection, resume polishing, and networking practice tools crafted for calm, intentional professional growth.',
  keywords: [
    'career reflection',
    'resume game',
    'resume improvement',
    'networking practice',
    'career storytelling tools',
    'five whys exercise',
    'job search tools'
  ],
  themeColor: '#0f111a',
  ogImage: '/og-default.png',
  locale: 'en_US',
  author: {
    name: 'Jonathan Reed',
    url: 'https://www.jonathanrreed.com',
    twitter: '@jonathanrreed',
    linkedin: 'https://www.linkedin.com/in/jonathanrreed/',
  }
};

export const baseSchemas = {
  website: {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': 'https://5whys.jonathanrreed.com/#website',
    url: 'https://5whys.jonathanrreed.com',
    name: '5 Whys Career Reflection Tools',
    description:
      'Interactive career reflection, resume polishing, and networking practice tools crafted for calm, intentional professional growth.',
    inLanguage: 'en-US'
  },
  creator: {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': 'https://www.jonathanrreed.com/#person',
    name: 'Jonathan Reed',
    url: 'https://www.jonathanrreed.com',
    sameAs: [
      'https://www.linkedin.com/in/jonathanrreed/',
      'https://github.com/jonathanrreed'
    ]
  }
};
