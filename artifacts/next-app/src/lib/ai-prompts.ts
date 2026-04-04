// Single source of truth for AI prompt templates used by NoteEditor and QuickBitEditor.

export function buildAiPrompt(
  action: string,
  selectedText: string,
  customInstruction?: string
): string | null {
  const prompts: Record<string, string> = {
    shorter_25: `Make the following text approximately 25% shorter while preserving key meaning. Return only the shortened text, no explanations:\n\n${selectedText}`,
    shorter_50: `Make the following text approximately 50% shorter while preserving key meaning. Return only the shortened text, no explanations:\n\n${selectedText}`,
    shorter_custom: `Make the following text shorter. Additional instruction: ${customInstruction || ""}. Return only the shortened text, no explanations:\n\n${selectedText}`,
    longer_25: `Expand the following text by approximately 25% with more detail and context. Return only the expanded text, no explanations:\n\n${selectedText}`,
    longer_50: `Expand the following text by approximately 50% with more detail and context. Return only the expanded text, no explanations:\n\n${selectedText}`,
    longer_custom: `Expand the following text. Additional instruction: ${customInstruction || ""}. Return only the expanded text, no explanations:\n\n${selectedText}`,
    proofread: `Proofread and fix grammar, spelling, and punctuation in the following text. Do not change wording or structure. Return only the corrected text, no explanations:\n\n${selectedText}`,
    simplify: `Rewrite the following text using shorter sentences and simpler vocabulary. Keep the same length and meaning. Return only the simplified text, no explanations:\n\n${selectedText}`,
    improve: `Enhance the clarity, flow, and word choice of the following text while preserving its original meaning. Return only the improved text, no explanations:\n\n${selectedText}`,
    rewrite: `Completely rephrase the following text while preserving its core meaning. Return only the rewritten text, no explanations:\n\n${selectedText}`,
    tone_casual: `Rewrite the following text in a casual tone. Return only the rewritten text, no explanations:\n\n${selectedText}`,
    tone_professional: `Rewrite the following text in a professional tone. Return only the rewritten text, no explanations:\n\n${selectedText}`,
    tone_friendly: `Rewrite the following text in a friendly tone. Return only the rewritten text, no explanations:\n\n${selectedText}`,
    tone_direct: `Rewrite the following text in a direct tone. Return only the rewritten text, no explanations:\n\n${selectedText}`,
    tone_custom: `Rewrite the following text with the following tone/style: ${customInstruction || ""}. Return only the rewritten text, no explanations:\n\n${selectedText}`,
    summarize_short: `Summarize the following text in 1-2 sentences. Return only the summary, no explanations:\n\n${selectedText}`,
    summarize_balanced: `Summarize the following text in a short paragraph. Return only the summary, no explanations:\n\n${selectedText}`,
    summarize_detailed: `Summarize the following text as detailed bullet points. Return only the bullet-point summary, no explanations:\n\n${selectedText}`,
    summarize_custom: `Summarize the following text. Additional instruction: ${customInstruction || ""}. Return only the summary, no explanations:\n\n${selectedText}`,
    extract_action_items: `Extract all action items, tasks, and to-dos from the following text. Return them as a bulleted list. If no action items are found, return "No action items found.", no explanations:\n\n${selectedText}`,
  };

  return prompts[action] ?? null;
}
