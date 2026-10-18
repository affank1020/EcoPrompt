import type { Metadata } from "next";
import { Suspense } from "react";
import HistoryFilters from "../../../../components/history/HistoryFilters";
import HistoryTable from "../../../../components/history/HistoryTable";
import Pagination from "../../../../components/history/Pagination";
import { parseHistoryParams } from "../../../../components/history/params";
import PageHeader from "../../../../components/ui/PageHeader";
import Skeleton from "../../../../components/ui/Skeleton";
import { getEstimateFacets, getEstimates } from "../../../../lib/data/estimates";
import styles from "./page.module.scss";

export const metadata: Metadata = { title: "History · HydroPrompt" };

async function History({ searchParams }: { searchParams: PageProps<"/dashboard/history">["searchParams"] }) {
  const params = parseHistoryParams(await searchParams);
  const [result, facets] = await Promise.all([
    getEstimates({ sort: params.sort, dir: params.dir, site: params.site, model: params.model, page: params.page }),
    getEstimateFacets(),
  ]);
  // getEstimates clamps out-of-range pages, so link from the page it actually returned
  const current = { ...params, page: result.page };

  return (
    <>
      <div className={styles.toolbar}>
        <HistoryFilters params={current} sites={facets.sites} models={facets.models} />
      </div>
      <HistoryTable rows={result.rows} params={current} />
      <Pagination params={current} page={result.page} pageCount={result.pageCount} pageSize={result.pageSize} total={result.total} />
    </>
  );
}

export default function HistoryPage(props: PageProps<"/dashboard/history">) {
  return (
    <>
      <PageHeader
        title="Estimate history"
        description="Your submitted extension usage and saved website checks. Methods are labelled separately: backend estimates have no uncertainty interval; website mocks and extension estimates are illustrative."
      />
      <Suspense fallback={<Skeleton height={640} label="Loading history" />}>
        <History searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
