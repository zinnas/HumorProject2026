function OrbitalCluster({
  className,
  rotate,
}: {
  className: string;
  rotate?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 240 240"
      className={`orbital-float absolute h-40 w-40 sm:h-52 sm:w-52 ${className}`}
      style={rotate ? { transform: rotate } : undefined}
    >
      <circle cx="120" cy="120" r="72" className="orbital-stroke" />
      <circle cx="120" cy="120" r="36" className="orbital-stroke orbital-stroke-dim" />
      <path d="M50 170 L95 132 L144 158 L188 95" className="orbital-line" />
      <path d="M120 66 L132 92 L160 95 L138 112 L144 140 L120 125 L96 140 L102 112 L80 95 L108 92 Z" className="orbital-fill" />
      <circle cx="50" cy="170" r="4" className="orbital-fill" />
      <circle cx="95" cy="132" r="4" className="orbital-fill" />
      <circle cx="144" cy="158" r="4" className="orbital-fill" />
      <circle cx="188" cy="95" r="4" className="orbital-fill" />
    </svg>
  );
}

export default function DecorativeOrbitals() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <OrbitalCluster className="left-[8%] top-[18%]" rotate="rotate(-12deg)" />
      <OrbitalCluster className="bottom-[12%] right-[10%]" rotate="rotate(22deg)" />
      <OrbitalCluster className="right-[18%] top-[14%] hidden lg:block" rotate="rotate(58deg)" />
    </div>
  );
}
