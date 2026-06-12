import StatusBadge from "./StatusBadge";

function DataTable({ columns, rows, rowKey, compact = false }) {
  return (
    <div className={`admin-table-wrap${compact ? " compact" : ""}`}>
      <table className="admin-data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.align ? `align-${column.align}` : ""}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={rowKey ? row[rowKey] : index}>
              {columns.map((column) => {
                const value = row[column.key];

                return (
                  <td key={column.key} className={column.align ? `align-${column.align}` : ""}>
                    {column.render
                      ? column.render(row)
                      : column.type === "status"
                        ? <StatusBadge status={value} />
                        : value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
