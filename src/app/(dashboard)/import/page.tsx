import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExcelUploader } from "@/components/import/excel-uploader";

export default async function ImportPage() {
  const businessId = await getBusinessId();

  const batches = await db.importBatch.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Import Excel</h1>
        <p className="text-slate-500">
          Upload transaction spreadsheets for bulk import. For ANZ bank PDFs/CSV,
          use{" "}
          <a href="/bank-statements" className="text-emerald-600 hover:underline">
            Bank statements
          </a>{" "}
          instead.
        </p>
      </div>

      <ExcelUploader />

      {batches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Imports</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-slate-100">
              {batches.map((batch) => (
                <li key={batch.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-slate-900">{batch.filename}</p>
                    <p className="text-sm text-slate-500">{formatDate(batch.createdAt)}</p>
                  </div>
                  <span className="text-sm text-slate-600">{batch.rowCount} rows</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
