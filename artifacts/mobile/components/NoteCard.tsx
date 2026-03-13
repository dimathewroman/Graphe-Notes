import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { Note } from "@/lib/api";
import { formatRelativeTime, stripHtml, truncate } from "@/lib/utils";

type Props = {
  note: Note;
  onPress: () => void;
  onLongPress?: () => void;
  compact?: boolean;
};

export function NoteCard({ note, onPress, onLongPress, compact }: Props) {
  const { colors } = useTheme();
  const snippet = truncate(stripHtml(note.contentText || note.content), 120);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.header}>
        <Text
          style={[styles.title, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {note.title || "Untitled Note"}
        </Text>
        <View style={styles.indicators}>
          {note.pinned && (
            <Feather name="bookmark" size={12} color={colors.primary} />
          )}
          {note.favorite && (
            <Feather name="star" size={12} color="#f59e0b" />
          )}
          {note.locked && (
            <Feather name="lock" size={12} color={colors.muted} />
          )}
        </View>
      </View>

      {!compact && snippet ? (
        <Text
          style={[styles.snippet, { color: colors.muted }]}
          numberOfLines={2}
        >
          {snippet}
        </Text>
      ) : null}

      <View style={styles.footer}>
        <Text style={[styles.time, { color: colors.muted }]}>
          {formatRelativeTime(note.updatedAt)}
        </Text>
        {note.tags.length > 0 && (
          <View style={styles.tags}>
            {note.tags.slice(0, 3).map((tag) => (
              <View
                key={tag}
                style={[
                  styles.tag,
                  { backgroundColor: colors.primary + "18" },
                ]}
              >
                <Text style={[styles.tagText, { color: colors.primary }]}>
                  #{tag}
                </Text>
              </View>
            ))}
            {note.tags.length > 3 && (
              <Text style={[styles.tagMore, { color: colors.muted }]}>
                +{note.tags.length - 3}
              </Text>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  indicators: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  snippet: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  time: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  tags: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    flexShrink: 1,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  tagMore: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
});
