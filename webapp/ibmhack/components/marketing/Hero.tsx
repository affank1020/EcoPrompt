import PromptChecker from "../checker/PromptChecker";
import "../../styles/Hero.scss";

export default function Hero() {
    return (
        <section className="hero">
            <h1 className="hero__main">
                Saving the environment, one prompt at a time
            </h1>
            <p className="hero__sub">Find out just how much water is being used every time you prompt an LLM, and find out how to optimise your prompts to save water and energy</p>
            <PromptChecker variant="hero" />
            <p className="hero__input-sub">Free, no sign-up needed</p>
        </section>
    )
}
