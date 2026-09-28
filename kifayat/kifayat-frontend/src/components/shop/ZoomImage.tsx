import { useRef, type PointerEvent } from "react";

export function ZoomImage({
  src,
  alt,
  className = "",
  onClick,
  eager = false,
  srcSet,
  sizes,
  width,
  height,
}: {
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
  /** Boost the image out of lazy-loading: the first gallery image on a product
   *  page is the LCP element, so it must load eagerly at high priority. */
  eager?: boolean;
  /** Responsive candidates (e.g. optImage(url, 420|600|900|1200)) + sizes. */
  srcSet?: string;
  sizes?: string;
  /** Intrinsic dimensions — reserve layout space and feed LCP sizing. */
  width?: number;
  height?: number;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const frame = useRef<number | null>(null);

  const updateOrigin = (e: PointerEvent<HTMLDivElement>) => {
    if (frame.current) return;
    // Capture currentTarget and pointer coords synchronously before the rAF —
    // React nulls out currentTarget once the event handler returns.
    const target = e.currentTarget;
    const clientX = e.clientX;
    const clientY = e.clientY;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const img = imgRef.current;
      if (!img || !target) return;
      const r = target.getBoundingClientRect();
      const x = ((clientX - r.left) / r.width) * 100;
      const y = ((clientY - r.top) / r.height) * 100;
      img.style.transformOrigin = `${x}% ${y}%`;
    });
  };

  return (
    <div
      className={`relative overflow-hidden cursor-zoom-in ${className}`}
      onPointerMove={updateOrigin}
      onClick={onClick}
    >
      <img
        ref={imgRef}
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        width={width}
        height={height}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding={eager ? "sync" : "async"}
        fetchPriority={eager ? "high" : undefined}
        className="size-full object-contain transition-transform duration-500 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:scale-[1.45] motion-reduce:transition-none motion-reduce:hover:scale-100"
      />
    </div>
  );
}