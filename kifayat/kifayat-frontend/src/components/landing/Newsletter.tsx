export function Newsletter() {
  return (
    <section className="bg-bone py-28 lg:py-40 px-5 lg:px-10">
      <div className="max-w-2xl mx-auto text-center">
        <p className="eyebrow text-coal/80 mb-6">Subscribe Â· Pakistan-wide</p>
        <h2 className="font-display italic text-5xl sm:text-6xl lg:text-7xl leading-[0.95]">
          The Kifayat List.
        </h2>
        <p className="mt-8 max-w-md mx-auto text-coal/60 text-sm lg:text-base leading-relaxed">
          A weekly briefing on style, tech and everyday essentials â€” plus first access to drops, dispatched Pakistan-wide before they go public.
        </p>

        <form className="mt-14 max-w-lg mx-auto flex gap-0 border border-coal/20 focus-within:border-coal transition-colors">
          <input
            type="email"
            placeholder="you@email.com"
            className="flex-1 bg-transparent px-6 py-4 text-sm text-coal placeholder:text-coal/65 focus:outline-none min-w-0"
          />
          <button
            type="submit"
            className="group relative flex items-center gap-2.5 bg-coal text-bone eyebrow px-7 py-4 hover:bg-brass hover:text-coal transition-colors duration-300 shrink-0 overflow-hidden"
          >
            Subscribe
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="group-hover:translate-x-0.5 transition-transform duration-200">
              <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </form>

        <p className="mt-6 eyebrow text-coal/65 text-[10px]">No spam Â· Unsubscribe anytime Â· Pakistan only</p>
      </div>
    </section>
  );
}
