import { useDialog } from "../ui/dialog"
import { DialogSelect } from "../ui/dialog-select"
import { createMemo } from "solid-js"

function getRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  const date = new Date(timestamp)
  return date.toISOString().slice(0, 10)
}

export interface RewindEntry {
  id: string
  time?: { created?: number }
  parts: { type: string; synthetic?: boolean; text?: string }[]
}

export function DialogRewind(props: { messages: RewindEntry[]; onSelect: (messageID: string) => void }) {
  const dialog = useDialog()

  const options = createMemo(() =>
    props.messages
      .map((message) => {
        const text = message.parts
          .filter((part) => part.type === "text" && !part.synthetic && part.text)
          .map((part) => part.text ?? "")
          .join("\n\n")
        return { message, text }
      })
      .filter((item) => item.text.trim())
      .toReversed()
      .map((item) => ({
        title: item.text.split("\n")[0].trim().slice(0, 60) || "(message)",
        description: item.message.time?.created ? getRelativeTime(item.message.time.created) : undefined,
        value: item.message.id,
      })),
  )

  return (
    <DialogSelect
      title="Rewind to message"
      options={options()}
      onSelect={(option) => {
        props.onSelect(option.value)
        dialog.clear()
      }}
    />
  )
}
