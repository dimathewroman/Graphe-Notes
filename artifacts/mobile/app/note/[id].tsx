import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
  Modal,
  FlatList,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/contexts/ThemeContext";
import { api, Note, NoteVersion } from "@/lib/api";
import { formatRelativeTime, wordCount, stripHtml } from "@/lib/utils";
import { TentapEditor, TentapEditorRef } from "@/components/RichTextEditor";
import { AIAssistant } from "@/components/AIAssistant";

const AUTOSAVE_DELAY = 1500;

type FeatherIconName = React.ComponentProps<typeof Feather>["name"];

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function NoteEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const noteId = Number(id);
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const editorRef = useRef<TentapEditorRef | null>(null);
  const [title, setTitle] = useState("");
  const [contentLoaded, setContentLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [showVersions, setShowVersions] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockMode, setLockMode] = useState<"set" | "verify">("set");
  const [lockPassword, setLockPassword] = useState("");
  const [lockConfirm, setLockConfirm] = useState("");
  const [lockError, setLockError] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);
  const [tagInput, setTagInput] = useState("");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingHtmlRef = useRef<string>("");

  const { data: note, isLoading } = useQuery({
    queryKey: ["note", noteId],
    queryFn: () => api.getNote(noteId),
    enabled: !!noteId,
  });

  const { data: versionsData, refetch: refetchVersions } = useQuery({
    queryKey: ["versions", noteId],
    queryFn: () => api.getVersions(noteId),
    enabled: showVersions && !!noteId,
  });

  const updateMut = useMutation({
    mutationFn: (data: Parameters<typeof api.updateNote>[1]) =>
      api.updateNote(noteId, data),
    onSuccess: () => {
      setSaveStatus("saved");
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
    onError: () => setSaveStatus("unsaved"),
  });

  const togglePinMut = useMutation({
    mutationFn: () => api.togglePin(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["note", noteId] });
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });

  const toggleFavMut = useMutation({
    mutationFn: () => api.toggleFavorite(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["note", noteId] });
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => api.deleteNote(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      router.back();
    },
  });

  const lockMut = useMutation({
    mutationFn: (passwordHash: string) => api.lockNote(noteId, passwordHash),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["note", noteId] });
      setShowLockModal(false);
      setLockPassword("");
      setLockConfirm("");
    },
  });

  const unlockMut = useMutation({
    mutationFn: () => api.unlockNote(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["note", noteId] });
      setIsUnlocked(false);
    },
  });

  const deleteVersionMut = useMutation({
    mutationFn: (versionId: number) => api.deleteVersion(noteId, versionId),
    onSuccess: () => {
      refetchVersions();
    },
  });

  useEffect(() => {
    if (note && !contentLoaded) {
      setTitle(note.title);
      if (!note.locked) setIsUnlocked(true);
    }
  }, [note, contentLoaded]);

  useEffect(() => {
    if (note && !contentLoaded && (isUnlocked || !note.locked)) {
      pendingHtmlRef.current = note.content || "";
      setContentLoaded(true);
    }
  }, [note, contentLoaded, isUnlocked]);

  const scheduleSave = useCallback(
    (data: Parameters<typeof api.updateNote>[1]) => {
      setSaveStatus("unsaved");
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        setSaveStatus("saving");
        updateMut.mutate(data);
      }, AUTOSAVE_DELAY);
    },
    [updateMut]
  );

  const handleTitleChange = useCallback(
    (text: string) => {
      setTitle(text);
      scheduleSave({
        title: text,
        content: pendingHtmlRef.current,
      });
    },
    [scheduleSave]
  );

  const handleContentChange = useCallback(
    (html: string) => {
      pendingHtmlRef.current = html;
      scheduleSave({
        title,
        content: html,
        contentText: stripHtml(html),
      });
    },
    [scheduleSave, title]
  );

  const handleAddTag = useCallback(() => {
    const tag = tagInput.trim().toLowerCase();
    if (!tag || !note) return;
    const newTags = [...new Set([...note.tags, tag])];
    updateMut.mutate({ tags: newTags });
    setTagInput("");
    queryClient.invalidateQueries({ queryKey: ["note", noteId] });
  }, [tagInput, note, updateMut, noteId, queryClient]);

  const handleRemoveTag = useCallback(
    (tag: string) => {
      if (!note) return;
      updateMut.mutate({ tags: note.tags.filter((t: string) => t !== tag) });
      queryClient.invalidateQueries({ queryKey: ["note", noteId] });
    },
    [note, updateMut, noteId, queryClient]
  );

  const handleDelete = useCallback(() => {
    if (Platform.OS === "web") {
      if (confirm("Delete this note?")) deleteMut.mutate();
      return;
    }
    Alert.alert("Delete Note", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMut.mutate() },
    ]);
  }, [deleteMut]);

  const handleRestoreVersion = useCallback(
    async (version: NoteVersion) => {
      try {
        const fullVersion = await api.getVersion(noteId, version.id);
        const content = fullVersion.version.content;
        editorRef.current?.setContent(content);
        setTitle(version.title);
        pendingHtmlRef.current = content;
        updateMut.mutate({
          title: version.title,
          content,
          contentText: fullVersion.version.contentText || "",
        });
        setShowVersions(false);
      } catch (error) {
        console.warn("Failed to fetch version content:", error);
        Alert.alert("Error", "Failed to load version content");
      }
    },
    [updateMut, noteId]
  );

  const handleDeleteVersion = useCallback(
    (versionId: number) => {
      if (Platform.OS === "web") {
        if (confirm("Delete this version?")) deleteVersionMut.mutate(versionId);
        return;
      }
      Alert.alert("Delete Version", "This cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteVersionMut.mutate(versionId) },
      ]);
    },
    [deleteVersionMut]
  );

  const handleLockSet = useCallback(async () => {
    if (lockPassword.length < 4) {
      setLockError("Password must be at least 4 characters");
      return;
    }
    if (lockPassword !== lockConfirm) {
      setLockError("Passwords do not match");
      return;
    }
    setLockError("");
    const hash = await sha256(lockPassword);
    lockMut.mutate(hash);
  }, [lockPassword, lockConfirm, lockMut]);

  const handleLockVerify = useCallback(async () => {
    if (!note) return;
    const hash = await sha256(lockPassword);
    if (hash === note.lockPasswordHash) {
      setIsUnlocked(true);
      setShowLockModal(false);
      setLockPassword("");
      setLockError("");
    } else {
      setLockError("Incorrect password");
    }
  }, [lockPassword, note]);

  const handleLockToggle = useCallback(() => {
    if (!note) return;
    if (note.locked && isUnlocked) {
      unlockMut.mutate();
    } else if (note.locked && !isUnlocked) {
      setLockMode("verify");
      setLockPassword("");
      setLockConfirm("");
      setLockError("");
      setShowLockModal(true);
    } else {
      setLockMode("set");
      setLockPassword("");
      setLockConfirm("");
      setLockError("");
      setShowLockModal(true);
    }
  }, [note, isUnlocked, unlockMut]);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (note?.locked && !isUnlocked) {
    const webTopPad = Platform.OS === "web" ? 20 : 0;
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.navBar,
            {
              paddingTop: insets.top + 4 + webTopPad,
              borderBottomColor: colors.border,
              backgroundColor: colors.background,
            },
          ]}
        >
          <Pressable onPress={() => router.back()} style={styles.navBtn} hitSlop={8}>
            <Feather name="chevron-left" size={24} color={colors.primary} />
            <Text style={[styles.navBtnText, { color: colors.primary }]}>Notes</Text>
          </Pressable>
        </View>
        <View style={styles.lockedContainer}>
          <Feather name="lock" size={48} color={colors.muted} />
          <Text style={[styles.lockedTitle, { color: colors.foreground }]}>
            {note.title || "Locked Note"}
          </Text>
          <Text style={[styles.lockedDesc, { color: colors.muted }]}>
            This note is password protected
          </Text>
          <Pressable
            onPress={() => {
              setLockMode("verify");
              setLockPassword("");
              setLockError("");
              setShowLockModal(true);
            }}
            style={[styles.unlockBtn, { backgroundColor: colors.primary }]}
          >
            <Feather name="unlock" size={16} color="#fff" />
            <Text style={styles.unlockBtnText}>Enter Password</Text>
          </Pressable>
        </View>
        <LockModal
          visible={showLockModal}
          mode={lockMode}
          colors={colors}
          password={lockPassword}
          confirm={lockConfirm}
          error={lockError}
          onPasswordChange={setLockPassword}
          onConfirmChange={setLockConfirm}
          onSubmit={lockMode === "set" ? handleLockSet : handleLockVerify}
          onClose={() => setShowLockModal(false)}
          isPending={lockMut.isPending}
        />
      </View>
    );
  }

  const webTopPad = Platform.OS === "web" ? 20 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.navBar,
          {
            paddingTop: insets.top + 4 + webTopPad,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.navBtn} hitSlop={8}>
          <Feather name="chevron-left" size={24} color={colors.primary} />
          <Text style={[styles.navBtnText, { color: colors.primary }]}>Notes</Text>
        </Pressable>
        <View style={styles.navRight}>
          <Text style={[styles.saveStatusText, { color: colors.muted }]}>
            {saveStatus === "saving" ? "Saving..." : saveStatus === "unsaved" ? "Unsaved" : "Saved"}
          </Text>
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync();
              togglePinMut.mutate();
            }}
            hitSlop={8}
          >
            <Feather name="bookmark" size={18} color={note?.pinned ? colors.primary : colors.muted} />
          </Pressable>
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync();
              toggleFavMut.mutate();
            }}
            hitSlop={8}
          >
            <Feather name="star" size={18} color={note?.favorite ? "#f59e0b" : colors.muted} />
          </Pressable>
          <Pressable onPress={handleLockToggle} hitSlop={8}>
            <Feather
              name={note?.locked ? "unlock" : "lock"}
              size={18}
              color={note?.locked ? colors.primary : colors.muted}
            />
          </Pressable>
          <Pressable onPress={() => setShowAI(true)} hitSlop={8}>
            <Feather name="cpu" size={18} color={colors.primary} />
          </Pressable>
          <Pressable onPress={() => setShowVersions(true)} hitSlop={8}>
            <Feather name="clock" size={18} color={colors.muted} />
          </Pressable>
          <Pressable onPress={handleDelete} hitSlop={8}>
            <Feather name="trash-2" size={18} color={colors.destructive} />
          </Pressable>
        </View>
      </View>

      <TextInput
        style={[styles.titleInput, { color: colors.foreground, borderBottomColor: colors.border }]}
        value={title}
        onChangeText={handleTitleChange}
        placeholder="Note title"
        placeholderTextColor={colors.muted}
        returnKeyType="next"
      />

      {note && note.tags.length > 0 && (
        <View style={styles.tagsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.tagsInner}>
              {note.tags.map((tag: string) => (
                <Pressable
                  key={tag}
                  onPress={() => handleRemoveTag(tag)}
                  style={[styles.tagChip, { backgroundColor: colors.primary + "18" }]}
                >
                  <Text style={[styles.tagChipText, { color: colors.primary }]}>#{tag}</Text>
                  <Feather name="x" size={10} color={colors.primary} />
                </Pressable>
              ))}
              <Pressable
                onPress={() => setShowTagInput(true)}
                style={[styles.addTagBtn, { borderColor: colors.border }]}
              >
                <Feather name="plus" size={12} color={colors.muted} />
                <Text style={[styles.addTagText, { color: colors.muted }]}>Tag</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      )}

      {!note?.tags?.length && (
        <Pressable
          onPress={() => setShowTagInput(true)}
          style={[styles.addTagStandalone, { borderBottomColor: colors.border }]}
        >
          <Feather name="tag" size={14} color={colors.muted} />
          <Text style={[styles.addTagText, { color: colors.muted }]}>Add tags</Text>
        </Pressable>
      )}

      <View style={styles.editorContainer}>
        {contentLoaded && (
          <TentapEditor
            initialContent={note?.content || ""}
            isDark={isDark}
            onChange={handleContentChange}
            editorRef={editorRef}
          />
        )}
      </View>

      <Modal visible={showTagInput} transparent animationType="fade" onRequestClose={() => setShowTagInput(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowTagInput(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.surface }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add Tag</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.foreground, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              placeholder="Tag name"
              placeholderTextColor={colors.muted}
              value={tagInput}
              onChangeText={setTagInput}
              autoFocus
              autoCapitalize="none"
              onSubmitEditing={handleAddTag}
            />
            <View style={styles.modalButtons}>
              <Pressable onPress={() => setShowTagInput(false)} style={[styles.modalBtn, { borderColor: colors.border }]}>
                <Text style={[styles.modalBtnText, { color: colors.muted }]}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleAddTag} style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>Add</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <LockModal
        visible={showLockModal}
        mode={lockMode}
        colors={colors}
        password={lockPassword}
        confirm={lockConfirm}
        error={lockError}
        onPasswordChange={setLockPassword}
        onConfirmChange={setLockConfirm}
        onSubmit={lockMode === "set" ? handleLockSet : handleLockVerify}
        onClose={() => setShowLockModal(false)}
        isPending={lockMut.isPending}
      />

      <AIAssistant
        visible={showAI}
        onClose={() => setShowAI(false)}
        noteContent={pendingHtmlRef.current || note?.content || ""}
        onInsert={(text) => {
          editorRef.current?.insertText(text);
        }}
      />

      <Modal visible={showVersions} transparent animationType="slide" onRequestClose={() => setShowVersions(false)}>
        <View style={[styles.versionsOverlay, { backgroundColor: colors.background + "f0" }]}>
          <View
            style={[styles.versionsHeader, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}
          >
            <View>
              <Text style={[styles.versionsTitle, { color: colors.foreground }]}>Version History</Text>
              <Text style={[styles.versionsSubtitle, { color: colors.muted }]}>
                Up to 50 versions saved automatically
              </Text>
            </View>
            <Pressable onPress={() => setShowVersions(false)}>
              <Feather name="x" size={22} color={colors.muted} />
            </Pressable>
          </View>

          {versionsData?.versions && versionsData.versions.length > 0 ? (
            <FlatList
              data={versionsData.versions}
              keyExtractor={(v) => String(v.id)}
              contentContainerStyle={styles.versionsList}
              renderItem={({ item }) => {
                const wc = wordCount(item.contentText || "");
                const isExpanded = expandedVersion === item.id;
                return (
                  <View>
                    <Pressable
                      onPress={() => setExpandedVersion(isExpanded ? null : item.id)}
                      style={[styles.versionItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    >
                      <View style={styles.versionInfo}>
                        <Text style={[styles.versionItemTitle, { color: colors.foreground }]} numberOfLines={1}>
                          {item.title || "Untitled"}
                        </Text>
                        <Text style={[styles.versionMeta, { color: colors.muted }]}>
                          {formatRelativeTime(item.createdAt)} · {wc} word{wc !== 1 ? "s" : ""}
                        </Text>
                      </View>
                      <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color={colors.muted} />
                    </Pressable>
                    {isExpanded && (
                      <View style={[styles.versionPreview, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                        <Text style={[styles.versionPreviewText, { color: colors.foreground }]} numberOfLines={6}>
                          {(item.contentText || "").slice(0, 500) || "No preview available"}
                        </Text>
                        <View style={styles.versionActions}>
                          <Pressable
                            onPress={() => handleRestoreVersion(item)}
                            style={[styles.versionActionBtn, { backgroundColor: colors.primary }]}
                          >
                            <Feather name="rotate-ccw" size={13} color="#fff" />
                            <Text style={styles.versionActionText}>Restore</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => handleDeleteVersion(item.id)}
                            style={[styles.versionActionBtn, { backgroundColor: colors.destructive }]}
                          >
                            <Feather name="trash-2" size={13} color="#fff" />
                            <Text style={styles.versionActionText}>Delete</Text>
                          </Pressable>
                        </View>
                      </View>
                    )}
                  </View>
                );
              }}
            />
          ) : (
            <View style={styles.versionsEmpty}>
              <Feather name="clock" size={40} color={colors.muted} />
              <Text style={[styles.versionsEmptyText, { color: colors.muted }]}>No versions saved yet</Text>
              <Text style={[styles.versionsEmptyHint, { color: colors.muted }]}>
                Versions are saved automatically every 5 minutes while you write
              </Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

function LockModal({
  visible,
  mode,
  colors,
  password,
  confirm,
  error,
  onPasswordChange,
  onConfirmChange,
  onSubmit,
  onClose,
  isPending,
}: {
  visible: boolean;
  mode: "set" | "verify";
  colors: ReturnType<typeof useTheme>["colors"];
  password: string;
  confirm: string;
  error: string;
  onPasswordChange: (v: string) => void;
  onConfirmChange: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  isPending: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.modalContent, { backgroundColor: colors.surface }]} onPress={() => {}}>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>
            {mode === "set" ? "Set Password" : "Enter Password"}
          </Text>
          <TextInput
            style={[styles.modalInput, { color: colors.foreground, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
            placeholder="Password"
            placeholderTextColor={colors.muted}
            value={password}
            onChangeText={onPasswordChange}
            secureTextEntry
            autoFocus
            onSubmitEditing={mode === "verify" ? onSubmit : undefined}
          />
          {mode === "set" && (
            <TextInput
              style={[styles.modalInput, { color: colors.foreground, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              placeholder="Confirm password"
              placeholderTextColor={colors.muted}
              value={confirm}
              onChangeText={onConfirmChange}
              secureTextEntry
            />
          )}
          {error ? <Text style={[styles.lockError, { color: colors.destructive }]}>{error}</Text> : null}
          <View style={styles.modalButtons}>
            <Pressable onPress={onClose} style={[styles.modalBtn, { borderColor: colors.border }]}>
              <Text style={[styles.modalBtnText, { color: colors.muted }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onSubmit}
              disabled={isPending}
              style={[styles.modalBtn, { backgroundColor: colors.primary, opacity: isPending ? 0.6 : 1 }]}
            >
              <Text style={[styles.modalBtnText, { color: "#fff" }]}>
                {isPending ? "..." : mode === "set" ? "Lock" : "Unlock"}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  navBtnText: { fontSize: 16, fontFamily: "Inter_500Medium" },
  navRight: { flexDirection: "row", alignItems: "center", gap: 14 },
  saveStatusText: { fontSize: 12, fontFamily: "Inter_400Regular", marginRight: 4 },
  titleInput: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tagsRow: { paddingHorizontal: 16, paddingVertical: 8 },
  tagsInner: { flexDirection: "row", gap: 6, alignItems: "center" },
  tagChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  tagChipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  addTagBtn: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderStyle: "dashed" },
  addTagStandalone: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 20, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  addTagText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  editorContainer: { flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  modalContent: { width: "85%", maxWidth: 400, borderRadius: 16, padding: 24, gap: 16 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  modalInput: { height: 44, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, fontSize: 15, fontFamily: "Inter_400Regular" },
  modalButtons: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  modalBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: "transparent" },
  modalBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  lockError: { fontSize: 13, fontFamily: "Inter_400Regular" },
  lockedContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 40 },
  lockedTitle: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center" },
  lockedDesc: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center" },
  unlockBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  unlockBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  versionsOverlay: { flex: 1 },
  versionsHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  versionsTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  versionsSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  versionsList: { padding: 20, gap: 8 },
  versionItem: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, gap: 12 },
  versionInfo: { flex: 1, gap: 2 },
  versionItemTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  versionMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  versionPreview: { marginTop: -4, padding: 14, borderRadius: 0, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderTopWidth: 0 },
  versionPreviewText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  versionActions: { flexDirection: "row", gap: 10, marginTop: 12, justifyContent: "flex-end" },
  versionActionBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  versionActionText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  versionsEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 40 },
  versionsEmptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  versionsEmptyHint: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
});
