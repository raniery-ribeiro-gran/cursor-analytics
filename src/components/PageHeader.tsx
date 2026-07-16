interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: string;
  onRefresh?: () => void;
  loading?: boolean;
  refreshLabel?: string;
}

export function PageHeader({
  title,
  subtitle,
  icon,
  onRefresh,
  loading,
  refreshLabel = "Atualizar do Jira",
}: PageHeaderProps) {
  return (
    <header className="border-b border-gray-200 bg-white px-6 py-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 font-montserrat text-2xl font-bold text-gran-navy">
            {icon && (
              <i
                className={`fa-solid ${icon} text-xl text-gran-red`}
                aria-hidden="true"
              />
            )}
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-gran-muted">{subtitle}</p>
          )}
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="btn-primary inline-flex items-center gap-2"
          >
            <i
              className={`fa-solid fa-arrows-rotate ${loading ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            {loading ? "Atualizando..." : refreshLabel}
          </button>
        )}
      </div>
    </header>
  );
}
