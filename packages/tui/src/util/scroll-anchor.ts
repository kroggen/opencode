// Minimal structural view of a renderable and a ScrollBox-like container.
// Declared structurally so tests can drive them with mocks.
export interface AnchorNode {
  onSizeChange?: () => void
  getChildren(): AnchorNode[]
  y: number
  height: number
}

export interface ScrollAnchorBox {
  content: AnchorNode
  scrollTop: number
  scrollHeight: number
  height: number
  stickyScroll: boolean
}

type Anchor = { node: AnchorNode; nodeY: number; scrollTop: number }

// Keeps the reading position stable while the user is scrolled away from the
// bottom of a scroll box:
//
// 1. Sticky follow is disabled while away from the bottom, so streamed content
//    cannot scroll the view, and re-enabled at the bottom.
// 2. The reading position is anchored to the deepest renderable spanning the
//    viewport's top edge. When async re-renders (thinking blocks growing,
//    markdown highlight/link passes, collapsing sections) change the height of
//    content above it, the drift is compensated so the same content stays
//    under the reader's eyes. scrollTop alone is not enough: a reflow shifts
//    content even when scrollTop never changes.
//
// compensate() should run whenever the content layout changes - ideally by
// wrapping the content box's onSizeChange (attach()) so it happens in the same
// tick, before the frame paints.
export function createReadingAnchor(box: ScrollAnchorBox) {
  let anchor: Anchor | undefined

  function topSpanningNode(): { node: AnchorNode; nodeY: number } | undefined {
    const top = box.scrollTop
    let node: AnchorNode = box.content
    let nodeY = 0
    for (let depth = 0; depth < 12; depth++) {
      const kids: AnchorNode[] = node.getChildren().slice().sort((a, b) => a.y - b.y)
      let next: AnchorNode | undefined
      for (const kid of kids) {
        const absY = nodeY + kid.y
        if (absY <= top && absY + kid.height > top) {
          next = kid
          nodeY = absY
          break
        }
      }
      if (!next) {
        for (const kid of kids) {
          const absY = nodeY + kid.y
          if (absY > top) {
            next = kid
            nodeY = absY
            break
          }
        }
      }
      if (!next) return { node, nodeY }
      node = next
    }
    return { node, nodeY }
  }

  function compensate(): void {
    const max = box.scrollHeight - box.height
    const atBottom = box.scrollTop >= max - 1
    box.stickyScroll = atBottom
    if (atBottom) {
      anchor = undefined
      return
    }
    const span = topSpanningNode()
    if (!span) {
      anchor = undefined
      return
    }
    if (anchor && anchor.node === span.node) {
      const drift = span.nodeY - anchor.nodeY
      if (box.scrollTop !== anchor.scrollTop) {
        // the user scrolled since the last anchor; adopt their position
        anchor = { node: span.node, nodeY: span.nodeY, scrollTop: box.scrollTop }
        return
      }
      if (drift !== 0) {
        const compensated = Math.min(Math.max(anchor.scrollTop + drift, 0), max)
        box.scrollTop = compensated
        anchor = { node: span.node, nodeY: span.nodeY, scrollTop: compensated }
        return
      }
    }
    anchor = { node: span.node, nodeY: span.nodeY, scrollTop: box.scrollTop }
  }

  // Wrap the content box's onSizeChange so the anchor is compensated in the
  // same tick as the layout change, before the frame paints. Returns unwrapper.
  function attach(): () => void {
    const content = box.content
    const previous = content.onSizeChange
    content.onSizeChange = () => {
      previous?.call(content)
      compensate()
    }
    return () => {
      content.onSizeChange = previous
    }
  }

  return { compensate, attach }
}
