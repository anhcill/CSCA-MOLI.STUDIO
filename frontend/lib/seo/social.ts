export const SOCIAL_LINKS = {
  facebook: {
    label: 'Facebook',
    url: 'https://www.facebook.com/share/18s2UCaqDd/?mibextid=wwXIfr',
    display: 'Facebook MOLI.STUDIO',
  },
  youtube: {
    label: 'YouTube',
    url: 'https://www.youtube.com/@moli-studio',
    display: 'youtube.com/@moli-studio',
  },
  tiktok: {
    label: 'TikTok',
    url: 'https://www.tiktok.com/@cloudly_studio?_r=1&_t=ZS-96g847YII09',
    display: '@cloudly_studio',
  },
  zalo: {
    label: 'Zalo',
    url: 'https://zalo.me/0812352005',
    display: '0812 352 005',
  },
} as const;

export const SAME_AS_LINKS = [
  SOCIAL_LINKS.facebook.url,
  SOCIAL_LINKS.youtube.url,
  SOCIAL_LINKS.tiktok.url,
];
