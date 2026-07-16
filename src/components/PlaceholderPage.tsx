interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-gray-200 bg-white px-6 py-5">
        <h1 className="font-montserrat text-2xl font-bold text-gran-navy">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-gran-muted">{description}</p>
        )}
      </header>

      <main className="flex flex-1 items-center justify-center p-6">
        <div className="rounded-lg border border-dashed border-gray-300 bg-white px-12 py-16 text-center shadow-sm">
          <p className="font-montserrat text-lg font-semibold text-gran-navy">
            Em breve
          </p>
          <p className="mt-2 max-w-md text-sm text-gran-muted">
            Esta seção será implementada em uma próxima fase.
          </p>
        </div>
      </main>
    </div>
  );
}
