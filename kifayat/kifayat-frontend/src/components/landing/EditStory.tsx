import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import img from "@/assets/edit-story.jpg";

export function EditStory() {
  return (
    <section className="bg-bone py-20 lg:py-32">
      <div className="max-w-[1600px] mx-auto px-5 lg:px-10 grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
        <div className="lg:col-span-7 relative">
          <img src={img} alt="The quiet edit" loading="lazy" width={1280} height={1280}
            className="w-full aspect-[4/5] lg:aspect-[5/4] object-cover" />
          <div className="absolute -bottom-6 right-4 lg:right-8 bg-coal text-bone px-6 py-5 max-w-[60%]">
            <p className="eyebrow text-bone/80 mb-1">Volume 03</p>
            <p className="font-display italic text-2xl lg:text-3xl leading-tight">The quiet edit.</p>
          </div>
        </div>
        <div className="lg:col-span-5 lg:pl-6">
          <p className="eyebrow text-coal/80 mb-5">Why we exist</p>
          <h2 className="font-display italic text-5xl lg:text-7xl leading-[0.95] tracking-tight">
            Objects, considered.
          </h2>
          <p className="mt-8 text-coal/70 leading-relaxed lg:text-lg max-w-md">
            We hand-pick every piece in the Kifayat catalogue from a network of trusted partners â€” the things we&apos;d keep in our own homes, on our own desks, in our own bags.
          </p>
          <p className="mt-4 text-coal/70 leading-relaxed lg:text-lg max-w-md">
            No bloat. No fakes. No mystery markups. Just a small, evolving collection priced the way it should be.
          </p>
          <Link to="/about" className="mt-10 group inline-flex items-center gap-3 border-b border-coal pb-1 eyebrow">
            Read our philosophy
            <ArrowUpRight className="size-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" strokeWidth={1.5} />
          </Link>
        </div>
      </div>
    </section>
  );
}
