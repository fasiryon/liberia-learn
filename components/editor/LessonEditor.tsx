"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";

interface LessonEditorProps {
  initialContent?: string;
  onChange: (html: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}

export function LessonEditor({
  initialContent,
  onChange,
  readOnly = false,
  placeholder = "Start writing your lesson...",
}: LessonEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder }),
      CharacterCount,
    ],
    content: initialContent ?? "",
    editable: !readOnly,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  const charCount = editor.storage.characterCount?.characters() ?? 0;

  const btn =
    "rounded px-2 py-1 text-xs hover:bg-[var(--ll-border)] disabled:opacity-40 transition-colors";
  const active = "bg-[var(--ll-border)] font-semibold";

  function setLink() {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", prev ?? "https://");
    if (url === null) return;
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div className="flex flex-col rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]">
      {!readOnly && (
        <div className="flex flex-wrap gap-1 border-b border-[var(--ll-border)] p-2">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`${btn} ${editor.isActive("bold") ? active : ""}`}
          >
            B
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`${btn} italic ${editor.isActive("italic") ? active : ""}`}
          >
            I
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`${btn} underline ${editor.isActive("underline") ? active : ""}`}
          >
            U
          </button>
          <span className="mx-1 border-r border-[var(--ll-border)]" />
          {([1, 2, 3] as const).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() =>
                editor.chain().focus().toggleHeading({ level }).run()
              }
              className={`${btn} ${editor.isActive("heading", { level }) ? active : ""}`}
            >
              H{level}
            </button>
          ))}
          <span className="mx-1 border-r border-[var(--ll-border)]" />
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`${btn} ${editor.isActive("bulletList") ? active : ""}`}
          >
            •—
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`${btn} ${editor.isActive("orderedList") ? active : ""}`}
          >
            1—
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`${btn} ${editor.isActive("blockquote") ? active : ""}`}
          >
            ❝
          </button>
          <span className="mx-1 border-r border-[var(--ll-border)]" />
          {(["left", "center", "right"] as const).map((align) => (
            <button
              key={align}
              type="button"
              onClick={() =>
                editor.chain().focus().setTextAlign(align).run()
              }
              className={`${btn} ${editor.isActive({ textAlign: align }) ? active : ""}`}
            >
              {align === "left" ? "⇤" : align === "center" ? "⇔" : "⇥"}
            </button>
          ))}
          <span className="mx-1 border-r border-[var(--ll-border)]" />
          <button
            type="button"
            onClick={setLink}
            className={`${btn} ${editor.isActive("link") ? active : ""}`}
          >
            Link
          </button>
          <span className="mx-1 border-r border-[var(--ll-border)]" />
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className={btn}
          >
            ↩
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className={btn}
          >
            ↪
          </button>
        </div>
      )}

      <div className="relative">
        <EditorContent
          editor={editor}
          className="prose prose-invert max-w-none px-4 py-3 text-sm text-[var(--ll-text)] [&_.ProseMirror]:min-h-[400px] [&_.ProseMirror]:outline-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-[var(--ll-text-muted)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0"
        />
        <span className="absolute bottom-2 right-3 text-xs text-[var(--ll-text-muted)]">
          {charCount} chars
        </span>
      </div>
    </div>
  );
}
