function escapeCell(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildWorkbookHtml({ title, columns, rows }) {
  const header = columns.map((column) => `<th>${escapeCell(column.label)}</th>`).join("");
  const body = rows
    .map((row) => {
      const cells = columns
        .map((column) => `<td>${escapeCell(column.value ? column.value(row) : row[column.key])}</td>`)
        .join("");

      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          table { border-collapse: collapse; font-family: Arial, sans-serif; }
          th { background: #4f7f1f; color: #fff; font-weight: 700; }
          th, td { border: 1px solid #d8decf; padding: 8px 10px; }
        </style>
      </head>
      <body>
        <h2>${escapeCell(title)}</h2>
        <table>
          <thead><tr>${header}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </body>
    </html>
  `;
}

function normalizeFileName(value) {
  return String(value || "spice-root-export")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function exportRowsToExcel({ title, fileName, columns, rows }) {
  const workbookHtml = buildWorkbookHtml({ title, columns, rows });
  const blob = new Blob([workbookHtml], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${normalizeFileName(fileName)}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
