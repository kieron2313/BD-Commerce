import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, CheckCircle2, AlertTriangle } from 'lucide-react';
import { usePlatform } from '../../context/PlatformContext';

const TARGET_FIELDS = [
  'sku',
  'name',
  'slug',
  'productType',
  'parentSku',
  'regularPrice',
  'salePrice',
  'stockQuantity',
  'categories',
  'brand',
  'shortDescription',
  'imageUrl',
  'status',
];

export const AdminImportExport: React.FC = () => {
  const { authFetch, refreshBootstrap } = usePlatform();

  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [validation, setValidation] = useState<any>(null);
  const [commitReport, setCommitReport] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setValidation(null);
    setCommitReport(null);

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const firstSheet = wb.SheetNames[0];
    const jsonRows = XLSX.utils.sheet_to_json(wb.Sheets[firstSheet], { defval: '' }) as Record<
      string,
      any
    >[];

    if (jsonRows.length === 0) return;
    const headers = Object.keys(jsonRows[0]);
    setRawHeaders(headers);
    setRawRows(jsonRows);

    // Auto-map matching column names
    const autoMap: Record<string, string> = {};
    for (const target of TARGET_FIELDS) {
      const match = headers.find((h) => h.toLowerCase().trim() === target.toLowerCase());
      if (match) autoMap[target] = match;
    }
    setMapping(autoMap);
  };

  const buildMappedRows = () =>
    rawRows.map((r) => {
      const obj: Record<string, any> = {};
      for (const target of TARGET_FIELDS) {
        const col = mapping[target];
        obj[target] = col ? r[col] : '';
      }
      return obj;
    });

  const handleValidate = async () => {
    setBusy(true);
    try {
      const res = await authFetch('/api/admin/import-export/validate', {
        method: 'POST',
        body: JSON.stringify({ rows: buildMappedRows() }),
      });
      if (res.ok) setValidation(await res.json());
    } finally {
      setBusy(false);
    }
  };

  const handleCommit = async () => {
    setBusy(true);
    try {
      const res = await authFetch('/api/admin/import-export/commit', {
        method: 'POST',
        body: JSON.stringify({ rows: buildMappedRows() }),
      });
      if (res.ok) {
        setCommitReport(await res.json());
        await refreshBootstrap();
      }
    } finally {
      setBusy(false);
    }
  };

  const downloadAuthenticatedFile = async (url: string, filename: string) => {
    const res = await authFetch(url);
    if (!res.ok) return;
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  return (
    <div className="space-y-6 text-xs">
      {/* Export Panel */}
      <div className="bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl p-6 space-y-4">
        <div>
          <h3 className="text-base font-bold text-[#111827]">Export Products & Variations</h3>
          <p className="text-[#6B7280] mt-1">
            Download the full catalog (including variations and stock) in import-compatible CSV or Excel (.xlsx) format.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() =>
              downloadAuthenticatedFile('/api/admin/import-export/export?format=csv', 'kanso-catalog.csv')
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#171717] hover:bg-[#0A0A0A] text-white rounded-xl font-semibold shadow-xs transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() =>
              downloadAuthenticatedFile('/api/admin/import-export/export?format=xlsx', 'kanso-catalog.xlsx')
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] rounded-xl font-semibold transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Excel (.xlsx)</span>
          </button>
          <button
            type="button"
            onClick={() =>
              downloadAuthenticatedFile('/api/admin/import-export/template', 'kanso-import-template.csv')
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-[#E5E7EB] hover:border-[#171717] text-[#4B5563] hover:text-[#111827] rounded-xl font-semibold transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Sample Template</span>
          </button>
        </div>
      </div>

      {/* Import Panel */}
      <div className="bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl p-6 space-y-5">
        <div>
          <h3 className="text-base font-bold text-[#111827]">Bulk Import (CSV / XLSX)</h3>
          <p className="text-[#6B7280] mt-1">
            Upload a spreadsheet, map columns to product fields, validate SKUs and prices, and commit updates.
          </p>
        </div>

        <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#D1D5DB] bg-[#F7F7F8] rounded-2xl p-8 cursor-pointer hover:border-[#171717] transition-colors">
          <Upload className="w-6 h-6 text-[#6B7280] mb-2" />
          <span className="font-semibold text-[#111827]">Click to select .csv or .xlsx file</span>
          <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
        </label>

        {rawHeaders.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-900">
              Column Mapping ({rawRows.length} rows detected)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TARGET_FIELDS.map((field) => (
                <div key={field}>
                  <label className="block font-medium text-slate-700 mb-1">{field}</label>
                  <select
                    value={mapping[field] || ''}
                    onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                  >
                    <option value="">-- Ignore --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={handleValidate}
                className="px-5 py-2.5 bg-[#171717] hover:bg-[#0A0A0A] text-white rounded-xl font-semibold shadow-xs transition-all cursor-pointer"
              >
                Validate & Preview
              </button>
              {validation && validation.errorCount === 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleCommit}
                  className="px-5 py-2.5 bg-[#15803D] hover:bg-[#166534] text-white rounded-xl font-semibold shadow-xs transition-all cursor-pointer"
                >
                  Commit Import ({validation.totalRows} rows)
                </button>
              )}
            </div>
          </div>
        )}

        {validation && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-medium">
              {validation.errorCount > 0 ? (
                <span className="text-red-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  {validation.errorCount} row(s) have validation errors. Fix before importing.
                </span>
              ) : (
                <span className="text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  All {validation.totalRows} rows passed validation and are ready to import.
                </span>
              )}
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Row</th>
                    <th className="py-2 px-3">Action</th>
                    <th className="py-2 px-3">SKU</th>
                    <th className="py-2 px-3">Name</th>
                    <th className="py-2 px-3">Price</th>
                    <th className="py-2 px-3">Validation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {validation.preview.slice(0, 20).map((p: any) => (
                    <tr key={p.rowIndex}>
                      <td className="py-2 px-3 tabular-nums">{p.rowIndex}</td>
                      <td className="py-2 px-3 uppercase font-medium">{p.action}</td>
                      <td className="py-2 px-3 font-mono">{p.sku}</td>
                      <td className="py-2 px-3">{p.name}</td>
                      <td className="py-2 px-3 tabular-nums">${p.regularPrice}</td>
                      <td className="py-2 px-3">
                        {p.errors.length > 0 ? (
                          <span className="text-red-600">{p.errors.join(', ')}</span>
                        ) : p.warnings.length > 0 ? (
                          <span className="text-amber-700">{p.warnings.join(', ')}</span>
                        ) : (
                          <span className="text-emerald-700">Valid</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {commitReport && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-900 space-y-1">
            <p className="font-semibold">Import Completed</p>
            <p>
              Created: <strong>{commitReport.createdCount}</strong> · Updated:{' '}
              <strong>{commitReport.updatedCount}</strong>
            </p>
            {commitReport.errors?.length > 0 && (
              <p className="text-red-700">Errors: {commitReport.errors.join(' | ')}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
