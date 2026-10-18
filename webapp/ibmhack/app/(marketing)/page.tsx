import Hero from "../../components/marketing/Hero";
import Waves from "../../components/marketing/Waves";
import CompareDemo from "../../components/marketing/CompareDemo";
import Methodology from "../../components/marketing/Methodology";
import WhyWater from "../../components/marketing/WhyWater";
import Extension from "../../components/marketing/Extension";
import Faq from "../../components/marketing/Faq";
import { FEATURES } from "../../lib/features";
import "../../styles/(marketing)/LandingPage.scss";

export default function Home() {
  return (
    <div className="landing-page">
      <div className="landing-page__hero">
        <Waves/>
        <Hero/>
      </div>
      {FEATURES.compareModels && <CompareDemo/>}
      {/* Without the compare demo, Why water sits right under the hero and continues its colour */}
      <WhyWater afterHero={!FEATURES.compareModels}/>
      <Methodology/>
      <Extension/>
      <Faq/>
    </div>
  );
}
