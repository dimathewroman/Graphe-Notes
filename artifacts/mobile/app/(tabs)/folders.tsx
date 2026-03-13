import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  StyleSheet,
  Modal,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/contexts/ThemeContext";
import { api, Folder, SmartFolder } from "@/lib/api";
import { cache } from "@/lib/cache";
import { formatRelativeTime } from "@/lib/utils";

export default function FoldersScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editFolder, setEditFolder] = useState<Folder | null>(null);
  const [folderName, setFolderName] = useState("");

  const { data: folders, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["folders"],
    queryFn: async () => {
      try {
        const data = await api.getFolders();
        cache.setFolders(data);
        return data;
      } catch (err) {
        const cached = await cache.getFolders();
        if (cached) return cached;
        throw err;
      }
    },
  });

  const { data: smartFolders } = useQuery({
    queryKey: ["smartFolders"],
    queryFn: async () => {
      try {
        const data = await api.getSmartFolders();
        cache.setSmartFolders(data);
        return data;
      } catch (err) {
        const cached = await cache.getSmartFolders();
        if (cached) return cached;
        throw err;
      }
    },
  });

  const createMut = useMutation({
    mutationFn: (name: string) => api.createFolder({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      setShowCreateModal(false);
      setFolderName("");
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      api.updateFolder(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      setEditFolder(null);
      setFolderName("");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.deleteFolder(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["folders"] }),
  });

  const handleDelete = useCallback(
    (folder: Folder) => {
      if (Platform.OS === "web") {
        if (confirm(`Delete folder "${folder.name}"?`)) {
          deleteMut.mutate(folder.id);
        }
        return;
      }
      Alert.alert("Delete Folder", `Delete "${folder.name}"?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteMut.mutate(folder.id),
        },
      ]);
    },
    [deleteMut]
  );

  const handleEdit = useCallback((folder: Folder) => {
    setEditFolder(folder);
    setFolderName(folder.name);
  }, []);

  const handleSave = useCallback(() => {
    const name = folderName.trim();
    if (!name) return;
    if (editFolder) {
      updateMut.mutate({ id: editFolder.id, name });
    } else {
      createMut.mutate(name);
    }
  }, [folderName, editFolder, createMut, updateMut]);

  const webTopPad = Platform.OS === "web" ? 67 : 0;

  const renderSmartFolder = useCallback(
    ({ item }: { item: SmartFolder }) => (
      <Pressable
        onPress={() =>
          router.push({
            pathname: "/(tabs)",
            params: {
              smartFolderId: String(item.id),
              folderName: item.name,
              smartFolderTags: (item.tagRules || []).join(","),
            },
          })
        }
        style={({ pressed }) => [
          styles.folderRow,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <View style={styles.folderIcon}>
          <Feather name="zap" size={20} color="#f59e0b" />
        </View>
        <View style={styles.folderInfo}>
          <Text style={[styles.folderName, { color: colors.foreground }]}>
            {item.name}
          </Text>
          {item.noteCount > 0 && (
            <Text style={[styles.folderDate, { color: colors.muted }]}>
              {item.noteCount} note{item.noteCount !== 1 ? "s" : ""}
            </Text>
          )}
        </View>
        <Feather name="chevron-right" size={18} color={colors.muted} />
      </Pressable>
    ),
    [colors]
  );

  const rootFolders = (folders || []).filter((f) => !f.parentId);
  const childFoldersMap = (folders || []).reduce<Record<number, Folder[]>>((acc, f) => {
    if (f.parentId) {
      if (!acc[f.parentId]) acc[f.parentId] = [];
      acc[f.parentId].push(f);
    }
    return acc;
  }, {});

  const renderFolderTree = (folder: Folder, depth: number = 0) => {
    const children = childFoldersMap[folder.id] || [];
    return (
      <View key={folder.id}>
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/(tabs)",
              params: { folderId: String(folder.id), folderName: folder.name },
            })
          }
          style={({ pressed }) => [
            styles.folderRow,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
              marginLeft: depth * 20,
            },
          ]}
        >
          <View style={[styles.folderIcon, folder.color ? { backgroundColor: folder.color + "20" } : undefined]}>
            <Feather name="folder" size={20} color={folder.color || colors.primary} />
          </View>
          <View style={styles.folderInfo}>
            <Text style={[styles.folderName, { color: colors.foreground }]}>{folder.name}</Text>
            <Text style={[styles.folderDate, { color: colors.muted }]}>{formatRelativeTime(folder.updatedAt)}</Text>
          </View>
          <View style={styles.folderActions}>
            <Pressable onPress={() => handleEdit(folder)} hitSlop={8}>
              <Feather name="edit-2" size={16} color={colors.muted} />
            </Pressable>
            <Pressable onPress={() => handleDelete(folder)} hitSlop={8}>
              <Feather name="trash-2" size={16} color={colors.destructive} />
            </Pressable>
          </View>
        </Pressable>
        {children.map((child) => renderFolderTree(child, depth + 1))}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12 + webTopPad,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>
          Folders
        </Text>
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setFolderName("");
            setEditFolder(null);
            setShowCreateModal(true);
          }}
          style={[styles.createBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name="plus" size={20} color="#fff" />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.sectionTitle, { color: colors.muted }]}>QUICK ACCESS</Text>
          <Pressable
            onPress={() => router.push({ pathname: "/(tabs)", params: {} })}
            style={({ pressed }) => [
              styles.folderRow,
              { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={styles.folderIcon}>
              <Feather name="file-text" size={20} color={colors.primary} />
            </View>
            <View style={styles.folderInfo}>
              <Text style={[styles.folderName, { color: colors.foreground }]}>All Notes</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.muted} />
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: "/(tabs)", params: { favorite: "true" } })}
            style={({ pressed }) => [
              styles.folderRow,
              { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={styles.folderIcon}>
              <Feather name="star" size={20} color="#f59e0b" />
            </View>
            <View style={styles.folderInfo}>
              <Text style={[styles.folderName, { color: colors.foreground }]}>Favorites</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.muted} />
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: "/(tabs)", params: { pinned: "true" } })}
            style={({ pressed }) => [
              styles.folderRow,
              { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={styles.folderIcon}>
              <Feather name="bookmark" size={20} color={colors.primary} />
            </View>
            <View style={styles.folderInfo}>
              <Text style={[styles.folderName, { color: colors.foreground }]}>Pinned</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.muted} />
          </Pressable>

          {smartFolders && smartFolders.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.muted }]}>SMART FOLDERS</Text>
              {(smartFolders || []).map((sf) => (
                <View key={`sf-${sf.id}`}>{renderSmartFolder({ item: sf })}</View>
              ))}
            </>
          )}

          <Text style={[styles.sectionTitle, { color: colors.muted }]}>FOLDERS</Text>
          {rootFolders.length > 0 ? (
            rootFolders.map((folder) => renderFolderTree(folder, 0))
          ) : (
            <View style={styles.emptyFolders}>
              <Feather name="folder" size={32} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.muted }]}>No folders yet</Text>
            </View>
          )}
        </ScrollView>
      )}

      <Modal
        visible={showCreateModal || editFolder !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowCreateModal(false);
          setEditFolder(null);
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setShowCreateModal(false);
            setEditFolder(null);
          }}
        >
          <Pressable
            style={[styles.modalContent, { backgroundColor: colors.surface }]}
            onPress={() => {}}
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {editFolder ? "Rename Folder" : "New Folder"}
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
              placeholder="Folder name"
              placeholderTextColor={colors.muted}
              value={folderName}
              onChangeText={setFolderName}
              autoFocus
              onSubmitEditing={handleSave}
            />
            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => {
                  setShowCreateModal(false);
                  setEditFolder(null);
                }}
                style={[styles.modalBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.modalBtnText, { color: colors.muted }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                style={[
                  styles.modalBtn,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Text
                  style={[styles.modalBtnText, { color: "#fff" }]}
                >
                  {editFolder ? "Save" : "Create"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  screenTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  createBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
  emptyFolders: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 24,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    gap: 8,
    paddingTop: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingTop: 12,
    paddingBottom: 4,
  },
  folderRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  folderIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  folderInfo: { flex: 1, gap: 2 },
  folderName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  folderDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  folderActions: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
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
});
