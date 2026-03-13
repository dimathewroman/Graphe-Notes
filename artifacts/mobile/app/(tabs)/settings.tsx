import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { settingsStore } from "@/lib/cache";
import { api } from "@/lib/api";

const ACCENT_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
];

type FeatherIcon = React.ComponentProps<typeof Feather>["name"];
type ThemeOption = { label: string; value: "system" | "light" | "dark"; icon: FeatherIcon };
const THEME_OPTIONS: ThemeOption[] = [
  { label: "System", value: "system", icon: "smartphone" },
  { label: "Light", value: "light", icon: "sun" },
  { label: "Dark", value: "dark", icon: "moon" },
];

const PROVIDERS = [
  { label: "Anthropic", value: "anthropic" },
  { label: "OpenAI", value: "openai" },
  { label: "Google", value: "google" },
];

export default function SettingsScreen() {
  const { colors, mode, setMode, accentColor, setAccentColor } = useTheme();
  const insets = useSafeAreaInsets();
  const webTopPad = Platform.OS === "web" ? 67 : 0;

  const [aiProvider, setAiProvider] = useState("anthropic");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiModel, setAiModel] = useState("claude-sonnet-4-6");
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsSource, setModelsSource] = useState("");
  const [showCustomModel, setShowCustomModel] = useState(false);

  useEffect(() => {
    settingsStore.getAIConfig().then((config) => {
      setAiProvider(config.provider);
      setAiApiKey(config.apiKey);
      setAiModel(config.model);
      if (config.apiKey) {
        fetchModels(config.provider, config.apiKey);
      }
    });
  }, []);

  const fetchModels = async (provider: string, key: string) => {
    setModelsLoading(true);
    try {
      const result = await api.getModels(provider, key);
      setModels(result.models);
      setModelsSource(result.source);
    } catch (error) {
      console.warn("Failed to fetch models:", error);
      setModels([]);
      setModelsSource("error");
    } finally {
      setModelsLoading(false);
    }
  };

  const handleProviderChange = (provider: string) => {
    setAiProvider(provider);
    settingsStore.set("ai_provider", provider);
    if (aiApiKey) {
      fetchModels(provider, aiApiKey);
    }
  };

  const handleApiKeyBlur = () => {
    settingsStore.set("ai_api_key", aiApiKey);
    if (aiApiKey) {
      fetchModels(aiProvider, aiApiKey);
    }
  };

  const handleModelSelect = (modelId: string) => {
    setAiModel(modelId);
    settingsStore.set("ai_model", modelId);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 + webTopPad, borderBottomColor: colors.border }]}>
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>APPEARANCE</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.foreground }]}>Theme</Text>
          <View style={styles.themeRow}>
            {THEME_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setMode(opt.value)}
                style={[
                  styles.themeOption,
                  {
                    backgroundColor: mode === opt.value ? colors.primary + "20" : colors.surfaceElevated,
                    borderColor: mode === opt.value ? colors.primary : colors.border,
                  },
                ]}
              >
                <Feather name={opt.icon} size={18} color={mode === opt.value ? colors.primary : colors.muted} />
                <Text style={[styles.themeLabel, { color: mode === opt.value ? colors.primary : colors.foreground }]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.foreground }]}>Accent Color</Text>
          <View style={styles.colorsRow}>
            {ACCENT_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setAccentColor(c)}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: c, borderWidth: accentColor === c ? 3 : 0, borderColor: colors.foreground },
                ]}
              >
                {accentColor === c && <Feather name="check" size={14} color="#fff" />}
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.muted }]}>AI ASSISTANT</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.foreground }]}>Provider</Text>
          <View style={styles.themeRow}>
            {PROVIDERS.map((p) => (
              <Pressable
                key={p.value}
                onPress={() => handleProviderChange(p.value)}
                style={[
                  styles.themeOption,
                  {
                    backgroundColor: aiProvider === p.value ? colors.primary + "20" : colors.surfaceElevated,
                    borderColor: aiProvider === p.value ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.themeLabel,
                    { color: aiProvider === p.value ? colors.primary : colors.foreground },
                  ]}
                >
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.foreground }]}>API Key</Text>
          <TextInput
            style={[
              styles.apiKeyInput,
              { color: colors.foreground, backgroundColor: colors.surfaceElevated, borderColor: colors.border },
            ]}
            value={aiApiKey}
            onChangeText={setAiApiKey}
            onBlur={handleApiKeyBlur}
            placeholder="Enter your API key..."
            placeholderTextColor={colors.muted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={[styles.apiKeyHint, { color: colors.muted }]}>
            Your key is stored locally on this device only.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.modelHeader}>
            <Text style={[styles.label, { color: colors.foreground }]}>Model</Text>
            {modelsLoading && <ActivityIndicator size="small" color={colors.primary} />}
            {modelsSource === "live" && (
              <View style={styles.statusBadge}>
                <View style={[styles.statusDot, { backgroundColor: "#10b981" }]} />
                <Text style={[styles.statusText, { color: "#10b981" }]}>Live</Text>
              </View>
            )}
            {modelsSource === "fallback" && (
              <View style={styles.statusBadge}>
                <View style={[styles.statusDot, { backgroundColor: "#f59e0b" }]} />
                <Text style={[styles.statusText, { color: "#f59e0b" }]}>Fallback</Text>
              </View>
            )}
          </View>

          {models.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.modelsList}
            >
              {models.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => handleModelSelect(m.id)}
                  style={[
                    styles.modelChip,
                    {
                      backgroundColor: aiModel === m.id ? colors.primary + "20" : colors.surfaceElevated,
                      borderColor: aiModel === m.id ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.modelChipText,
                      { color: aiModel === m.id ? colors.primary : colors.foreground },
                    ]}
                    numberOfLines={1}
                  >
                    {m.name || m.id}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <Pressable onPress={() => setShowCustomModel(!showCustomModel)} style={styles.customModelToggle}>
            <Text style={[styles.customModelText, { color: colors.muted }]}>
              {showCustomModel ? "Hide custom model" : "Enter custom model ID"}
            </Text>
            <Feather name={showCustomModel ? "chevron-up" : "chevron-down"} size={14} color={colors.muted} />
          </Pressable>

          {showCustomModel && (
            <TextInput
              style={[
                styles.apiKeyInput,
                { color: colors.foreground, backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              ]}
              value={aiModel}
              onChangeText={(text) => {
                setAiModel(text);
                settingsStore.set("ai_model", text);
              }}
              placeholder="Model ID (e.g., gpt-4o)"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
            />
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.muted }]}>ABOUT</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: colors.foreground }]}>Version</Text>
            <Text style={[styles.aboutValue, { color: colors.muted }]}>1.0.0</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: colors.foreground }]}>Platform</Text>
            <Text style={[styles.aboutValue, { color: colors.muted }]}>
              {Platform.OS} ({Platform.Version || "web"})
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  screenTitle: { fontSize: 28, fontFamily: "Inter_700Bold" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
  sectionTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1, marginTop: 20, marginBottom: 8 },
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12, marginBottom: 8 },
  label: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  themeRow: { flexDirection: "row", gap: 10 },
  themeOption: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5 },
  themeLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  colorsRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  colorSwatch: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  apiKeyInput: { height: 44, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, fontSize: 14, fontFamily: "Inter_400Regular" },
  apiKeyHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
  modelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  modelsList: { flexDirection: "row", gap: 8 },
  modelChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  modelChipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  customModelToggle: { flexDirection: "row", alignItems: "center", gap: 4 },
  customModelText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  aboutRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  aboutLabel: { fontSize: 15, fontFamily: "Inter_400Regular" },
  aboutValue: { fontSize: 15, fontFamily: "Inter_400Regular" },
  divider: { height: StyleSheet.hairlineWidth },
});
