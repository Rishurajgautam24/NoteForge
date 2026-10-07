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
  onScroll?: () => void;
  registerScroller?: (el: HTMLElement | null) => void;
}

export default function EditorPane({
  content,
  onChange,
  onScroll,
  registerScroller,
}: EditorPaneProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onScrollRef = useRef(onScroll);
  const lastContent = useRef<string | null>(null);
  const skipUpdate = useRef(false);

  onChangeRef.current = onChange;
  onScrollRef.current = onScroll;

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
            const doc = update.state.doc.toString();
            // Record our own edit so the round-tripped `content` prop is
            // recognised as self-originated and the sync effect below skips
            // it. Without this the effect replaces the whole document on every
            // keystroke, resetting the scroll position to the top.
            lastContent.current = doc;
            onChangeRef.current(doc);
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

    // Expose CodeMirror's own scroll container to the scroll-sync controller.
    const scroller = view.current.scrollDOM;
    const scrollHandler = () => onScrollRef.current?.();
    registerScroller?.(scroller);
    scroller.addEventListener("scroll", scrollHandler, { passive: true });

    return () => {
      scroller.removeEventListener("scroll", scrollHandler);
      registerScroller?.(null);
      view.current?.destroy();
      view.current = null;
    };
  }, [content, registerScroller]);

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
