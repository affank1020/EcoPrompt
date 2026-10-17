import Image from "next/image";
import Hero from "../../components/marketing/Hero";
import "../../styles/(marketing)/LandingPage.scss";

export default function Home() {
  return (
    <div className="landing-page">
      <Hero/>
    </div>
  );
}
