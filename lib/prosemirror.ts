import { Schema, DOMParser as PmDOMParser, DOMSerializer, type Node as PmNode } from "prosemirror-model"
import { EditorState, Plugin, type Transaction } from "prosemirror-state"
import { EditorView } from "prosemirror-view"
import { history, undo, redo } from "prosemirror-history"
import { keymap } from "prosemirror-keymap"
import { baseKeymap, toggleMark } from "prosemirror-commands"
import { inputRules, wrappingInputRule, textblockTypeInputRule, InputRule } from "prosemirror-inputrules"

// ── Schema ──────────────────────────────────────────────────────────────

export const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: {
      content: "inline*",
      group: "block",
      parseDOM: [{ tag: "p" }, { tag: "div", priority: 20 }],
      toDOM() { return ["p", 0] },
    },
    heading: {
      attrs: { level: { default: 2 } },
      content: "inline*",
      group: "block",
      defining: true,
      parseDOM: [
        { tag: "h1", attrs: { level: 1 } },
        { tag: "h2", attrs: { level: 2 } },
        { tag: "h3", attrs: { level: 3 } },
      ],
      toDOM(node) { return [`h${node.attrs.level}`, 0] },
    },
    blockquote: {
      content: "block+",
      group: "block",
      defining: true,
      parseDOM: [{ tag: "blockquote" }],
      toDOM() { return ["blockquote", 0] },
    },
    bullet_list: {
      content: "list_item+",
      group: "block",
      parseDOM: [{ tag: "ul" }],
      toDOM() { return ["ul", 0] },
    },
    ordered_list: {
      content: "list_item+",
      group: "block",
      attrs: { order: { default: 1 } },
      parseDOM: [{
        tag: "ol",
        getAttrs(dom) {
          return { order: (dom as HTMLElement).hasAttribute("start") ? +(dom as HTMLElement).getAttribute("start")! : 1 }
        },
      }],
      toDOM(node) {
        return node.attrs.order === 1 ? ["ol", 0] : ["ol", { start: node.attrs.order }, 0]
      },
    },
    list_item: {
      content: "paragraph block*",
      parseDOM: [{ tag: "li" }],
      toDOM() { return ["li", 0] },
      defining: true,
    },
    horizontal_rule: {
      group: "block",
      parseDOM: [{ tag: "hr" }],
      toDOM() { return ["hr"] },
    },
    hard_break: {
      inline: true,
      group: "inline",
      selectable: false,
      parseDOM: [{ tag: "br" }],
      toDOM() { return ["br"] },
    },
    image: {
      inline: true,
      group: "inline",
      draggable: true,
      attrs: {
        src: {},
        width: { default: null },
        alt: { default: null },
      },
      parseDOM: [{
        tag: "img[src]",
        getAttrs(dom) {
          const el = dom as HTMLImageElement
          return {
            src: el.getAttribute("src"),
            width: el.style.width || el.getAttribute("width") || null,
            alt: el.getAttribute("alt"),
          }
        },
      }],
      toDOM(node) {
        const { src, width, alt } = node.attrs
        const attrs: Record<string, string> = { src }
        if (alt) attrs.alt = alt
        if (width) attrs.style = `width: ${width}`
        return ["img", attrs]
      },
    },
    text: { group: "inline" },
  },
  marks: {
    bold: {
      parseDOM: [
        { tag: "strong" },
        { tag: "b", getAttrs: (node) => (node as HTMLElement).style.fontWeight !== "normal" && null },
        { style: "font-weight=bold" },
        { style: "font-weight", getAttrs: (value) => /^(bold(er)?|[5-9]\d{2,})$/.test(value as string) && null },
      ],
      toDOM() { return ["strong", 0] },
    },
    italic: {
      parseDOM: [
        { tag: "i" }, { tag: "em" },
        { style: "font-style=italic" },
      ],
      toDOM() { return ["em", 0] },
    },
    underline: {
      parseDOM: [
        { tag: "u" },
        { style: "text-decoration=underline" },
        { style: "text-decoration", getAttrs: (value) => (value as string).includes("underline") && null },
      ],
      toDOM() { return ["u", 0] },
    },
    link: {
      attrs: {
        href: {},
        target: { default: "_blank" },
        rel: { default: "noopener noreferrer" },
      },
      inclusive: false,
      parseDOM: [{
        tag: "a[href]",
        getAttrs(dom) {
          return {
            href: (dom as HTMLElement).getAttribute("href"),
            target: (dom as HTMLElement).getAttribute("target") || "_blank",
            rel: (dom as HTMLElement).getAttribute("rel") || "noopener noreferrer",
          }
        },
      }],
      toDOM(node) { return ["a", { href: node.attrs.href, target: node.attrs.target, rel: node.attrs.rel }, 0] },
    },
    highlight: {
      parseDOM: [
        { tag: "mark" },
        { class: "text-highlight" },
        { style: "background-color", getAttrs: (value) => {
          const v = value as string
          return (v && v !== "transparent" && v !== "rgba(0, 0, 0, 0)") ? {} : false
        }},
      ],
      toDOM() { return ["mark", 0] },
    },
  },
})

