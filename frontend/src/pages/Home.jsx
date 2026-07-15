import { ArrowRight, CheckCircle, Clock, Download, FileText, Lock, Shield, Star, Upload, Users, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

const PLANS = [
  {
    files: 1,
    price: 450,
    label: 'Starter',
    desc: 'Perfect for a single assignment',
    popular: false
  },
  {
    files: 5,
    price: 2250,
    label: 'Standard',
    desc: 'Save with a 5-file bundle',
    popular: true
  },
  {
    files: 10,
    price: 4500,
    label: 'Value',
    desc: 'Best rate for bulk submissions',
    popular: false
  }
];

const STEPS = [
  {
    icon: <Upload size={28} />,
    title: 'Upload your document',
    desc: 'Submit your assignment file (PDF, DOC, DOCX, TXT or ZIP). We support files up to 20 MB.'
  },
  {
    icon: <Users size={28} />,
    title: 'Expert checking',
    desc: 'Our trained staff run AI and similarity checks on your document with professional tools.'
  },
  {
    icon: <Download size={28} />,
    title: 'Receive your report',
    desc: 'Download your detailed similarity and AI-detection report securely from your dashboard.'
  }
];

const FEATURES = [
  { icon: <Zap size={20} />, text: 'Fast turnaround' },
  { icon: <Shield size={20} />, text: 'Secure & private' },
  { icon: <Lock size={20} />, text: 'Protected downloads' },
  { icon: <CheckCircle size={20} />, text: 'Professional reports' },
  { icon: <Star size={20} />, text: 'AI + Similarity checks' },
  { icon: <Clock size={20} />, text: 'Real-time status updates' }
];

export default function Home() {
  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <Link className="landing-brand" to="/">
            <div className="landing-brand-mark">T</div>
            <div>
              <strong>Turnit</strong>
              <span>Assignment checking</span>
            </div>
          </Link>
          <div className="landing-nav-actions">
            <Link className="landing-nav-link" to="/login">Sign in</Link>
            <Link className="landing-cta-btn" to="/register">
              Get started
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-inner">
          <div className="landing-hero-copy">
            <div className="landing-badge">
              <Star size={14} />
              Trusted assignment checking service
            </div>
            <h1 className="landing-h1">
              Check your assignment for<br />
              <span className="landing-h1-accent">AI & Similarity</span>
            </h1>
            <p className="landing-hero-sub">
              Upload your document and receive a professional AI-detection and similarity
              report within hours. Simple, secure, and affordable.
            </p>
            <div className="landing-hero-actions">
              <Link className="landing-primary-btn" to="/register">
                Start checking now
                <ArrowRight size={18} />
              </Link>
              <Link className="landing-ghost-btn" to="/login">
                Already have an account
              </Link>
            </div>
            <div className="landing-feature-pills">
              {FEATURES.map((f) => (
                <span className="landing-pill" key={f.text}>
                  {f.icon}
                  {f.text}
                </span>
              ))}
            </div>
          </div>

          <div className="landing-hero-visual">
            <div className="landing-card-preview">
              <div className="lcp-header">
                <FileText size={20} />
                <span>assignment_final.pdf</span>
                <span className="lcp-status done">Completed</span>
              </div>
              <div className="lcp-scores">
                <div className="lcp-score-item">
                  <span className="lcp-score-label">Similarity</span>
                  <div className="lcp-score-bar">
                    <div className="lcp-score-fill low" style={{ width: '18%' }} />
                  </div>
                  <span className="lcp-score-val">18%</span>
                </div>
                <div className="lcp-score-item">
                  <span className="lcp-score-label">AI Detection</span>
                  <div className="lcp-score-bar">
                    <div className="lcp-score-fill safe" style={{ width: '7%' }} />
                  </div>
                  <span className="lcp-score-val">7%</span>
                </div>
              </div>
              <div className="lcp-footer">
                <CheckCircle size={14} />
                <span>Report ready to download</span>
              </div>
            </div>
            <div className="landing-card-preview pending">
              <div className="lcp-header">
                <FileText size={20} />
                <span>thesis_chapter3.docx</span>
                <span className="lcp-status checking">Checking</span>
              </div>
              <div className="lcp-progress-row">
                <Clock size={14} />
                <span>Staff is reviewing your document</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-steps">
        <div className="landing-section-inner">
          <div className="landing-section-label">How it works</div>
          <h2 className="landing-section-h2">Three simple steps</h2>
          <div className="landing-steps-grid">
            {STEPS.map((step, i) => (
              <div className="landing-step-card" key={step.title}>
                <div className="landing-step-num">{i + 1}</div>
                <div className="landing-step-icon">{step.icon}</div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-pricing">
        <div className="landing-section-inner">
          <div className="landing-section-label">Pricing</div>
          <h2 className="landing-section-h2">Simple, transparent pricing</h2>
          <p className="landing-pricing-sub">
            Pay once per package. No subscription, no hidden fees. LKR {(450).toLocaleString()} per file.
          </p>
          <div className="landing-plans-grid">
            {PLANS.map((plan) => (
              <div className={`landing-plan-card ${plan.popular ? 'popular' : ''}`} key={plan.files}>
                {plan.popular && <div className="landing-plan-badge">Most popular</div>}
                <div className="landing-plan-label">{plan.label}</div>
                <div className="landing-plan-price">
                  <span className="landing-plan-currency">LKR</span>
                  <strong>{plan.price.toLocaleString()}</strong>
                </div>
                <div className="landing-plan-files">{plan.files} file{plan.files > 1 ? 's' : ''}</div>
                <p className="landing-plan-desc">{plan.desc}</p>
                <Link className={`landing-plan-btn ${plan.popular ? 'primary' : 'ghost'}`} to="/register">
                  Choose {plan.label}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-cta-section">
        <div className="landing-section-inner landing-cta-inner">
          <h2>Ready to check your assignment?</h2>
          <p>Create a free account and submit your first document in minutes.</p>
          <Link className="landing-primary-btn large" to="/register">
            Create free account
            <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-section-inner landing-footer-inner">
          <div className="landing-brand">
            <div className="landing-brand-mark small">T</div>
            <div>
              <strong>Turnit</strong>
              <span>Assignment checking</span>
            </div>
          </div>
          <span className="landing-footer-copy">&copy; {new Date().getFullYear()} Turnit. All rights reserved.</span>
          <div className="landing-footer-links">
            <Link to="/login">Sign in</Link>
            <Link to="/register">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
