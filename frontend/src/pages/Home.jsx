import { ArrowRight, FileCheck2, ShieldCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatLkr } from '../utils/format';

export default function Home() {
  return (
    <main className="public-home">
      <nav className="public-nav" aria-label="Public navigation">
        <Link className="auth-brand" to="/">
          <div className="brand-mark">T</div>
          <div>
            <strong>Turnit</strong>
            <span>Assignment report checking</span>
          </div>
        </Link>
        <div className="public-nav-actions">
          <Link className="primary-button" to="/login">
            Customer login
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </nav>

      <section className="public-hero">
        <div className="public-hero-copy">
          <span className="eyebrow">Phase 1 workflow</span>
          <h1>Upload assignment files and receive checked reports.</h1>
          <p>
            Customers create paid test orders, staff accept available work, and completed reports
            are delivered through protected downloads.
          </p>
          <div className="button-row">
            <Link className="primary-button" to="/register">
              Create customer account
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link className="secondary-button" to="/login">Sign in</Link>
          </div>
        </div>

        <div className="public-workflow" aria-label="Workflow summary">
          <div>
            <FileCheck2 size={22} aria-hidden="true" />
            <strong>Upload</strong>
            <span>PDF, DOC, DOCX, TXT, ZIP</span>
          </div>
          <div>
            <Users size={22} aria-hidden="true" />
            <strong>Staff checks</strong>
            <span>First-come-first-served acceptance</span>
          </div>
          <div>
            <ShieldCheck size={22} aria-hidden="true" />
            <strong>Download</strong>
            <span>Final reports stay protected</span>
          </div>
        </div>
      </section>

      <section className="public-pricing" aria-label="Service pricing">
        <div className="pricing-card">
          <span>AI + Similarity</span>
          <strong>{formatLkr(450)}</strong>
          <small>1 file package</small>
        </div>
        <div className="pricing-card">
          <span>AI + Similarity</span>
          <strong>{formatLkr(2250)}</strong>
          <small>5 files package</small>
        </div>
        <div className="pricing-card">
          <span>AI + Similarity</span>
          <strong>{formatLkr(4500)}</strong>
          <small>10 files package</small>
        </div>
      </section>
    </main>
  );
}