// ── Input rules ─────────────────────────────────────────────────────────

function headingRule(level: number) {
  return textblockTypeInputRule(
    new RegExp(`^(#{${level}})\\s$`),
    schema.nodes.heading,
    () => ({ level }),
  )
}

const honestInputRules = inputRules({
  rules: [
    headingRule(1),
    headingRule(2),
    headingRule(3),
    wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote),
    wrappingInputRule(/^\s*[-+*]\s$/, schema.nodes.bullet_list),
    wrappingInputRule(
      /^\s*(\d+)\.\s$/,
      schema.nodes.ordered_list,
      (match) => ({ order: +match[1] }),
      (match, node) => node.childCount + node.attrs.order === +match[1],
    ),
    new InputRule(/---$/, (state, _match, start, end) => {
      return state.tr.replaceWith(start, end, schema.nodes.horizontal_rule.create())
    }),
  ],
})

// ── Plugins ─────────────────────────────────────────────────────────────

export function createPlugins(onContentChange?: () => void) {
  return [
    honestInputRules,
    keymap({
      "Mod-z": undo,
      "Mod-Shift-z": redo,
      "Mod-y": redo,
      "Mod-b": toggleMark(schema.marks.bold),
      "Mod-i": toggleMark(schema.marks.italic),
      "Mod-u": toggleMark(schema.marks.underline),
    }),
    keymap(baseKeymap),
    history(),
    ...(onContentChange ? [new Plugin({
      view() {
        return {
          update(view, prevState) {
            if (!view.state.doc.eq(prevState.doc)) onContentChange()
          },
        }
      },
    })] : []),
  ]
}

// ── State helpers ───────────────────────────────────────────────────────

export function createEditorState(content: string | Record<string, unknown> | null, onChange?: () => void): EditorState {
  let doc: PmNode

  if (!content || content === "" || content === "<br>") {
    doc = schema.node("doc", null, [schema.node("paragraph")])
  } else if (typeof content === "object") {
    // JSON document
    doc = schema.nodeFromJSON(content)
  } else if (typeof content === "string") {
    // Try JSON first, fall back to HTML
    const trimmed = content.trim()
    if (trimmed.startsWith("{")) {
      try {
        doc = schema.nodeFromJSON(JSON.parse(trimmed))
      } catch {
        doc = parseHTML(trimmed)
      }
    } else {
      doc = parseHTML(trimmed)
    }
  } else {
    doc = schema.node("doc", null, [schema.node("paragraph")])
  }

  return EditorState.create({
    doc,
    plugins: createPlugins(onChange),
  })
}

function parseHTML(html: string): PmNode {
  const div = document.createElement("div")
  div.innerHTML = html
  // Normalize old highlight spans to <mark>
  div.querySelectorAll(".text-highlight").forEach((el) => {
    const mark = document.createElement("mark")
    mark.innerHTML = el.innerHTML
    el.replaceWith(mark)
  })
  // Normalize image wrappers: extract the <img> from .img-wrapper spans
  div.querySelectorAll(".img-wrapper").forEach((wrapper) => {
    const img = wrapper.querySelector("img")
    if (img) wrapper.replaceWith(img)
  })
  return PmDOMParser.fromSchema(schema).parse(div)
}

export function serializeToJSON(state: EditorState): string {
  return JSON.stringify(state.doc.toJSON())
}

export function serializeToHTML(state: EditorState): string {
  const fragment = DOMSerializer.fromSchema(schema).serializeFragment(state.doc.content)
  const div = document.createElement("div")
  div.appendChild(fragment)
  return div.innerHTML
}

// ── Mark helpers for sidebar ────────────────────────────────────────────

