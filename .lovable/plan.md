

## Render markdown in CFO Chat messages

**Problem**: The CFO Digital chat widget displays AI responses as plain text with `whitespace-pre-wrap`. Markdown tables, bold, lists, etc. render as raw characters.

**Solution**: Install `react-markdown` + `remark-gfm` (for table support) and create a small wrapper component to render assistant messages as formatted HTML.

### Steps

1. **Install dependencies**: `react-markdown` and `remark-gfm`

2. **Create `src/components/cfo/MarkdownMessage.tsx`**
   - A small component that wraps `<ReactMarkdown remarkPlugins={[remarkGfm]}>` with Tailwind prose-like styling for tables, bold, lists, code blocks
   - Table styling: borders, padding, alternating rows — matching the app's design tokens

3. **Update `CFOChatWidget.tsx`**
   - Replace the plain `<div className="whitespace-pre-wrap">{msg.content}</div>` (line 146) with `<MarkdownMessage content={msg.content} />` for assistant messages
   - Keep user messages as plain text

4. **Update `CFODashboard.tsx`**
   - Same treatment for the "Dica do CFO" tip text (line 151) so any formatted response renders correctly there too

### Technical details

- `remark-gfm` plugin enables GitHub-Flavored Markdown: tables, strikethrough, task lists
- Custom component overrides for `table`, `th`, `td`, `tr` to use the app's existing table styling (border-border, bg-accent, etc.)
- Scoped styles so markdown rendering doesn't leak outside chat bubbles

