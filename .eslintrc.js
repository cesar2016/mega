// https://docs.expo.dev/guides/using-eslint/
module.exports = {
  extends: 'expo',
  // La Edge Function corre en Deno: no la parsea el ESLint de Node.
  ignorePatterns: ['/dist/*', '/supabase/functions/*'],
};
