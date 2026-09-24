import { getRequestConfig } from 'next-intl/server';

// English only for now. Adding a language means adding messages/<locale>.json and choosing the
// locale here (from a cookie or the user's profile); URLs stay the same.
export default getRequestConfig(async () => {
  const locale = 'en';
  return {
    locale,
    timeZone: 'Asia/Kolkata',
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
