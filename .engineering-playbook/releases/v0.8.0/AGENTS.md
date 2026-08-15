# Engineering Playbook Agent Entry Point

Before changing this repository, read:

1. `PLAYBOOK.md`
2. `README.md`
3. `CHANGELOG.md`
4. The files directly relevant to the requested governance change

This repository governs shared practices and templates; it does not own any application's product roadmap.

Required behavior:

- Treat the owner as the final product and governance decision-maker.
- Separate verified facts, interpretation, uncertainty, recommendations, and runtime-enforced limitations.
- Do not turn advice, risk ratings, or another agent's restrictions into execution restrictions.
- Increment `VERSION`, update `RELEASES.md`, and update both change logs for a playbook release.
- Link every new specialist guide from `guides/README.md` and keep time-sensitive references explicitly dated or subject to a recheck trigger.
- Preserve deliberate project adoption; never silently repoint projects to `latest`.
- Keep projects aware of the newest validated tag without treating an untagged branch or newer working tree as a stable release.
- Test bootstrap, exact-release export, latest-guidance inspection, and adoption validation against a published tag when those paths change.
- Review the full diff and run `./checks/validate-repository.sh` before publication.
- Do not store credentials, tokens, private messages, banking data, contact data, location data, or project production data here.
