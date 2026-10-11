import type { Table } from "@/lib/types";

interface Props {
  tables: Table[];
  selectedId?: number;
  onSelect: (table: Table) => void;
}

export function TableGrid({ tables, selectedId, onSelect }: Props) {
  if (tables.length === 0) {
    return <p className="empty">Нет свободных столиков на выбранное время.</p>;
  }
  return (
    <div className="grid">
      {tables.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`table-card${selectedId === t.id ? " table-card--active" : ""}`}
          onClick={() => onSelect(t)}
        >
          <div className="table-card__number">№ {t.number}</div>
          <div className="table-card__capacity">до {t.capacity} гостей</div>
        </button>
      ))}
    </div>
  );
}