import Hero from "../../components/marketing/Hero";
import Waves from "../../components/marketing/Waves";
import CompareDemo from "../../components/marketing/CompareDemo";
import Methodology from "../../components/marketing/Methodology";
import "../../styles/(marketing)/LandingPage.scss";

export default function Home() {
  return (
    <div className="landing-page">
      <div className="landing-page__hero">
        <Waves/>
        <Hero/>
      </div>
      <CompareDemo/>
      <Methodology/>
    </div>
  );
}
