export default function BackgroundGrid() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="background-grid absolute inset-0" />
      <div className="background-rings absolute left-1/2 top-1/2 h-[110vmax] w-[110vmax] -translate-x-1/2 -translate-y-1/2 rounded-full" />
    </div>
  );
}
