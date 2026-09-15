const files = import.meta.glob('./parts/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export const chapters = Object.entries(files)
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([path, body]) => {
    const id = path.split('/').pop()!.replace('.md', '')
    const title = body.match(/^#\s+(.+)$/m)?.[1] ?? id
    return { id, title, body }
  })
