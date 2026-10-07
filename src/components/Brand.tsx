import Image, { type StaticImageData } from 'next/image';
import headCautious from '@gatopago/brand/meli/head-cautious.webp';
import headFocused from '@gatopago/brand/meli/head-focused.webp';
import headHappy from '@gatopago/brand/meli/head-happy.webp';
import headPeek from '@gatopago/brand/meli/head-peek.webp';

/** GatoPago's cat and the console's name. */
export function Brand({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image src="/Logo_gatopago.svg" alt="" width={30} height={23} unoptimized />
      <span className="leading-none">
        <strong className="block font-display text-[16px] tracking-[-0.03em]">GatoPago</strong>
        <span className="mt-0.5 block text-[10px] font-semibold tracking-[0.12em] text-cat-700 uppercase">
          Negocios
        </span>
      </span>
    </span>
  );
}

const sprites = {
  'head-cautious': headCautious,
  'head-focused': headFocused,
  'head-happy': headHappy,
  'head-peek': headPeek,
} satisfies Record<string, StaticImageData>;

/** Meli, GatoPago's pixel cat, in the expressions the console uses. */
export function Meli({
  variant,
  className = '',
}: {
  variant: keyof typeof sprites;
  className?: string;
}) {
  return (
    <Image
      src={sprites[variant]}
      alt=""
      aria-hidden="true"
      className={`h-auto [image-rendering:pixelated] ${className}`}
      unoptimized
    />
  );
}
