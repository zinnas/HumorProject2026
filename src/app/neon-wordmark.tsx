type NeonWordmarkProps = {
  text: string;
};

export default function NeonWordmark({ text }: NeonWordmarkProps) {
  return (
    <h1 className="neon-wordmark text-[clamp(4rem,16vw,10rem)] leading-none tracking-[-0.05em]">
      {text}
    </h1>
  );
}
