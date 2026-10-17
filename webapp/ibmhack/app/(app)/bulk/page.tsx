import type { Metadata } from "next";
import BulkChecker from "../../../components/bulk/BulkChecker";
import PageHeader from "../../../components/ui/PageHeader";

export const metadata: Metadata = { title: "Bulk check · HydroPrompt" };

export default function BulkPage() {
  return (
    <>
      <PageHeader
        title="Bulk prompt check"
        description="Paste a batch of prompts or upload a .txt or .csv file to estimate the water for each one, and the total."
      />
      <BulkChecker />
    </>
  );
}
