Security & Secret Handling

If you discover a secret (API key, token) committed accidentally:

1. Revoke/rotate the secret immediately on the provider dashboard.
2. Remove the secret from the code and replace with an environment variable or runtime placeholder.
3. If the secret was pushed to remote, an admin should rewrite history (force-push) to remove it from the remote history and then rotate the secret.
4. Create a new commit that removes the secret and create a PR for review if you cannot force-push.

Contact: repo admins or the project owner to coordinate rollback and key rotation.
