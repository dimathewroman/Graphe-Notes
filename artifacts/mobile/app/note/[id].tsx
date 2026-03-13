import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
import { RichTextEditor, RichTextEditorRef } from "@/components/RichTextEditor";

const AUTOSAVE_DELAY = 1500;

function buildEditorHtml(isDark: boolean, primaryColor: string) {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    font-size: 16px;
    line-height: 1.65;
    color: ${isDark ? "#f5f5f7" : "#1c1c1e"};
    background: ${isDark ? "#1a1a1e" : "#ffffff"};
    padding: 16px;
    -webkit-overflow-scrolling: touch;
    overflow-y: auto;
  }
  #editor { outline: none; min-height: 200px; }
  #editor p { margin-bottom: 0.5em; }
  #editor h1 { font-size: 1.6em; font-weight: 700; margin: 0.8em 0 0.4em; }
  #editor h2 { font-size: 1.35em; font-weight: 600; margin: 0.7em 0 0.35em; }
  #editor h3 { font-size: 1.15em; font-weight: 600; margin: 0.6em 0 0.3em; }
  #editor ul, #editor ol { padding-left: 1.5em; margin-bottom: 0.5em; }
  #editor li { margin-bottom: 0.2em; }
  #editor blockquote {
    border-left: 3px solid ${primaryColor};
    padding-left: 1em;
    margin-left: 0;
    color: ${isDark ? "#8e8e93" : "#6b7280"};
    font-style: italic;
  }
  #editor code {
    background: ${isDark ? "#2a2a2e" : "#f3f4f6"};
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.9em;
  }
  #editor pre {
    background: ${isDark ? "#242428" : "#f3f4f6"};
    padding: 12px;
    border-radius: 8px;
    overflow-x: auto;
    margin-bottom: 0.5em;
  }
  #editor pre code { background: none; padding: 0; }
  #editor a { color: ${primaryColor}; text-decoration: underline; }
  #editor hr {
    border: none;
    border-top: 1px solid ${isDark ? "#2a2a2e" : "#e5e5ea"};
    margin: 1em 0;
  }
  #editor strong { font-weight: 700; }
  #editor em { font-style: italic; }
  #editor s { text-decoration: line-through; }
  #editor img { max-width: 100%; border-radius: 8px; }
  #editor:empty::before {
    content: 'Start writing...';
    color: ${isDark ? "#555" : "#aaa"};
    pointer-events: none;
  }
