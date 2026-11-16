"use client";

import { useEffect } from "react";
import {
  useEditor,
  EditorContent,
  useEditorState,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

type EditorProps = {
  content?: string;
  editable?: boolean;
  onChange?: (html: string) => void;
};

const DEFAULT_CONTENT =
  "<h1>Untitled Document</h1><p>Start writing here...</p>";

export default function Editor({
  content = DEFAULT_CONTENT,
  editable = true,
  onChange,
}: EditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        code: false,
        codeBlock: false,
      }),
    ],
    content,
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "min-h-[350px] outline-none",
        "aria-label": "Document content",
      },
    },
    onUpdate: ({ editor }) => {
      if (editor.isEditable) {
        onChange?.(editor.getHTML());
      }
    },
  });

  // Synchronize content when loading another document.
  useEffect(() => {
    if (!editor) return;

    if (editor.getHTML() !== content) {
      editor.commands.setContent(content, {
        emitUpdate: false,
      });
    }
  }, [editor, content]);

  // Enable or disable editing according to document permissions.
  useEffect(() => {
    if (!editor) return;

    editor.setEditable(editable);
  }, [editor, editable]);

  // Track formatting states for toolbar highlighting.
  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor?.isActive("bold") ?? false,
      italic: editor?.isActive("italic") ?? false,
      underline: editor?.isActive("underline") ?? false,
      h1: editor?.isActive("heading", { level: 1 }) ?? false,
      h2: editor?.isActive("heading", { level: 2 }) ?? false,
      bullets: editor?.isActive("bulletList") ?? false,
      numbers: editor?.isActive("orderedList") ?? false,
    }),
  });

  if (!editor) {
    return (
      <div className="rounded-lg border border-gray-300 bg-white p-6 text-gray-900">
        Loading editor...
      </div>
    );
  }

  const toolbar = [
    {
      label: "Bold",
      active: active?.bold,
      action: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: "Italic",
      active: active?.italic,
      action: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: "Underline",
      active: active?.underline,
      action: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      label: "H1",
      active: active?.h1,
      action: () =>
        editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      label: "H2",
      active: active?.h2,
      action: () =>
        editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: "Bullets",
      active: active?.bullets,
      action: () =>
        editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Numbers",
      active: active?.numbers,
      action: () =>
        editor.chain().focus().toggleOrderedList().run(),
    },
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-gray-300 bg-white text-gray-900 shadow-sm">
      {/* Formatting toolbar */}
      <div
        role="toolbar"
        aria-label="Text formatting"
        className="flex flex-wrap gap-2 border-b border-gray-200 bg-gray-50 p-3"
      >
        {toolbar.map((item) => (
          <button
            key={item.label}
            type="button"
            disabled={!editable}
            onClick={item.action}
            onMouseDown={(event) => event.preventDefault()}
            aria-pressed={Boolean(item.active)}
            className={`rounded border px-3 py-1.5 text-sm font-medium transition-colors ${
              !editable
                ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                : item.active
                  ? "border-blue-500 bg-blue-100 text-blue-800"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Document editing area */}
      <div className="min-h-[400px] p-6">
        <EditorContent
          editor={editor}
          className={`
            [&_.tiptap]:min-h-[350px]
            [&_.tiptap]:outline-none
            [&_h1]:mb-4
            [&_h1]:text-3xl
            [&_h1]:font-bold
            [&_h2]:mb-3
            [&_h2]:text-2xl
            [&_h2]:font-semibold
            [&_p]:my-2
            [&_strong]:font-bold
            [&_em]:italic
            [&_u]:underline
            [&_ul]:my-2
            [&_ul]:list-disc
            [&_ul]:pl-6
            [&_ol]:my-2
            [&_ol]:list-decimal
            [&_ol]:pl-6
            [&_li]:my-1
            ${
              !editable
                ? "[&_.tiptap]:cursor-default"
                : ""
            }
          `}
        />
      </div>

      {/* Read-only indicator */}
      {!editable && (
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-500">
          View-only access — editing is disabled.
        </div>
      )}
    </div>
  );
}