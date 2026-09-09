# P26 Reviewer Input Safety

The reviewer packet contains hashes, scoped identifiers, timestamps and explicit checklist items only. It must not contain passwords, bearer tokens, private signing keys, database connection strings or other operational secrets.

The review response contract likewise accepts only decision metadata and an external artifact digest/reference. Secrets are outside scope and must remain outside repository evidence.
