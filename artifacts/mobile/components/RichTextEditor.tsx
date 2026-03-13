import React, { useRef, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from "react";
import { View, StyleSheet, Platform } from "react-native";

export type RichTextEditorRef = {
  setContent: (html: string) => void;
  sendCommand: (command: string) => void;
  insertText: (text: string) => void;
};

type Props = {
  editorHtml: string;
  backgroundColor: string;
  onReady: () => void;
  onContentChange: (html: string, text: string) => void;
};

const RichTextEditorWeb = forwardRef<RichTextEditorRef, Props>(
  ({ editorHtml, backgroundColor, onReady, onContentChange }, ref) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const postMessage = useCallback((msg: object) => {
      iframeRef.current?.contentWindow?.postMessage(JSON.stringify(msg), "*");
    }, []);

    useImperativeHandle(ref, () => ({
      setContent: (html: string) => postMessage({ type: "set-content", html }),
      sendCommand: (command: string) => postMessage({ type: "command", command }),
      insertText: (text: string) => postMessage({ type: "insert-text", text }),
    }), [postMessage]);

    useEffect(() => {
      const handler = (e: MessageEvent) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "ready") onReady();
          else if (msg.type === "content-change") onContentChange(msg.html, msg.text);
        } catch {}
      };
      window.addEventListener("message", handler);
      return () => window.removeEventListener("message", handler);
    }, [onReady, onContentChange]);

    return (
      <View style={styles.container}>
        <iframe
          ref={iframeRef as any}
          srcDoc={editorHtml}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            backgroundColor,
          }}
        />
      </View>
    );
  }
);

const RichTextEditorNative = forwardRef<RichTextEditorRef, Props>(
  ({ editorHtml, backgroundColor, onReady, onContentChange }, ref) => {
    const { WebView } = require("react-native-webview");
    const webViewRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      setContent: (html: string) =>
        webViewRef.current?.postMessage(JSON.stringify({ type: "set-content", html })),
      sendCommand: (command: string) =>
        webViewRef.current?.postMessage(JSON.stringify({ type: "command", command })),
      insertText: (text: string) =>
        webViewRef.current?.postMessage(JSON.stringify({ type: "insert-text", text })),
    }), []);

    const handleMessage = useCallback(
      (event: { nativeEvent: { data: string } }) => {
        try {
          const msg = JSON.parse(event.nativeEvent.data);
          if (msg.type === "ready") onReady();
          else if (msg.type === "content-change") onContentChange(msg.html, msg.text);
        } catch {}
      },
      [onReady, onContentChange]
    );

    const htmlWithRNBridge = useMemo(() => {
      return editorHtml.replace(
        "window.ReactNativeWebView && window.ReactNativeWebView.postMessage",
        "window.ReactNativeWebView.postMessage"
      );
    }, [editorHtml]);

    return (
      <WebView
        ref={webViewRef}
        source={{ html: htmlWithRNBridge }}
        style={[styles.container, { backgroundColor }]}
        onMessage={handleMessage}
        scrollEnabled
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={["*"]}
        keyboardDisplayRequiresUserAction={false}
        hideKeyboardAccessoryView
        showsVerticalScrollIndicator={false}
      />
    );
  }
);

export const RichTextEditor = forwardRef<RichTextEditorRef, Props>(
  (props, ref) => {
    if (Platform.OS === "web") {
      return <RichTextEditorWeb ref={ref} {...props} />;
    }
    return <RichTextEditorNative ref={ref} {...props} />;
  }
);

const styles = StyleSheet.create({
  container: { flex: 1 },
});