</style>
</head>
<body>
<div id="editor" contenteditable="true" style="outline:none;min-height:200px;"></div>
<script>
(function() {
  var el = document.getElementById('editor');
  var debounce = null;

  function postMsg(data) {
    var json = JSON.stringify(data);
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(json);
    } else if (window.parent !== window) {
      window.parent.postMessage(json, '*');
    }
  }

  function emitChange() {
    clearTimeout(debounce);
    debounce = setTimeout(function() {
      postMsg({ type: 'content-change', html: el.innerHTML, text: el.innerText });
    }, 150);
  }

  el.addEventListener('input', emitChange);

  function handleMsg(e) {
    try {
      var msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (!msg || !msg.type) return;
      if (msg.type === 'set-content') {
        el.innerHTML = msg.html || '';
      } else if (msg.type === 'command') {
        el.focus();
        var cmd = msg.command;
        if (cmd === 'bold') document.execCommand('bold');
        else if (cmd === 'italic') document.execCommand('italic');
        else if (cmd === 'underline') document.execCommand('underline');
        else if (cmd === 'strike') document.execCommand('strikeThrough');
        else if (cmd === 'heading1') document.execCommand('formatBlock', false, 'h1');
        else if (cmd === 'heading2') document.execCommand('formatBlock', false, 'h2');
        else if (cmd === 'heading3') document.execCommand('formatBlock', false, 'h3');
        else if (cmd === 'bulletList') document.execCommand('insertUnorderedList');
        else if (cmd === 'orderedList') document.execCommand('insertOrderedList');
        else if (cmd === 'blockquote') document.execCommand('formatBlock', false, 'blockquote');
        else if (cmd === 'codeBlock') document.execCommand('formatBlock', false, 'pre');
        else if (cmd === 'horizontalRule') document.execCommand('insertHorizontalRule');
        else if (cmd === 'undo') document.execCommand('undo');
        else if (cmd === 'redo') document.execCommand('redo');
        emitChange();
      } else if (msg.type === 'insert-text') {
        el.focus();
        document.execCommand('insertHTML', false, msg.text);
        emitChange();
      } else if (msg.type === 'get-content') {
        postMsg({ type: 'content', html: el.innerHTML, text: el.innerText });
      }
    } catch(err) {}
  }

  window.addEventListener('message', handleMsg);
  document.addEventListener('message', function(e) {
    try { window.dispatchEvent(new MessageEvent('message', { data: e.data })); } catch(err) {}
  });

  postMsg({ type: 'ready' });
})();
</script>
</body>
</html>`;
}

export default function NoteEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const noteId = Number(id);
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const editorRef = useRef<RichTextEditorRef>(null);
  const [title, setTitle] = useState("");
  const [editorReady, setEditorReady] = useState(false);
  const [contentLoaded, setContentLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">(
    "saved"
  );
  const [showToolbar, setShowToolbar] = useState(true);
  const [showVersions, setShowVersions] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingContentRef = useRef<{ html: string; text: string } | null>(null);

  const { data: note, isLoading } = useQuery({
    queryKey: ["note", noteId],
    queryFn: () => api.getNote(noteId),
    enabled: !!noteId,
  });

  const { data: versionsData } = useQuery({
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

  useEffect(() => {
    if (note && !contentLoaded) {
      setTitle(note.title);
    }
  }, [note, contentLoaded]);

  useEffect(() => {
    if (note && editorReady && !contentLoaded) {
      editorRef.current?.setContent(note.content || "");
      setContentLoaded(true);
    }
  }, [note, editorReady, contentLoaded]);

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
      const content = pendingContentRef.current;
      scheduleSave({
        title: text,
        ...(content ? { content: content.html, contentText: content.text } : {}),
      });
    },
    [scheduleSave]
  );

  const handleEditorReady = useCallback(() => {
    setEditorReady(true);
  }, []);

  const handleEditorContentChange = useCallback(
    (html: string, text: string) => {
      pendingContentRef.current = { html, text };
      scheduleSave({
        title,
        content: html,
        contentText: text,
      });
    },
    [scheduleSave, title]
  );

  const sendCommand = useCallback(
    (command: string) => {
      editorRef.current?.sendCommand(command);
    },
    []
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
      updateMut.mutate({ tags: note.tags.filter((t) => t !== tag) });
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
    (version: NoteVersion) => {
      editorRef.current?.setContent(version.content);
      setTitle(version.title);
      updateMut.mutate({
        title: version.title,
        content: version.content,
        contentText: version.contentText || "",
      });
      setShowVersions(false);
    },
    [updateMut]
  );

  const editorHtml = useMemo(
    () => buildEditorHtml(isDark, colors.primary),
    [isDark, colors.primary]
  );

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
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
        <Pressable
          onPress={() => router.back()}
          style={styles.navBtn}
          hitSlop={8}
        >
          <Feather name="chevron-left" size={24} color={colors.primary} />
          <Text style={[styles.navBtnText, { color: colors.primary }]}>
            Notes
          </Text>
        </Pressable>

        <View style={styles.navRight}>
          <Text style={[styles.saveStatusText, { color: colors.muted }]}>
            {saveStatus === "saving"
              ? "Saving..."
              : saveStatus === "unsaved"
                ? "Unsaved"
                : "Saved"}
          </Text>
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync();
              togglePinMut.mutate();
            }}
            hitSlop={8}
          >
            <Feather
              name="bookmark"
              size={18}
              color={note?.pinned ? colors.primary : colors.muted}
            />
          </Pressable>
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync();
              toggleFavMut.mutate();
            }}
            hitSlop={8}
          >
            <Feather
              name="star"
              size={18}
              color={note?.favorite ? "#f59e0b" : colors.muted}
            />
          </Pressable>
          <Pressable
            onPress={() => setShowVersions(true)}
            hitSlop={8}
          >
            <Feather name="clock" size={18} color={colors.muted} />
          </Pressable>
          <Pressable onPress={handleDelete} hitSlop={8}>
            <Feather name="trash-2" size={18} color={colors.destructive} />
          </Pressable>
        </View>
      </View>

      <TextInput
        style={[
          styles.titleInput,
          {
            color: colors.foreground,
            borderBottomColor: colors.border,
          },
        ]}
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
              {note.tags.map((tag) => (
                <Pressable
                  key={tag}
                  onPress={() => handleRemoveTag(tag)}
                  style={[
                    styles.tagChip,
                    { backgroundColor: colors.primary + "18" },
                  ]}
                >
                  <Text style={[styles.tagChipText, { color: colors.primary }]}>
                    #{tag}
                  </Text>
                  <Feather name="x" size={10} color={colors.primary} />
                </Pressable>
              ))}
              <Pressable
                onPress={() => setShowTagInput(true)}
                style={[
                  styles.addTagBtn,
                  { borderColor: colors.border },
                ]}
              >
                <Feather name="plus" size={12} color={colors.muted} />
                <Text style={[styles.addTagText, { color: colors.muted }]}>
                  Tag
                </Text>
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
          <Text style={[styles.addTagText, { color: colors.muted }]}>
            Add tags
          </Text>
        </Pressable>
      )}

      <View style={styles.editorContainer}>
        <RichTextEditor
          ref={editorRef}
          editorHtml={editorHtml}
          backgroundColor={colors.surface}
          onReady={handleEditorReady}
          onContentChange={handleEditorContentChange}
        />
      </View>

      {showToolbar && (
        <View
          style={[
            styles.toolbar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 8),
            },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.toolbarInner}
          >
            <ToolbarBtn icon="bold" onPress={() => sendCommand("bold")} colors={colors} />
            <ToolbarBtn icon="italic" onPress={() => sendCommand("italic")} colors={colors} />
            <ToolbarBtn icon="underline" onPress={() => sendCommand("underline")} colors={colors} />
            <ToolbarDivider colors={colors} />
            <ToolbarBtn icon="type" label="H1" onPress={() => sendCommand("heading1")} colors={colors} />
            <ToolbarBtn icon="type" label="H2" onPress={() => sendCommand("heading2")} colors={colors} />
            <ToolbarDivider colors={colors} />
            <ToolbarBtn icon="list" onPress={() => sendCommand("bulletList")} colors={colors} />
            <ToolbarBtn icon="hash" onPress={() => sendCommand("orderedList")} colors={colors} />
            <ToolbarBtn icon="check-square" onPress={() => sendCommand("taskList")} colors={colors} />
            <ToolbarDivider colors={colors} />
            <ToolbarBtn icon="minus" onPress={() => sendCommand("blockquote")} colors={colors} />
            <ToolbarBtn icon="code" onPress={() => sendCommand("codeBlock")} colors={colors} />
            <ToolbarDivider colors={colors} />
            <ToolbarBtn icon="rotate-ccw" onPress={() => sendCommand("undo")} colors={colors} />
            <ToolbarBtn icon="rotate-cw" onPress={() => sendCommand("redo")} colors={colors} />
          </ScrollView>
        </View>
      )}

      <Modal
        visible={showTagInput}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTagInput(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowTagInput(false)}
        >
          <Pressable
            style={[styles.modalContent, { backgroundColor: colors.surface }]}
            onPress={() => {}}
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Add Tag
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  color: colors.foreground,
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Tag name"
              placeholderTextColor={colors.muted}
              value={tagInput}
              onChangeText={setTagInput}
              autoFocus
              autoCapitalize="none"
              onSubmitEditing={handleAddTag}
            />
            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setShowTagInput(false)}
                style={[styles.modalBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.modalBtnText, { color: colors.muted }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleAddTag}
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>Add</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showVersions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVersions(false)}
      >
        <View style={[styles.versionsOverlay, { backgroundColor: colors.background + "f0" }]}>
          <View
            style={[
              styles.versionsHeader,
              {
                paddingTop: insets.top + 12,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.versionsTitle, { color: colors.foreground }]}>
              Version History
            </Text>
            <Pressable onPress={() => setShowVersions(false)}>
              <Feather name="x" size={22} color={colors.muted} />
            </Pressable>
          </View>

          {versionsData?.versions && versionsData.versions.length > 0 ? (
            <FlatList
              data={versionsData.versions}
              keyExtractor={(v) => String(v.id)}
              contentContainerStyle={styles.versionsList}
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.versionItem,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.versionInfo}>
                    <Text
                      style={[
                        styles.versionItemTitle,
                        { color: colors.foreground },
                      ]}
                      numberOfLines={1}
                    >
                      {item.title || "Untitled"}
                    </Text>
                    <Text
                      style={[
                        styles.versionItemSnippet,
                        { color: colors.muted },
                      ]}
                      numberOfLines={2}
                    >
                      {stripHtml(item.content).slice(0, 100)}
                    </Text>
                    <Text
                      style={[styles.versionItemDate, { color: colors.muted }]}
                    >
                      {formatRelativeTime(item.createdAt)}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleRestoreVersion(item)}
                    style={[
                      styles.restoreBtn,
                      { backgroundColor: colors.primary },
                    ]}
                  >
                    <Text style={styles.restoreBtnText}>Restore</Text>
                  </Pressable>
                </View>
              )}
            />
          ) : (
            <View style={styles.versionsEmpty}>
              <Feather name="clock" size={40} color={colors.muted} />
              <Text
                style={[styles.versionsEmptyText, { color: colors.muted }]}
              >
                No versions saved yet
              </Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

function ToolbarBtn({
  icon,
  label,
  onPress,
  colors,
}: {
  icon: string;
  label?: string;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.toolbarBtn,
        { opacity: pressed ? 0.5 : 1 },
      ]}
    >
      {label ? (
        <Text style={[styles.toolbarLabel, { color: colors.foreground }]}>
          {label}
        </Text>
      ) : (
        <Feather name={icon as any} size={18} color={colors.foreground} />
      )}
    </Pressable>
  );
}

function ToolbarDivider({
  colors,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <View
      style={[styles.toolbarDivider, { backgroundColor: colors.border }]}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  navBtnText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
  navRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  saveStatusText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginRight: 4,
  },
  titleInput: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tagsRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tagsInner: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagChipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  addTagBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  addTagStandalone: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  addTagText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  editorContainer: {
    flex: 1,
  },
  toolbar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
  },
  toolbarInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 2,
  },
  toolbarBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  toolbarLabel: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  toolbarDivider: {
    width: 1,
    height: 20,
    marginHorizontal: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    width: "85%",
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    gap: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  modalInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
  },
  modalBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  modalBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  versionsOverlay: {
    flex: 1,
  },
  versionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  versionsTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  versionsList: {
    padding: 20,
    gap: 10,
  },
  versionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  versionInfo: { flex: 1, gap: 4 },
  versionItemTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  versionItemSnippet: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  versionItemDate: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  restoreBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  restoreBtnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  versionsEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  versionsEmptyText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
});
