Runtime API key setup

For local development, set the Firebase API key at runtime (in dev server or on the hosting platform):

- Option 1: Add a small script before your app loads (index.html):

<script>
  window.FIREBASE_API_KEY = "YOUR_FIREBASE_API_KEY";
</script>

- Option 2: Use build-time replacements or environment injection in your hosting system.

Do NOT commit the actual API key into source control.
