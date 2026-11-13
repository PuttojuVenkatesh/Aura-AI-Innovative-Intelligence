import React from "react";
import Icon from "./Icon.jsx";

const features = [
  {
    icon: "zap",
    tone: "violet",
    title: "Real-Time Context Sync",
    text: "Keep every exchange connected. Responses stream in live and your conversation history stays ready when you return.",
    detail: "Live responses · Persistent sessions",
  },
  {
    icon: "spark",
    tone: "blue",
    title: "Deep Message Analytics",
    text: "See intent, priority, risk profile, and estimated input tokens alongside every assistant response.",
    detail: "Intent · Risk · Priority",
  },
  {
    icon: "clock",
    tone: "mint",
    title: "Dynamic Session Management",
    text: "Find past conversations quickly, pick up where you left off, and keep your workspace organized.",
    detail: "Searchable · Chronological · Saved",
  },
];

const steps = [
  {
    number: "01",
    title: "Type or stream",
    text: "Ask naturally, add text-file context, and watch a clear Markdown response arrive as it is written.",
  },
  {
    number: "02",
    title: "Analyze & score",
    text: "Review intent, estimated tokens, priority, and risk in a live inspector beside your conversation.",
  },
  {
    number: "03",
    title: "Continue & pivot",
    text: "Choose a suggested follow-up to explore the topic further without losing your conversation context.",
  },
];

const testimonials = [
  {
    quote: "The insight panel gives our team a useful read on every request without interrupting the conversation.",
    name: "Maya Chen",
    role: "Product engineer",
    initials: "MC",
  },
  {
    quote: "Being able to reopen a past session and continue from the same context makes the workspace feel effortless.",
    name: "Jordan Lee",
    role: "Engineering lead",
    initials: "JL",
  },
  {
    quote: "Simple, focused, and the streamed Markdown is genuinely easy to scan while the answer is being written.",
    name: "Alex Morgan",
    role: "Independent developer",
    initials: "AM",
  },
];

