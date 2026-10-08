interface Props {
  label?: string
}

export default function InfoAffordance({ label = 'Open details' }: Props) {
  return (
    <span className="info-cue" aria-label={label}>
      <span aria-hidden="true">↗</span> MORE
    </span>
  )
}
