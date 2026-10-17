import Link from "next/link";
import "../../styles/navbar.scss";

export default function Navbar() {
    return (
        <nav className="navbar">
            <Link href="/" className="navbar__logo">
                <span className="navbar__logo__mark" aria-hidden="true" />
                <span className="navbar__logo__text">
                    <span className="navbar__logo__name">HydroPrompt</span>
                    <span className="navbar__logo__tagline">Water-aware AI prompting</span>
                </span>
            </Link>
            <div className="navbar__links">
                <a href="#methodology" className="navbar__links__link">How it works</a>
                <a href="#compare" className="navbar__links__link">Compare</a>
                <a href="#why-water" className="navbar__links__link">Why water</a>
                <a href="#extension" className="navbar__links__link">Extension</a>
                <a href="#faq" className="navbar__links__link">FAQ</a>
                <Link href="/dashboard" className="navbar__links__link">Dashboard</Link>
            </div>
            <div className="navbar__buttons">
                <Link href="/login" className="navbar__buttons__button">Login</Link>
                <Link href="/signup" className="navbar__buttons__button green-button">Sign Up</Link>
            </div>
        </nav>
    )
}
