import type { NextRequest } from "next/server";
import { csvFilename, parseReportParams, rangeFor, reportCsv } from "@/lib/csv";
import { loadBank } from "@/lib/data";

/** Baixa o período do relatório em CSV. A sessão é exigida pelo `proxy`. */
export async function GET(request: NextRequest) {
  const { now, days } = await loadBank();
  const search = request.nextUrl.searchParams;
  // Um parâmetro repetido chega como lista e cai no padrão, como na página.
  const param = (name: string) => {
    const values = search.getAll(name);
    return values.length === 1 ? values[0] : values.length ? values : undefined;
  };
  const { period, ref } = parseReportParams(
    { periodo: param("periodo"), ref: param("ref") },
    now.date,
  );
  const { from, to } = rangeFor(period, ref);
  const body = reportCsv(days.filter((d) => d.date >= from && d.date <= to));
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename(period, ref, now.date)}"`,
    },
  });
}
