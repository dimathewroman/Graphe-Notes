// Seed 10 preset templates into the templates table.
// Run with: npx tsx scripts/seed-templates.ts (from repo root with SUPABASE_DB_URL set)

import { db, templatesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: { type: string }[];
};

function doc(...nodes: TiptapNode[]) {
  return { type: "doc", content: nodes };
}
function h2(text: string): TiptapNode {
  return { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] };
}
function p(text?: string): TiptapNode {
  return text
    ? { type: "paragraph", content: [{ type: "text", text }] }
    : { type: "paragraph" };
}
function ul(...items: TiptapNode[]): TiptapNode {
  return { type: "bulletList", content: items.map(c => ({ type: "listItem", content: [c] })) };
}

const PRESETS = [
  {
    name: "Brain Dump",
    description: "Get everything out of your head fast",
    category: "capture" as const,
    content: doc(
      h2("Brain Dump"),
      p("Get it out of your head. Spelling and order don't matter."),
      ul(p(), p(), p())
    ),
  },
  {
    name: "Quick Meeting Notes",
    description: "What was discussed, actions, blockers",
    category: "capture" as const,
    content: doc(
      h2("Meeting Notes"),
      p("What was discussed"),
      h2("My action items"),
      ul(p()),
      h2("Waiting on"),
      ul(p())
    ),
  },
  {
    name: "Daily Momentum",
    description: "One thing, plate check, bonus energy",
    category: "plan" as const,
    content: doc(
      h2("Today"),
      p("One thing that would make today good:"),
      p(),
      p("What's already on my plate:"),
      ul(p()),
      p("If I have extra energy:"),
      p()
    ),
  },
  {
    name: "Task Triage",
    description: "Do today vs. do eventually",
    category: "plan" as const,
    content: doc(
      h2("Do today"),
      ul(p()),
      h2("Do eventually"),
      ul(p())
    ),
  },
  {
    name: "Weekly Check-in",
    description: "Wins, friction, intentions, release",
    category: "reflect" as const,
    content: doc(
      h2("Weekly Check-in"),
      p("What went well this week?"),
      p(),
      p("What felt harder than it should have?"),
      p(),
      p("What do I want to carry into next week?"),
      p(),
      p("What can I let go of?"),
      p(),
      p("One thing I'm proud of, even if it's small:"),
      p()
    ),
  },
  {
    name: "Mood + Energy Log",
    description: "Date, mood, energy, one-line why",
    category: "reflect" as const,
    content: doc(
      h2("Mood + Energy"),
      p("Date:"),
      p("Mood:"),
      p("Energy:"),
      p("In a sentence, why:")
    ),
  },
  {
    name: "Project Brief",
    description: "What, who, done looks like, first steps",
    category: "create" as const,
    content: doc(
      h2("Project Brief"),
      p("What is this?"),
      p(),
      p("Who is it for?"),
      p(),
      p("What does done look like?"),
      p(),
      p("First steps:"),
      ul(p())
    ),
  },
  {
    name: "Writing Draft",
    description: "Title, core message, open canvas",
    category: "create" as const,
    content: doc(
      h2("Title"),
      p(),
      p("The one thing this piece is trying to say:"),
      p(),
      { type: "horizontalRule" },
      p()
    ),
  },
  {
    name: "Decision Log",
    description: "Options, values, decision + rationale",
    category: "plan" as const,
    content: doc(
      h2("Decision"),
      p("What am I deciding?"),
      p(),
      p("Options I'm considering:"),
      ul(p()),
      p("What matters most to me here?"),
      p(),
      p("What I decided and why:"),
      p()
    ),
  },
  {
    name: "Gratitude + Wins",
    description: "Something good, handled well, grateful for",
    category: "reflect" as const,
    content: doc(
      h2("Gratitude + Wins"),
      p("Something good that happened today:"),
      p(),
      p("Something I handled well:"),
      p(),
      p("Someone or something I'm grateful for:"),
      p()
    ),
  },
];

async function main() {
  console.log("Seeding preset templates...");

  // Delete existing presets first to avoid duplicates on re-run
  await db.delete(templatesTable).where(eq(templatesTable.isPreset, true));
  console.log("Cleared existing presets.");

  for (const preset of PRESETS) {
    await db.insert(templatesTable).values({
      userId: null,
      name: preset.name,
      description: preset.description,
      category: preset.category,
      content: preset.content,
      isPreset: true,
    });
    console.log(`  ✓ ${preset.name}`);
  }

  console.log(`\nSeeded ${PRESETS.length} preset templates.`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
