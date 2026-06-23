export function PageSkeleton() {
  return (
    <main className="min-h-screen">
      <div className="sticky top-0 z-40 border-b border-line/80 bg-surface/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="skeleton h-11 w-56 rounded-lg" />
          <div className="hidden gap-2 sm:flex">
            <div className="skeleton h-10 w-24 rounded-lg" />
            <div className="skeleton h-10 w-24 rounded-lg" />
            <div className="skeleton h-10 w-24 rounded-lg" />
          </div>
        </div>
      </div>
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="premium-panel rounded-xl p-6">
          <div className="skeleton h-2 w-48 rounded-full" />
          <div className="mt-6 grid gap-3">
            <div className="skeleton h-5 w-52 rounded-md" />
            <div className="skeleton h-10 w-full max-w-2xl rounded-md" />
            <div className="skeleton h-5 w-full max-w-3xl rounded-md" />
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="rounded-xl border border-line bg-panel p-4 shadow-soft">
              <div className="skeleton h-4 w-28 rounded-md" />
              <div className="skeleton mt-4 h-9 w-20 rounded-md" />
              <div className="skeleton mt-4 h-16 rounded-md" />
            </div>
          ))}
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="rounded-xl border border-line bg-panel p-5 shadow-soft">
              <div className="skeleton h-1 w-full rounded-full" />
              <div className="mt-5 flex justify-between gap-4">
                <div className="grid flex-1 gap-3">
                  <div className="skeleton h-6 w-28 rounded-md" />
                  <div className="skeleton h-4 w-44 rounded-md" />
                  <div className="skeleton h-9 w-36 rounded-lg" />
                </div>
                <div className="skeleton h-20 w-20 rounded-lg" />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="skeleton h-14 rounded-lg" />
                <div className="skeleton h-14 rounded-lg" />
              </div>
              <div className="skeleton mt-5 h-24 rounded-lg" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
