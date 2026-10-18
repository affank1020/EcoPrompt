import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import ComparePanel from "../../../components/compare/ComparePanel";
import PageHeader from "../../../components/ui/PageHeader";
import { DEMO_MODEL_IDS, MODELS } from "../../../lib/estimation/models";
import { FEATURES } from "../../../lib/features";

export const metadata: Metadata = { title: "Compare models · HydroPrompt" };

const MAX_MODELS = 12;

// The landing page demo links here with ?prompt=, so the visitor's prompt carries over
async function Compare({ searchParams }: { searchParams: PageProps<"/compare">["searchParams"] }) {
  const { prompt } = await searchParams;
  return (
    <ComparePanel
      models={MODELS}
      initialSelected={[...DEMO_MODEL_IDS, "claude-haiku", "gemini-flash"]}
      initialPrompt={typeof prompt === "string" ? prompt : ""}
      maxModels={MAX_MODELS}
      showExamples
    />
  );
}

export default function ComparePage(props: PageProps<"/compare">) {
  // Before any Suspense boundary, so the response is a real 404 rather than a streamed one
  if (!FEATURES.compareModels) notFound();
  return (
    <>
      <PageHeader
        title="Compare models"
        description="Enter one prompt and see how much water each model would use for it, with the uncertainty range for each."
      />
      <Suspense fallback={null}>
        <Compare searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
