import Navbar from "../../components/marketing/Navbar";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}
