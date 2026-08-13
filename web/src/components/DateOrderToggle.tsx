import type { DateOrder } from "../lib/issueDate";

export function DateOrderToggle({
  value,
  onChange,
}: {
  value: DateOrder;
  onChange: (order: DateOrder) => void;
}) {
  return (
    <div className="date-order-toggle" role="group" aria-label="Date format">
      <button
        type="button"
        className={value === "uk" ? "is-active" : ""}
        onClick={() => onChange("uk")}
      >
        UK day/month/year
      </button>
      <button
        type="button"
        className={value === "us" ? "is-active" : ""}
        onClick={() => onChange("us")}
      >
        US month/day/year
      </button>
    </div>
  );
}
