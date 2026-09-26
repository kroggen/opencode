import { describe, expect, test } from "bun:test"
import type { Renderable } from "@opentui/core"
import { createReadingAnchor, type ScrollAnchorBox } from "../../src/util/scroll-anchor"

type MockNode = {
  y: number
  height: number
  getChildren(): MockNode[]
}

function node(y: number, height: number, children: MockNode[] = []): MockNode {
  return { y, height, getChildren: () => children }
}

function mockBox(children: MockNode[], scrollTop: number, viewportHeight = 24): ScrollAnchorBox {
  const contentHeight = children.reduce((sum, child) => Math.max(sum, child.y + child.height), 0)
  return {
    content: {
      onSizeChange: undefined,
      getChildren: () => children,
      y: 0,
      height: contentHeight,
    },
    scrollTop,
    scrollHeight: contentHeight,
    height: viewportHeight,
    stickyScroll: true,
  } as unknown as ScrollAnchorBox
}

describe("util.scroll-anchor", () => {
  test("disables sticky follow while reading and re-enables at the bottom", () => {
    const children = [node(0, 100), node(100, 50)]
    const box = mockBox(children, 60)
    const anchor = createReadingAnchor(box)
    anchor.compensate()
    expect(box.stickyScroll).toBe(false)

    box.scrollTop = 126 // bottom: 150 - 24
    anchor.compensate()
    expect(box.stickyScroll).toBe(true)
  })

  test("compensates height growth of content above the viewport", () => {
    const a = node(0, 10)
    const b = node(10, 100)
    const c = node(110, 40)
    const box = mockBox([a, b, c], 60) // viewport top spans b (10..110)
    const anchor = createReadingAnchor(box)
    anchor.compensate()
    expect(box.scrollTop).toBe(60)

    // content above the viewport grows by 20: b and c shift down
    a.height = 30
    b.y = 30
    c.y = 130
    box.scrollHeight = 170
    anchor.compensate()

    expect(box.scrollTop).toBe(80) // 60 + 20: same content at the top edge
    expect(box.stickyScroll).toBe(false)
  })

  test("compensates shrinkage of content above the viewport", () => {
    const a = node(0, 30)
    const b = node(30, 100)
    const box = mockBox([a, b], 60)
    const anchor = createReadingAnchor(box)
    anchor.compensate()

    a.height = 10
    b.y = 10
    box.scrollHeight = 110
    anchor.compensate()

    expect(box.scrollTop).toBe(40) // 60 - 20
  })

  test("adopts user scroll instead of compensating over it", () => {
    const a = node(0, 10)
    const b = node(10, 100)
    const box = mockBox([a, b], 60)
    const anchor = createReadingAnchor(box)
    anchor.compensate()

    // user scrolls AND content above grows between polls
    box.scrollTop = 45
    a.height = 30
    b.y = 30
    box.scrollHeight = 170
    anchor.compensate()

    expect(box.scrollTop).toBe(45) // user position adopted
  })

  test("anchors on the deepest node spanning the viewport top", () => {
    const leaf = node(10, 100)
    const wrapper = node(10, 100, [leaf])
    const box = mockBox([wrapper], 60)
    const anchor = createReadingAnchor(box)
    anchor.compensate()

    // the wrapper shifts down from a sibling above; the leaf shifts with it
    wrapper.y = 30
    box.scrollHeight = 130
    anchor.compensate()

    expect(box.scrollTop).toBe(80) // anchored on the leaf: 60 + 20
  })

  test("clamps compensation to the scroll range", () => {
    const leaf = node(10, 100)
    const wrapper = node(10, 100, [leaf])
    const box = mockBox([wrapper], 60)
    const anchor = createReadingAnchor(box)
    anchor.compensate()

    wrapper.y = 30
    box.scrollHeight = 100 // max = 76: the drift would overshoot the range
    anchor.compensate()

    expect(box.scrollTop).toBe(76) // clamped: min(80, 100 - 24)
  })

  test("attach wires compensation into content onSizeChange and unwraps", () => {
    const a = node(0, 10)
    const b = node(10, 100)
    const box = mockBox([a, b], 60)
    const anchor = createReadingAnchor(box)
    const original = box.content.onSizeChange

    const detach = anchor.attach()
    expect(box.content.onSizeChange).not.toBe(original)

    // simulate the layout pipeline: original handler runs, then compensation
    box.content.onSizeChange?.()
    expect(box.scrollTop).toBe(60) // no drift: position untouched

    a.height = 30
    b.y = 30
    box.scrollHeight = 170
    box.content.onSizeChange?.()
    expect(box.scrollTop).toBe(80)

    detach()
    expect(box.content.onSizeChange).toBe(original)
  })
})
