import "../../styles/navbar.scss";

export default function Navbar() {
    return (
        <nav className="navbar">
            <a href="/" className="navbar__logo">
                <span className="navbar__logo__mark" aria-hidden="true" />
                <span className="navbar__logo__text">
                    <span className="navbar__logo__name">HydroPrompt</span>
                    <span className="navbar__logo__tagline">Water-aware AI prompting</span>
                </span>
            </a>
            <div className="navbar__links">
                <a href="#how-it-works" className="navbar__links__link">How it works</a>
                <a href="#why-water" className="navbar__links__link">Why water</a>
                <a href="#extension" className="navbar__links__link">Extension</a>
                <a href="#faq" className="navbar__links__link">FAQ</a>
            </div>
            <div className="navbar__buttons">
                <button type="button" className="navbar__buttons__button">Login</button>
                <button type="button" className="navbar__buttons__button green-button">Sign Up</button>
            </div>
        </nav>
    )
}
