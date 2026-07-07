export function PageSkeleton() {
  return (
    <main className="min-h-screen overflow-x-hidden">
      <div className="relative z-30 border-b border-line/80 bg-surface/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="skeleton h-11 w-56 rounded-lg" />
          <div className="hidden gap-2 sm:flex">
            <div className="skeleton h-10 w-24 rounded-lg" />
            <div className="skeleton h-10 w-24 rounded-lg" />
            <div className="skeleton h-10 w-24 rounded-lg" />
          </div>
        </div>
      </div>
      <section className="mx-auto max-w-7xl px-3 py-8 sm:px-6 lg:px-8">
        <div className="premium-panel rounded-xl p-4 sm:p-6">
          <div className="skeleton h-2 w-40 max-w-full rounded-full sm:w-48" />
          <div className="mt-6 grid gap-3">
            <div className="skeleton h-5 w-44 max-w-full rounded-md sm:w-52" />
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
            <div key={index} className="rounded-xl border border-line bg-panel p-4 shadow-soft sm:p-5">
              <div className="skeleton h-1 w-full rounded-full" />
              <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row">
                <div className="grid min-w-0 flex-1 gap-3">
                  <div className="skeleton h-6 w-28 max-w-full rounded-md" />
                  <div className="skeleton h-4 w-40 max-w-full rounded-md sm:w-44" />
                  <div className="skeleton h-9 w-32 max-w-full rounded-lg sm:w-36" />
                </div>
                <div className="skeleton h-16 w-full rounded-lg sm:h-20 sm:w-20" />
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
