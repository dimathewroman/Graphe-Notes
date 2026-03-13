import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/contexts/ThemeContext";
import { api } from "@/lib/api";
import { stripHtml } from "@/lib/utils";

type QuickAction = {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  prompt: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Summarize",
    icon: "file-text",
    prompt: "Please summarize this note concisely, highlighting the key points.",
  },
  {
    label: "Fix Grammar",
    icon: "check-circle",
    prompt: "Please fix any grammar, spelling, and punctuation errors in this text. Return the corrected text only.",
  },
  {
    label: "Action Items",
    icon: "list",
    prompt: "Extract all action items and to-dos from this note. Format as a bulleted list.",
  },
  {
    label: "Expand",
    icon: "maximize-2",
    prompt: "Please expand on this note, adding more detail and context where appropriate.",
  },
  {
    label: "Simplify",
    icon: "minimize-2",
    prompt: "Rewrite this note in simpler, clearer language while preserving all key information.",
  },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  noteContent: string;
  onInsert: (text: string) => void;
};

export function AIAssistant({ visible, onClose, noteContent, onInsert }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [customPrompt, setCustomPrompt] = useState("");
  const [result, setResult] = useState("");

  const aiMutation = useMutation({
    mutationFn: (prompt: string) =>
      api.aiComplete({
        provider: "anthropic",
        apiKey: "",
        model: "claude-sonnet-4-6",
        prompt,
        noteContext: stripHtml(noteContent),
      }),
    onSuccess: (data) => {
      setResult(data.result);
    },
  });

  const handleQuickAction = useCallback(
    (action: QuickAction) => {
      aiMutation.mutate(action.prompt);
    },
    [aiMutation]
  );

  const handleCustomSubmit = useCallback(() => {
    const prompt = customPrompt.trim();
    if (!prompt) return;
    aiMutation.mutate(prompt);
  }, [customPrompt, aiMutation]);

  const handleInsert = useCallback(() => {
    if (result) {
      onInsert(result);
      setResult("");
      onClose();
    }
  }, [result, onInsert, onClose]);

  const handleClose = useCallback(() => {
    setResult("");
    setCustomPrompt("");
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <Pressable style={styles.overlay} onPress={handleClose}>
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
            onPress={() => {}}
          >
            <View style={styles.handle}>
              <View
                style={[
                  styles.handleBar,
                  { backgroundColor: colors.border },
                ]}
              />
            </View>

            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleRow}>
                <Feather name="cpu" size={18} color={colors.primary} />
                <Text
                  style={[styles.sheetTitle, { color: colors.foreground }]}
                >
                  AI Assistant
                </Text>
              </View>
              <Pressable onPress={handleClose} hitSlop={8}>
                <Feather name="x" size={20} color={colors.muted} />
              </Pressable>
            </View>

            <Text style={[styles.sectionLabel, { color: colors.muted }]}>
              QUICK ACTIONS
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.actionsRow}
            >
              {QUICK_ACTIONS.map((action) => (
                <Pressable
                  key={action.label}
                  onPress={() => handleQuickAction(action)}
                  disabled={aiMutation.isPending}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                      opacity: pressed || aiMutation.isPending ? 0.6 : 1,
                    },
                  ]}
                >
                  <Feather
                    name={action.icon}
                    size={16}
                    color={colors.primary}
                  />
                  <Text
                    style={[
                      styles.actionLabel,
                      { color: colors.foreground },
                    ]}
                  >
                    {action.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={[styles.sectionLabel, { color: colors.muted }]}>
              CUSTOM PROMPT
            </Text>
            <View style={styles.promptRow}>
              <TextInput
                style={[
                  styles.promptInput,
                  {
                    color: colors.foreground,
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="Ask anything about this note..."
                placeholderTextColor={colors.muted}
                value={customPrompt}
                onChangeText={setCustomPrompt}
                onSubmitEditing={handleCustomSubmit}
                multiline
              />
              <Pressable
                onPress={handleCustomSubmit}
                disabled={aiMutation.isPending || !customPrompt.trim()}
                style={[
                  styles.sendBtn,
                  {
                    backgroundColor: colors.primary,
                    opacity:
                      aiMutation.isPending || !customPrompt.trim() ? 0.5 : 1,
                  },
                ]}
              >
                <Feather name="send" size={16} color="#fff" />
              </Pressable>
            </View>

            {aiMutation.isPending && (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.muted }]}>
                  Generating...
                </Text>
              </View>
            )}

            {aiMutation.isError && (
              <View
                style={[
                  styles.resultBox,
                  { backgroundColor: colors.destructive + "15" },
                ]}
              >
                <Text
                  style={[styles.resultText, { color: colors.destructive }]}
                >
                  {aiMutation.error?.message || "Something went wrong"}
                </Text>
              </View>
            )}

            {result && !aiMutation.isPending && (
              <View>
                <Text style={[styles.sectionLabel, { color: colors.muted }]}>
                  RESULT
                </Text>
                <ScrollView
                  style={[
                    styles.resultBox,
                    { backgroundColor: colors.surfaceElevated },
                  ]}
                >
                  <Text
                    style={[styles.resultText, { color: colors.foreground }]}
                    selectable
                  >
                    {result}
                  </Text>
                </ScrollView>
                <View style={styles.resultActions}>
                  <Pressable
                    onPress={handleInsert}
                    style={[
                      styles.insertBtn,
                      { backgroundColor: colors.primary },
                    ]}
                  >
                    <Feather name="download" size={14} color="#fff" />
                    <Text style={styles.insertBtnText}>Insert into Note</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    maxHeight: "80%",
  },
  handle: {
    alignItems: "center",
    paddingVertical: 10,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sheetTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 8,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 4,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  promptRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-end",
  },
  promptInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  resultBox: {
    borderRadius: 10,
    padding: 14,
    maxHeight: 200,
  },
  resultText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  resultActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
    marginBottom: 8,
  },
  insertBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  insertBtnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
