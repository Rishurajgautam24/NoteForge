import { Node, mergeAttributes } from "@tiptap/core";

export interface MermaidOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mermaid: {
      setMermaid: (chart: string) => ReturnType;
    };
  }
}

export const Mermaid = Node.create<MermaidOptions>({
  name: "mermaid",

  group: "block",

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      chart: {
        default: "graph TD\n    A --> B",
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-chart") || "",
        renderHTML: (attrs) => ({ "data-chart": attrs.chart }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-chart]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-chart": node.attrs.chart,
        class: "mermaid-node",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setMermaid:
        (chart: string) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { chart },
          }),
    };
  },
});
