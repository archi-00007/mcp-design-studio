/** JSON 语法着色，供预览面板复用；返回可直接注入的 HTML */
export function highlight(json: string): string {
  return json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(
      /("(?:\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?)/g,
      (match) => {
        let cls = 'text-[#C6802A]'
        if (match.startsWith('"')) {
          cls = /:$/.test(match) ? 'text-[#4C5BD4]' : 'text-[#2E9E72]'
        }
        return `<span class="${cls}">${match}</span>`
      },
    )
}
