import { useDialog } from "../ui/dialog"
import { DialogSelect } from "../ui/dialog-select"
import { createMemo } from "solid-js"
import { useCommandShortcut } from "../keymap"

function getRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)

  if (seconds < 60) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(timestamp).toISOString().slice(0, 10)
}

export interface QueueEntry {
  id: number
  text: string
  time: number
}

export function DialogQueue(props: {
  items: QueueEntry[]
  onEdit: (id: number) => void
  onRemove: (id: number) => void
}) {
  const dialog = useDialog()
  const removeShortcut = useCommandShortcut("prompt.queue.remove")

  const options = createMemo(() =>
    props.items
      .map((item, index) => ({
        title: item.text.split("\n")[0].trim().slice(0, 60) || "(message)",
        description: `${index === 0 ? "next" : `#${index + 1}`} · ${getRelativeTime(item.time)}`,
        value: item.id,
      }))
      .toReversed(),
  )

  return (
    <DialogSelect
      title="Queued messages"
      options={options()}
      onSelect={(option) => {
        props.onEdit(option.value)
        dialog.clear()
      }}
      actions={[
        {
          command: "prompt.queue.remove",
          title: "remove",
          onTrigger: (option) => {
            props.onRemove(option.value)
          },
        },
      ]}
    />
  )
}
