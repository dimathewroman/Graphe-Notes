import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import {
  RichText,
  Toolbar,
  useEditorBridge,
  useEditorContent,
  TenTapStartKit,
  CoreBridge,
  UnderlineBridge,
  TaskListBridge,
  LinkBridge,
  ColorBridge,
  HighlightBridge,
  PlaceholderBridge,
  ImageBridge,
  darkEditorTheme,
  darkEditorCss,
} from "@10play/tentap-editor";

export type TentapEditorRef = {
  getHTML: () => Promise<string>;
  getText: () => Promise<string>;
  setContent: (html: string) => void;
  insertText: (text: string) => void;
  focus: () => void;
};

type Props = {
  initialContent?: string;
  isDark?: boolean;
  editable?: boolean;
  onChange?: (html: string) => void;
  editorRef?: React.MutableRefObject<TentapEditorRef | null>;
};

export function TentapEditor({
  initialContent,
  isDark,
  editable = true,
  onChange,
  editorRef,
}: Props) {
  const editor = useEditorBridge({
    bridgeExtensions: [
      ...TenTapStartKit,
      UnderlineBridge,
      TaskListBridge,
      LinkBridge,
      ColorBridge,
      HighlightBridge,
      PlaceholderBridge.configureExtension({ placeholder: "Start writing..." }),
      ImageBridge,
    ],
    initialContent: initialContent || "",
    autofocus: false,
    editable,
    avoidIosKeyboard: true,
    onChange: () => {
      if (onChange && editor) {
        editor.getHTML().then((html: string) => onChange(html));
      }
    },
    theme: isDark ? darkEditorTheme : undefined,
  });

  React.useEffect(() => {
    if (editorRef) {
      editorRef.current = {
        getHTML: () => editor.getHTML(),
        getText: () => editor.getText(),
        setContent: (html: string) => editor.setContent(html),
        insertText: async (text: string) => {
          const current = await editor.getHTML();
          editor.setContent(current + text);
        },
        focus: () => editor.focus("end"),
      };
    }
  }, [editor, editorRef]);

  return (
    <View style={styles.container}>
      <View style={styles.editorWrap}>
        <RichText editor={editor} />
      </View>
      <Toolbar editor={editor} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  editorWrap: {
    flex: 1,
  },
});
