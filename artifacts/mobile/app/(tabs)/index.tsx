import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/contexts/ThemeContext";
import { api, Note } from "@/lib/api";
import { cache } from "@/lib/cache";
import { NoteCard } from "@/components/NoteCard";

type SortOption = "updatedAt" | "createdAt" | "title";
type ViewMode = "list" | "gallery";

export default function NotesScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    folderId?: string;
    folderName?: string;
    smartFolderId?: string;
    tag?: string;
  }>();
  const activeFolderId = params.folderId ? Number(params.folderId) : undefined;
  const activeTag = params.tag || undefined;
  const folderLabel = params.folderName || undefined;
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const { data: notes, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["notes", { sortBy, sortDir, folderId: activeFolderId, tag: activeTag }],
    queryFn: async () => {
      try {
        const data = await api.getNotes({
          sortBy,
          sortDir,
          ...(activeFolderId ? { folderId: activeFolderId } : {}),
          ...(activeTag ? { tag: activeTag } : {}),
        });
        if (!activeFolderId && !activeTag) {
          cache.setNotes(data);
        }
        return data;
      } catch (err) {
        const cached = await cache.getNotes();
        if (cached) {
          let filtered = cached;
          if (activeFolderId) {
            filtered = filtered.filter((n) => String(n.folderId) === String(activeFolderId));
          }
          if (activeTag) {
            filtered = filtered.filter((n) => n.tags?.includes(activeTag));
          }
          return filtered;
        }
        throw err;
      }
    },
  });

  const createNoteMut = useMutation({
    mutationFn: () => api.createNote({ title: "" }),
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      router.push({ pathname: "/note/[id]", params: { id: String(note.id) } });
    },
  });

  const filteredNotes = useMemo(() => {
    if (!notes) return [];
    if (!search.trim()) return notes;
    const q = search.toLowerCase();
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        (n.contentText || "").toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [notes, search]);

  const pinnedNotes = useMemo(
    () => filteredNotes.filter((n) => n.pinned),
    [filteredNotes]
  );
  const unpinnedNotes = useMemo(
    () => filteredNotes.filter((n) => !n.pinned),
    [filteredNotes]
  );

  const handleCreateNote = useCallback(async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    createNoteMut.mutate();
  }, [createNoteMut]);

  const cycleSortBy = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    const options: SortOption[] = ["updatedAt", "createdAt", "title"];
    const idx = options.indexOf(sortBy);
    setSortBy(options[(idx + 1) % options.length]);
  }, [sortBy]);

  const toggleSortDir = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }, []);

  const sortLabel =
    sortBy === "updatedAt"
      ? "Modified"
      : sortBy === "createdAt"
        ? "Created"
        : "Title";

  const renderNote = useCallback(
    ({ item }: { item: Note }) => (
      <NoteCard
        note={item}
        compact={viewMode === "gallery"}
        onPress={() =>
          router.push({ pathname: "/note/[id]", params: { id: String(item.id) } })
        }
      />
    ),
    [viewMode]
  );

  const renderSectionHeader = useCallback(
    (title: string) => (
      <Text style={[styles.sectionTitle, { color: colors.muted }]}>
        {title}
      </Text>
    ),
    [colors]
  );

  const webTopPad = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12 + webTopPad,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.titleRow}>
          {folderLabel && (
            <Pressable
              onPress={() => router.setParams({ folderId: "", folderName: "", smartFolderId: "", tag: "" })}
              hitSlop={8}
            >
              <Feather name="chevron-left" size={22} color={colors.primary} />
            </Pressable>
          )}
          <Text style={[styles.screenTitle, { color: colors.foreground }]}>
            {folderLabel || "Notes"}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => setViewMode((m) => (m === "list" ? "gallery" : "list"))}
            style={styles.iconBtn}
          >
            <Feather
              name={viewMode === "list" ? "grid" : "list"}
              size={20}
              color={colors.muted}
            />
          </Pressable>
          <Pressable
            onPress={handleCreateNote}
            style={[styles.createBtn, { backgroundColor: colors.primary }]}
          >
            <Feather name="plus" size={20} color="#fff" />
          </Pressable>
        </View>
      </View>

      <View
        style={[styles.searchRow, { borderBottomColor: colors.border }]}
      >
        <View
          style={[styles.searchBox, { backgroundColor: colors.surfaceElevated }]}
        >
          <Feather name="search" size={16} color={colors.muted} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search notes..."
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Feather name="x" size={16} color={colors.muted} />
            </Pressable>
          )}
        </View>

        <View style={styles.sortRow}>
          <Pressable onPress={cycleSortBy} style={styles.sortBtn}>
            <Feather name="bar-chart-2" size={12} color={colors.muted} />
            <Text style={[styles.sortLabel, { color: colors.muted }]}>
              {sortLabel}
            </Text>
          </Pressable>
          <Pressable onPress={toggleSortDir} style={styles.sortBtn}>
            <Feather
              name={sortDir === "asc" ? "arrow-up" : "arrow-down"}
              size={12}
              color={colors.muted}
            />
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filteredNotes.length === 0 ? (
        <View style={styles.center}>
          <Feather name="file-text" size={48} color={colors.muted} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            {search ? "No matching notes" : "No notes yet"}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
            {search
              ? "Try a different search term"
              : "Tap + to create your first note"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={[
            ...(pinnedNotes.length > 0
              ? [{ type: "header" as const, title: "Pinned" }]
              : []),
            ...pinnedNotes.map((n) => ({ type: "note" as const, note: n })),
            ...(pinnedNotes.length > 0 && unpinnedNotes.length > 0
              ? [{ type: "header" as const, title: "All Notes" }]
              : []),
            ...unpinnedNotes.map((n) => ({ type: "note" as const, note: n })),
          ]}
          renderItem={({ item }) => {
            if (item.type === "header") return renderSectionHeader(item.title);
            return renderNote({ item: item.note });
          }}
          keyExtractor={(item, idx) =>
            item.type === "header" ? `h-${idx}` : `n-${item.note.id}`
          }
          contentContainerStyle={[
            styles.listContent,
            viewMode === "gallery" && styles.galleryContent,
          ]}
          numColumns={viewMode === "gallery" ? 2 : 1}
          key={viewMode}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  screenTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  createBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  searchRow: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    gap: 8,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    height: 40,
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sortBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 2,
  },
  sortLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingBottom: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 40,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingVertical: 4,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    gap: 10,
    paddingTop: 4,
  },
  galleryContent: {
    gap: 10,
  },
});
