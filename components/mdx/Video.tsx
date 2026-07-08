export function Video({ kinescope }: { kinescope: string }) {
  return (
    <div className="mdx-video">
      <iframe
        src={`https://kinescope.io/embed/${kinescope}`}
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
      />
    </div>
  )
}
