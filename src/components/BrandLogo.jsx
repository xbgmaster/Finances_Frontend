// Brand mark for the app: the Tishe logo (gold monogram on a black rounded badge).
// Served from /public so it resolves both on the web and inside the Capacitor APK.
export default function BrandLogo({ size = 38, className = '' }) {
  return (
    <img
      className={className}
      width={size}
      height={size}
      src="/logo.png"
      alt="Tishe"
      draggable="false"
    />
  )
}