export default function LandingPage({ onGetStarted, onNavigate, onLegal }) {
  return (
    <main className="landing-page">
      <section className="hero-section" id="home">
        <div className="hero-orb hero-orb-one" />
        <div className="hero-orb hero-orb-two" />
        <div className="hero-content">
          <div className="eyebrow-pill">
            <Icon name="zap" size={15} />
            <span>Powered by real-time neural intelligence</span>
          </div>
          <h1>Intelligent conversations,<br /><span>tailored for your workflow.</span></h1>
          <p className="hero-subtitle">
            Manage past context, organize dynamic sessions, and interact with smart AI assistants seamlessly.
          </p>
          <div className="hero-actions">
            <button className="button button-primary button-large" onClick={onGetStarted}>
              Get started for free <Icon name="arrow" size={18} />
            </button>
            <button className="button button-quiet button-large" onClick={() => onNavigate("features")}>
              Explore Aura <Icon name="arrowDown" size={17} />
            </button>
          </div>
          <div className="hero-proof">
            <div className="avatar-stack" aria-hidden="true">
              <span>J</span><span>M</span><span>A</span><span>+</span>
            </div>
            <span>Thoughtful AI, built for the way you work</span>
          </div>
        </div>
        <div className="hero-preview" aria-label="Aura AI workspace preview">
          <div className="preview-window">
            <div className="preview-topbar">
              <div className="preview-brand"><span className="brand-mark small"><Icon name="spark" size={14} /></span> Aura workspace</div>
              <span className="preview-live"><i /> Live response</span>
            </div>
            <div className="preview-body">
              <div className="preview-side">
                <span className="preview-side-title">RECENT</span>
                <span className="preview-side-item active">Planning a product launch</span>
                <span className="preview-side-item">Review API response</span>
                <span className="preview-side-item">Weekly team update</span>
              </div>
              <div className="preview-chat">
                <div className="preview-message user">Help me turn these notes into a clear launch plan.</div>
                <div className="preview-assistant">
                  <span className="preview-bot-icon"><Icon name="spark" size={14} /></span>
                  <div>
                    <strong>A focused launch plan</strong>
                    <p>Start with a clear audience, a single goal, and a few measurable milestones.</p>
                    <div className="preview-lines"><i /><i /><i /></div>
                  </div>
                </div>
                <div className="preview-insight">
                  <div><span>INTENT</span><b>Planning</b></div>
                  <div><span>RISK</span><b className="safe-label">Low risk</b></div>
                  <div><span>PRIORITY</span><b>Medium</b></div>
                </div>
              </div>
            </div>
            <div className="preview-input"><span>Ask anything...</span><span className="preview-send"><Icon name="arrow" size={16} /></span></div>
          </div>
          <div className="floating-note note-top"><span className="note-icon"><Icon name="shield" size={17} /></span><span><b>Context aware</b><small>Past sessions, in reach</small></span></div>
          <div className="floating-note note-bottom"><span className="note-icon note-icon-green"><Icon name="check" size={17} /></span><span><b>Insights included</b><small>Intent & risk at a glance</small></span></div>
        </div>
        <button className="scroll-cue" onClick={() => onNavigate("features")} aria-label="Scroll to features">
          <span>Discover Aura</span><Icon name="chevronDown" size={17} />
        </button>
      </section>

      <section className="section features-section" id="features">
        <div className="section-heading">
          <span className="section-kicker">A clearer way to think</span>
          <h2>Built for advanced performance.</h2>
          <p>Everything you need for focused, informed, and continuous conversations.</p>
        </div>
        <div className="feature-grid">
          {features.map((feature) => (
            <article className="feature-card" key={feature.title}>
              <div className={`feature-icon ${feature.tone}`}><Icon name={feature.icon} size={21} /></div>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
              <div className="feature-detail"><Icon name="check" size={15} />{feature.detail}</div>
            </article>
          ))}
        </div>
        <div className="feature-banner">
          <div className="banner-decoration"><Icon name="spark" size={38} /></div>
          <div><strong>One workspace. A lot more clarity.</strong><p>Keep the conversation and the context in one place.</p></div>
          <button className="button button-outline" onClick={onGetStarted}>Open your workspace <Icon name="arrow" size={16} /></button>
        </div>
      </section>

      <section className="section workflow-section" id="how-it-works">
        <div className="section-heading">
          <span className="section-kicker">A natural flow</span>
          <h2>From query to action in seconds.</h2>
          <p>Three simple steps keep your best thinking moving forward.</p>
        </div>
        <div className="workflow-grid">
          {steps.map((step, index) => (
            <article className="workflow-card" key={step.number}>
              <div className="workflow-card-top">
                <span className="workflow-number">{step.number}</span>
                {index < steps.length - 1 && <span className="workflow-connector" />}
              </div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
        <div className="workflow-callout">
          <div className="callout-avatar"><Icon name="spark" size={22} /></div>
          <div><strong>Stay curious. Keep the context.</strong><p>Use smart follow-ups to turn one good answer into a useful next step.</p></div>
          <button className="text-button" onClick={onGetStarted}>Try it now <Icon name="arrow" size={16} /></button>
        </div>
      </section>

      <section className="section stories-section" id="stories">
        <div className="section-heading">
          <span className="section-kicker">Made for momentum</span>
          <h2>Good conversations make good work.</h2>
          <p>A workspace that helps people move from first thought to next step.</p>
        </div>
        <div className="testimonial-grid">
          {testimonials.map((item) => (
            <article className="testimonial-card" key={item.name}>
              <div className="testimonial-stars" aria-label="5 out of 5 stars">★★★★★</div>
              <blockquote>“{item.quote}”</blockquote>
              <div className="testimonial-person"><span className="testimonial-avatar">{item.initials}</span><span><b>{item.name}</b><small>{item.role}</small></span></div>
            </article>
          ))}
        </div>
        <div className="final-cta">
          <div className="final-cta-glow" />
          <span className="section-kicker">Your next conversation starts here</span>
          <h2>Make room for better ideas.</h2>
          <p>Bring your questions, pick up your context, and see where the conversation goes.</p>
          <button className="button button-white button-large" onClick={onGetStarted}>Get started for free <Icon name="arrow" size={18} /></button>
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-brand">
            <a className="brand-lockup" href="#home" onClick={(event) => { event.preventDefault(); onNavigate("home"); }}>
              <span className="brand-mark"><Icon name="spark" size={19} /></span><span>Aura <b>AI</b></span>
            </a>
            <p>Thoughtful conversations, made more useful.</p>
          </div>
          <div className="footer-column"><strong>Explore</strong><button onClick={() => onNavigate("features")}>Features</button><button onClick={() => onNavigate("how-it-works")}>How it works</button><button onClick={onGetStarted}>Workspace</button></div>
          <div className="footer-column"><strong>Company</strong><button onClick={() => onLegal("About Aura AI")}>About</button><button onClick={() => onLegal("Contact")}>Contact</button><button onClick={() => onLegal("Privacy")}>Privacy</button></div>
          <div className="footer-column"><strong>Ready when you are</strong><p>Open your workspace and start a conversation.</p><button className="footer-cta" onClick={onGetStarted}>Open Aura <Icon name="arrow" size={15} /></button></div>
        </div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} Aura AI. All rights reserved.</span><span><Icon name="shield" size={14} /> Your workspace, your context.</span></div>
      </footer>
    </main>
  );
}
