import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export function Lightbox({
  images,
  index,
  onClose,
  onIndex,
}: {
  images: string[];
  index: number | null;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const open = index !== null;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex(((index ?? 0) + 1) % images.length);
      if (e.key === "ArrowLeft") onIndex(((index ?? 0) - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, index, images.length, onClose, onIndex]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="fixed inset-0 z-[120] bg-coal/95 backdrop-blur-md grid place-items-center"
          onClick={onClose}
        >
          <button
            onClick={onClose}
            className="absolute top-5 right-5 size-12 grid place-items-center text-bone hover:bg-bone/10 transition rounded-full"
            aria-label="Close"
          >
            <X className="size-5" strokeWidth={1.4} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onIndex(((index ?? 0) - 1 + images.length) % images.length);
            }}
            className="absolute left-3 lg:left-8 top-1/2 -translate-y-1/2 size-12 lg:size-14 grid place-items-center text-bone hover:bg-bone/10 transition rounded-full"
            aria-label="Previous"
          >
            <ChevronLeft className="size-6" strokeWidth={1.4} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onIndex(((index ?? 0) + 1) % images.length);
            }}
            className="absolute right-3 lg:right-8 top-1/2 -translate-y-1/2 size-12 lg:size-14 grid place-items-center text-bone hover:bg-bone/10 transition rounded-full"
            aria-label="Next"
          >
            <ChevronRight className="size-6" strokeWidth={1.4} />
          </button>
          <motion.img
            key={index}
            src={images[index ?? 0]}
            alt=""
            decoding="async"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] max-w-[92vw] object-contain shadow-e3"
          />
          <div className="absolute bottom-5 inset-x-0 flex justify-center gap-2 eyebrow text-bone/60">
            {String((index ?? 0) + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
