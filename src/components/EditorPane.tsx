import { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorState } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";

interface EditorPaneProps {
  content: string;
  onChange: (content: string) => void;
}

export default function EditorPane({ content, onChange }: EditorPaneProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const lastContent = useRef<string | null>(null);
  const skipUpdate = useRef(false);

  onChangeRef.current = onChange;

  useEffect(() => {
    if (!editorRef.current) return;

    const startState = EditorState.create({
      doc: content,
      extensions: [
        basicSetup,
        markdown({ base: markdownLanguage }),
        oneDark,
        keymap.of([indentWithTab]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            if (skipUpdate.current) {
              skipUpdate.current = false;
              return;
            }
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.lineWrapping,
      ],
    });

    view.current = new EditorView({
      state: startState,
      parent: editorRef.current,
    });

    lastContent.current = content;

    return () => {
      view.current?.destroy();
      view.current = null;
    };
  }, []);

  useEffect(() => {
    if (!view.current) return;
    if (lastContent.current === null || content !== lastContent.current) {
      lastContent.current = content;
      skipUpdate.current = true;
      const sel = view.current.state.selection.main.head;
      view.current.dispatch({
        changes: {
          from: 0,
          to: view.current.state.doc.length,
          insert: content,
        },
        selection: { anchor: Math.min(sel, content.length) },
      });
    }
  }, [content]);

  return <div className="editor-pane" ref={editorRef} />;
}
