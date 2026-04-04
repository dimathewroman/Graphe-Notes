<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of Graphe Notes with PostHog analytics. Ten new events were added across five files, covering the full user journey from authentication through note management, AI usage, and content export. User identification was extended to cover session restores and OAuth login attempts in addition to the existing email login/signup flows.

| Event | Description | File |
|---|---|---|
| `oauth_login_attempted` | User initiates OAuth sign-in (Google or Apple) | `src/hooks/use-auth.ts` |
| `folder_created` | User successfully creates a new folder | `src/components/Sidebar.tsx` |
| `note_exported` | User exports a note as PDF or Markdown (`format` property) | `src/components/NoteEditor.tsx` |
| `note_pinned` | User pins or unpins a note (`pinned: true/false`) | `src/components/NoteEditor.tsx` |
| `note_favorited` | User marks or unmarks a note as favorite (`favorited: true/false`) | `src/components/NoteEditor.tsx` |
| `note_vaulted` | User moves a note into or out of the vault (`vaulted: true/false`) | `src/components/NoteEditor.tsx` |
| `version_history_restored` | User restores a previous note version | `src/components/NoteEditor.tsx` |
| `ai_selection_action_triggered` | User triggers an inline AI action on selected text (`action`, `provider`) | `src/hooks/use-ai-action.ts` |
| `ai_rate_limit_reached` | User hits the hourly or monthly AI rate limit (`reason`, `reset_in_ms`) | `src/hooks/use-ai-action.ts` |
| `quick_bit_promoted_to_note` | User promotes a Quick Bit into a full note (`quick_bit_id`, `note_id`) | `src/components/QuickBitEditor.tsx` |

**User identification improvements:** `posthog.identify()` is now also called on session restore (page load with existing session) and on every `onAuthStateChange` event — ensuring OAuth users are identified immediately after their redirect lands.

## Next steps

We've built a pinned "Analytics basics" dashboard with five insights to keep an eye on user behaviour:

- **Dashboard:** https://us.posthog.com/project/357073/dashboard/1431465
- **Auth Conversion Funnel** (OAuth attempt → login → first note): https://us.posthog.com/project/357073/insights/NSM8kaEO
- **Note Activity (Created vs Deleted):** https://us.posthog.com/project/357073/insights/H5vTbmFg
- **AI Usage: Actions vs Completions vs Rate Limits:** https://us.posthog.com/project/357073/insights/I5LBR1sU
- **Note Exports by Format (PDF vs Markdown):** https://us.posthog.com/project/357073/insights/A53Ul2ET
- **Auth: Logins, Signups & Logouts:** https://us.posthog.com/project/357073/insights/Q8Cyt71K

### Agent skill

We've left an agent skill folder in your project at `artifacts/next-app/.claude/skills/integration-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