export function isMarkActive(state: EditorState, markType: ReturnType<typeof schema.marks.bold.create>["type"]): boolean {
  const { from, $from, to, empty } = state.selection
  if (empty) return !!markType.isInSet(state.storedMarks || $from.marks())
  return state.doc.rangeHasMark(from, to, markType)
}

export function toggleMarkCommand(view: EditorView, markType: ReturnType<typeof schema.marks.bold.create>["type"]) {
  toggleMark(markType)(view.state, view.dispatch, view)
  view.focus()
}

export function toggleHighlight(view: EditorView) {
  const type = schema.marks.highlight
  if (isMarkActive(view.state, type)) {
    toggleMark(type)(view.state, view.dispatch, view)
  } else {
    toggleMark(type)(view.state, view.dispatch, view)
  }
  view.focus()
}

export function applyLink(view: EditorView, href: string) {
  const { from, to, empty } = view.state.selection
  if (empty) return
  const url = /^https?:\/\//i.test(href) ? href : `https://${href}`
  const mark = schema.marks.link.create({ href: url, target: "_blank", rel: "noopener noreferrer" })
  view.dispatch(view.state.tr.addMark(from, to, mark))
  view.focus()
}

export function removeLink(view: EditorView) {
  const { from, to } = view.state.selection
  view.dispatch(view.state.tr.removeMark(from, to, schema.marks.link))
  view.focus()
}

export function insertImage(view: EditorView, src: string) {
  const node = schema.nodes.image.create({ src, width: "400px" })
  const { from } = view.state.selection
  view.dispatch(view.state.tr.insert(from, node))
  view.focus()
}

// ── Image NodeView (resizable) ───────────────────────────────────────────

export class ImageNodeView {
  dom: HTMLElement
  private img: HTMLImageElement
  private handles: HTMLElement[] = []
  private selected = false

  constructor(
    private node: PmNode,
    private view: EditorView,
    private getPos: () => number | undefined,
  ) {
    // Outer wrapper
    const wrapper = document.createElement("span")
    wrapper.className = "img-wrapper"
    wrapper.setAttribute("contenteditable", "false")

    // Image
    const img = document.createElement("img")
    img.src = node.attrs.src
    img.style.width = node.attrs.width ?? "400px"
    img.draggable = false
    wrapper.appendChild(img)
    this.img = img

    // Resize handles (corners only)
    for (const pos of ["nw", "ne", "se", "sw"]) {
      const handle = document.createElement("span")
      handle.className = `img-handle img-handle-${pos}`
      handle.dataset.handle = pos
      handle.addEventListener("mousedown", (e) => this.onHandleMouseDown(e, pos))
      wrapper.appendChild(handle)
      this.handles.push(handle)
    }

    this.dom = wrapper
  }

  private onHandleMouseDown(e: MouseEvent, handlePos: string) {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startWidth = this.img.offsetWidth

    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - startX
      const isLeft = handlePos.includes("w")
      const newWidth = Math.max(80, isLeft ? startWidth - dx : startWidth + dx)
      this.img.style.width = `${newWidth}px`
    }

    const onUp = () => {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
      // Persist the new width into the node attrs
      const pos = this.getPos()
      if (pos === undefined) return
      const width = this.img.style.width
      this.view.dispatch(
        this.view.state.tr.setNodeMarkup(pos, undefined, {
          ...this.node.attrs,
          width,
        })
      )
    }

    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }

  selectNode() {
    this.selected = true
    this.dom.classList.add("img-selected")
  }

  deselectNode() {
    this.selected = false
    this.dom.classList.remove("img-selected")
  }

  update(node: PmNode) {
    if (node.type !== this.node.type) return false
    this.node = node
    this.img.src = node.attrs.src
    if (node.attrs.width) this.img.style.width = node.attrs.width
    return true
  }

  stopEvent(event: Event) {
    // Allow mousedown on handles through
    return (event.target as HTMLElement).classList.contains("img-handle")
  }

  ignoreMutation() {
    return true
  }

  destroy() {
    this.handles.forEach((h) => h.replaceWith(h.cloneNode(true)))
  }
}

export function getLinkAtSelection(state: EditorState): { href: string; from: number; to: number } | null {
  const { from, to } = state.selection
  let found: { href: string; from: number; to: number } | null = null
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (found) return false
    const linkMark = node.marks.find((m) => m.type === schema.marks.link)
    if (linkMark) {
      found = { href: linkMark.attrs.href, from: pos, to: pos + node.nodeSize }
    }
  })
  return found
}
