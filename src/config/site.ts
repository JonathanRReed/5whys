export const siteConfig = {
  siteUrl: 'https://5whys.jonathanrreed.com/',
  siteName: '5 Whys Career Studio | Free career tools by Jonathan R. Reed',
  titleTemplate: '%s · 5 Whys Career Studio',
  description:
    '5 Whys Career Studio is a set of free, local-only career tools by Jonathan R. Reed for figuring out what you want, fixing resumes, practicing intros, and prepping for interviews.',
  keywords: [
    'career reflection',
    'resume game',
    'resume improvement',
    'networking practice',
    'career storytelling tools',
    'five whys exercise',
    'job search tools',
    'Jonathan R. Reed',
    'Jonathan Reed',
  ],
  themeColor: '#11140f',
  ogImage: '/og/home.png',
  locale: 'en_US',
  author: {
    name: 'Jonathan R. Reed',
    alternateName: 'Jonathan Reed',
    url: 'https://jonathanrreed.com',
    twitter: '@jonathanrreed',
    linkedin: 'https://www.linkedin.com/in/jonathanrreed/',
  },
};

export const baseSchemas = {
  website: {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': 'https://5whys.jonathanrreed.com/#website',
    url: 'https://5whys.jonathanrreed.com/',
    name: '5 Whys Career Studio',
    description:
      '5 Whys Career Studio is a set of free, local-only career tools by Jonathan R. Reed for figuring out what you want, fixing resumes, practicing intros, and prepping for interviews.',
    inLanguage: 'en-US',
    publisher: {
      '@id': 'https://jonathanrreed.com/about/#person',
    },
  },
  creator: {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': 'https://jonathanrreed.com/about/#person',
    name: 'Jonathan R. Reed',
    url: 'https://jonathanrreed.com',
  },
};
