import { Copy, GripVertical, Link2, Trash2 } from "lucide-react";
import { useState } from "react";
import { EmptyState, Input, Menu, Toggle, Tooltip } from "./ui";
import type { CreatorLink } from "../lib/types";

export type LinkListEditorProps = {
  links: CreatorLink[];
  onChange: (linkId: string, changes: Partial<CreatorLink>) => void;
  onCommit: (link: CreatorLink) => void;
  onReorder: (links: CreatorLink[]) => void;
  onDuplicate: (link: CreatorLink) => void;
  onDelete: (link: CreatorLink) => void;
};

function reorder(links: CreatorLink[], from: number, to: number) {
  const next = [...links];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next.map((link, position) => ({ ...link, position }));
}

/**
 * Reordering works by pointer drag and by keyboard. The arrow-button pair this
 * replaces was keyboard-only in practice and cost two controls per row; the
 * grip is a real button, so arrow keys move the focused link and focus follows
 * it, and the result is announced for screen readers.
 */
export function LinkListEditor({
  links,
  onChange,
  onCommit,
  onReorder,
  onDuplicate,
  onDelete,
}: LinkListEditorProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= links.length) return;

    const next = reorder(links, index, target);
    onReorder(next);
    setAnnouncement(`${links[index].title} moved to position ${target + 1} of ${links.length}.`);
  };

  if (links.length === 0) {
    return (
      <EmptyState
        description="Add your first link above. It shows on your public page straight away."
        icon={<Link2 size={22} />}
        title="No links yet"
      />
    );
  }

  return (
    <>
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>

      <ul className="grid gap-2.5">
        {links.map((link, index) => (
          <li
            className={`panel p-3 transition-opacity duration-fast ${
              draggingId === link.id ? "opacity-50" : ""
            }`}
            key={link.id}
            onDragEnd={() => setDraggingId(null)}
            onDragOver={(event) => {
              event.preventDefault();
              if (!draggingId || draggingId === link.id) return;

              const from = links.findIndex((item) => item.id === draggingId);
              if (from !== -1 && from !== index) onReorder(reorder(links, from, index));
            }}
          >
            <div className="flex items-start gap-2">
              <Tooltip content="Drag, or use the arrow keys, to reorder">
                <button
                  aria-label={`Reorder ${link.title}. Position ${index + 1} of ${links.length}.`}
                  className="mt-1.5 cursor-grab rounded p-1 text-content-subtle hover:text-content active:cursor-grabbing"
                  draggable
                  onDragStart={() => setDraggingId(link.id)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      move(index, -1);
                    }
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      move(index, 1);
                    }
                  }}
                  type="button"
                >
                  <GripVertical size={16} />
                </button>
              </Tooltip>

              <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[1fr_1.4fr]">
                <Input
                  aria-label={`Title for ${link.title}`}
                  maxLength={80}
                  onBlur={() => onCommit(link)}
                  onChange={(event) => onChange(link.id, { title: event.target.value })}
                  value={link.title}
                />
                <Input
                  aria-label={`URL for ${link.title}`}
                  onBlur={() => onCommit(link)}
                  onChange={(event) => onChange(link.id, { url: event.target.value })}
                  value={link.url}
                />
              </div>

              <Menu
                className="mt-1"
                items={[
                  {
                    label: "Duplicate",
                    icon: <Copy size={16} />,
                    onSelect: () => onDuplicate(link),
                  },
                  {
                    label: "Delete",
                    icon: <Trash2 size={16} />,
                    destructive: true,
                    onSelect: () => onDelete(link),
                  },
                ]}
                trigger={(triggerProps) => (
                  <button
                    {...triggerProps}
                    aria-label={`Actions for ${link.title}`}
                    className="icon-button h-9 w-9"
                    type="button"
                  >
                    <span aria-hidden="true" className="text-lg leading-none">···</span>
                  </button>
                )}
              />
            </div>

            <div className="mt-2.5 border-t border-line pt-2.5">
              <Toggle
                checked={link.isActive}
                label={link.isActive ? "Visible on your page" : "Hidden"}
                onChange={(checked) => {
                  onChange(link.id, { isActive: checked });
                  onCommit({ ...link, isActive: checked });
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
