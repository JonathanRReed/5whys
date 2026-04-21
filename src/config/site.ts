export const siteConfig = {
  siteUrl: 'https://5whys.jonathanrreed.com',
  siteName: '5 Whys Career Studio | Reflection tools by Jonathan R Reed',
  titleTemplate: '%s · 5 Whys Career Studio',
  description:
    '5 Whys is a small studio of career reflection tools by Jonathan R Reed that helps job seekers clarify direction, improve resumes, and prepare stronger interview stories.',
  keywords: [
    'career reflection',
    'resume game',
    'resume improvement',
    'networking practice',
    'career storytelling tools',
    'five whys exercise',
    'job search tools',
    'Jonathan R Reed',
    'Jonathan Reed'
  ],
  themeColor: '#0f111a',
  ogImage: '/og-default.png',
  locale: 'en_US',
  author: {
    name: 'Jonathan R Reed',
    alternateName: 'Jonathan Reed',
    url: 'https://jonathanrreed.com',
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
    name: '5 Whys Career Studio',
    description:
      '5 Whys is a small studio of career reflection tools by Jonathan R Reed that helps job seekers clarify direction, improve resumes, and prepare stronger interview stories.',
    inLanguage: 'en-US',
    publisher: {
      '@id': 'https://jonathanrreed.com/#person',
    },
  },
  creator: {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': 'https://jonathanrreed.com/#person',
    name: 'Jonathan R Reed',
    alternateName: ['Jonathan Reed', 'Jonathan Reed AI'],
    url: 'https://jonathanrreed.com',
    jobTitle: ['AI Consultant', 'Cybersecurity Specialist', 'Red Teamer', 'Developer'],
    sameAs: [
      'https://www.linkedin.com/in/jonathanrreed/',
      'https://github.com/JonathanRReed',
      'https://helloworldfirm.com'
    ],
    worksFor: {
      '@type': 'Organization',
      name: 'Hello.World Consulting'
    }
  }
};
