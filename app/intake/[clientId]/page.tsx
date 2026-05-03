"use client";
import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";

const G = "#BEFF00";
const MUTED = "#444";

interface Step {
  id: string;
  type: string;
  key?: string;
  label?: string;
  question?: string;
  placeholder?: string;
  inputType?: string;
  hint?: string;
  options?: string[];
  suggestions?: string[];
  min?: number;
  max?: number;
  step?: number;
  defaultVal?: number;
}

const STEPS: Step[] = [
  { id: "welcome", type: "welcome" },
  {
    id: "company", type: "text", key: "companyName",
    label: "Let's start with the basics.",
    question: "What's your company name?",
    placeholder: "e.g. Syngular",
  },
  {
    id: "website", type: "text", key: "website",
    label: "Nice.",
    question: "Paste your website URL.",
    placeholder: "https://yourcompany.com",
    inputType: "url",
    hint: "Our AI will read your site and extract everything it needs about your business — no need to explain anything manually.",
  },
  {
    id: "industry", type: "chips", key: "industries",
    label: "Got it.",
    question: "Which industries are you targeting?",
    options: ["SaaS / Tech","Marketing & Advertising","Healthcare","Finance & Fintech","E-commerce","Real Estate","Consulting","Manufacturing","Education","Media","Legal","Other"],
  },
  {
    id: "titles", type: "tags", key: "jobTitles",
    label: "Good.",
    question: "What job titles are you going after?",
    placeholder: "Type a title, press Enter",
    suggestions: ["CEO","CMO","VP Marketing","Head of Growth","Founder","Director of Sales","CTO","Marketing Manager"],
  },
  {
    id: "companySize", type: "radio", key: "companySize",
    label: "Perfect.",
    question: "What's the ideal company size?",
    options: ["1–10","11–50","51–200","201–1K","1K–5K","5K+"],
  },
  {
    id: "geography", type: "chips", key: "geography",
    label: "Noted.",
    question: "Where are your target clients located?",
    options: ["United States","Canada","United Kingdom","Europe","Latin America","Australia / NZ","Middle East","Asia Pacific","Global — All"],
  },
  {
    id: "painPoint", type: "textarea", key: "painPoint",
    label: "Almost there.",
    question: "What's the core pain point you solve?",
    placeholder: "e.g. Most of our clients come to us because they've been investing in marketing but their brand looks outdated...",
    hint: "Write a full paragraph. The more specific and real this sounds, the better our AI can personalize each video.",
  },
  {
    id: "leadCount", type: "slider", key: "leadCount",
    label: "Last question.",
    question: "How many leads do you need?",
    min: 1, max: 25, step: 1, defaultVal: 5,
  },
  {
    id: "email", type: "text", key: "email",
    label: "One more thing.",
    question: "Where should we send your campaign updates?",
    placeholder: "your@email.com",
    inputType: "email",
  },
  { id: "confirm", type: "confirm" },
];

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garant:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #000; height: 100%; }
  #intake-root { min-height: 100vh; background: #000; font-family: 'Syne', sans-serif; color: #fff; }
  ::placeholder { color: #333; }
  :focus { outline: none; }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-thumb { background: #1A1A1A; }

  .intake-input {
    width: 100%; background: transparent; border: none;
    border-bottom: 1px solid #1A1A1A; padding: 14px 0;
    font-size: 22px; color: #fff; font-family: 'Syne', sans-serif;
    font-weight: 600; transition: border-color 0.2s; caret-color: ${G};
  }
  .intake-input:focus { border-bottom-color: ${G}; }

  .intake-textarea {
    width: 100%; background: transparent; border: none;
    border-bottom: 1px solid #1A1A1A; padding: 14px 0;
    font-size: 18px; color: #fff; font-family: 'Syne', sans-serif;
    font-weight: 500; resize: none; line-height: 1.6;
    transition: border-color 0.2s; caret-color: ${G};
  }
  .intake-textarea:focus { border-bottom-color: ${G}; }

  .chip-btn {
    padding: 10px 18px; background: transparent; border: 1px solid #1E1E1E;
    border-radius: 2px; color: #555; font-size: 13px;
    font-family: 'Syne', sans-serif; font-weight: 500;
    cursor: pointer; transition: all 0.12s; user-select: none;
  }
  .chip-btn:hover { border-color: ${G}44; color: #888; }
  .chip-btn.active { background: ${G}12; border-color: ${G}; color: ${G}; }

  .sugg-pill {
    padding: 5px 14px; background: transparent; border: 1px solid #1A1A1A;
    border-radius: 100px; font-size: 12px; color: #444;
    font-family: 'Syne', sans-serif; cursor: pointer; transition: all 0.12s;
  }
  .sugg-pill:hover { border-color: ${G}55; color: ${G}; }

  .tag-item {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 12px; background: ${G}10; border: 1px solid ${G}33;
    border-radius: 2px; font-size: 13px; color: ${G};
    font-family: 'Syne', sans-serif;
  }
  .tag-x { cursor: pointer; opacity: 0.5; font-size: 15px; line-height: 1; }
  .tag-x:hover { opacity: 1; }

  input[type='range'] { -webkit-appearance: none; width: 100%; background: transparent; cursor: pointer; }
  input[type='range']::-webkit-slider-runnable-track { height: 1px; background: #1A1A1A; border-radius: 1px; }
  input[type='range']::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; background: ${G}; border-radius: 50%; margin-top: -9.5px; cursor: pointer; }
  input[type='range']::-moz-range-track { height: 1px; background: #1A1A1A; }
  input[type='range']::-moz-range-thumb { width: 20px; height: 20px; background: ${G}; border-radius: 50%; border: none; cursor: pointer; }

  .cta-btn {
    padding: 14px 40px; background: transparent; border: 1px solid ${G};
    color: ${G}; font-size: 12px; font-weight: 700; letter-spacing: 0.12em;
    text-transform: uppercase; font-family: 'Syne', sans-serif;
    cursor: pointer; border-radius: 2px; transition: all 0.15s;
  }
  .cta-btn:hover:not(:disabled) { background: ${G}; color: #000; transform: translateY(-1px); }
  .cta-btn:disabled { border-color: #222; color: #333; cursor: not-allowed; }

  .back-btn {
    background: none; border: none; color: #333; font-size: 12px;
    font-family: 'Syne', sans-serif; cursor: pointer;
    transition: color 0.12s; letter-spacing: 0.08em;
  }
  .back-btn:hover { color: #666; }

  @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
  .fade-up { animation: fadeUp 0.4s ease forwards; }
  .fade-up-delay { animation: fadeUp 0.4s ease 0.18s forwards; opacity: 0; }
  .fade-up-delay-2 { animation: fadeUp 0.4s ease 0.32s forwards; opacity: 0; }

  @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
  .dot-blink { animation: blink 1.4s ease-in-out infinite; }

  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner { animation: spin 0.8s linear infinite; }
`;

export default function ClientIntake() {
  const params = useParams() as { clientId: string };
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[] | number>>({});
  const [val, setVal] = useState("");
  const [chips, setChips] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [slider, setSlider] = useState(100);
  const [animKey, setAnimKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmUrl, setConfirmUrl] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const current = STEPS[step];

  useEffect(() => {
    setVal("");
    setChips([]);
    setTags([]);
    if (current?.type === "slider") setSlider(current.defaultVal ?? 100);
    setAnimKey((k) => k + 1);
    if (inputRef.current) setTimeout(() => inputRef.current?.focus(), 500);
  }, [step]);

  const submitCampaign = async (emailVal: string): Promise<boolean> => {
    setIsLoading(true);
    setSubmitError(null);
    try {
      const companyName = answers.companyName as string;
      const res = await fetch("/api/campaigns/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: params.clientId,
          clientName: companyName,
          clientEmail: emailVal,
          websiteUrl: answers.website as string,
          painPoint: answers.painPoint as string,
          industries: (answers.industries as string[]) ?? [],
          jobTitles: (answers.jobTitles as string[]) ?? [],
          companySize: answers.companySize as string,
          geography: (answers.geography as string[]) ?? [],
          leadCount: answers.leadCount as number,
          name: `${companyName} Campaign`,
        }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Failed to create campaign");
      }
      const data = await res.json() as { client_url: string };
      setConfirmUrl(data.client_url);
      setIsLoading(false);
      return true;
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
      setIsLoading(false);
      return false;
    }
  };

  const saveAndNext = async () => {
    const map: Record<string, string | string[] | number> = {
      text: val, textarea: val,
      chips, radio: chips[0] ?? "",
      tags, slider,
    };
    if (current.key) setAnswers((a) => ({ ...a, [current.key!]: map[current.type] ?? val }));

    if (step === STEPS.length - 2) {
      const ok = await submitCampaign(val);
      if (!ok) return;
    }

    setStep((s) => s + 1);
  };

  const canNext = () => {
    const t = current?.type;
    if (t === "welcome" || t === "confirm") return true;
    if (t === "text" || t === "textarea") return val.trim().length > 0;
    if (t === "chips" || t === "radio") return chips.length > 0;
    if (t === "tags") return tags.length > 0;
    if (t === "slider") return true;
    return false;
  };

  const toggleChip = (o: string) => {
    if (current.type === "radio") { setChips([o]); return; }
    setChips((c) => c.includes(o) ? c.filter((x) => x !== o) : [...c, o]);
  };

  const addTag = (t: string) => {
    const trimmed = t.trim();
    if (trimmed && !tags.includes(trimmed)) setTags((prev) => [...prev, trimmed]);
  };

  const progress = (step / (STEPS.length - 1)) * 100;

  return (
    <div id="intake-root">
      <style>{css}</style>

      {/* Progress bar */}
      <div style={{
        position: "fixed", top: 0, left: 0, zIndex: 99,
        height: "2px", width: `${progress}%`,
        background: G, transition: "width 0.5s ease",
        boxShadow: `0 0 6px ${G}66`,
      }} />

      {/* ── WELCOME ── */}
      {current.type === "welcome" && (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 clamp(24px, 8vw, 120px)" }}>
          <div key={animKey}>
            <p className="fade-up" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: G, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: "40px" }}>
              Campaign Intake
            </p>
            <h1 className="fade-up" style={{ fontFamily: "'Cormorant Garant', serif", fontSize: "clamp(52px, 9vw, 110px)", fontWeight: "300", lineHeight: 1.0, letterSpacing: "-0.01em", marginBottom: "12px", color: "#fff" }}>
              Let&apos;s build your
            </h1>
            <h1 className="fade-up" style={{ fontFamily: "'Cormorant Garant', serif", fontSize: "clamp(52px, 9vw, 110px)", fontWeight: "300", fontStyle: "italic", lineHeight: 1.05, letterSpacing: "-0.01em", marginBottom: "40px", color: G }}>
              perfect lead list.
            </h1>
            <p className="fade-up-delay" style={{ fontSize: "15px", color: "#444", lineHeight: 1.8, maxWidth: "400px", marginBottom: "60px", fontWeight: "400", letterSpacing: "0.01em" }}>
              Answer a few questions and we&apos;ll generate hyper-targeted leads and personalized outreach videos — automatically.
            </p>
            <div className="fade-up-delay-2">
              <button className="cta-btn" onClick={saveAndNext}>Begin →</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRM ── */}
      {current.type === "confirm" && (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 clamp(24px, 8vw, 120px)" }}>
          <div key={animKey}>
            {isLoading ? (
              <>
                <div className="fade-up" style={{ marginBottom: "36px" }}>
                  <div className="spinner" style={{ width: "32px", height: "32px", border: `1px solid ${G}33`, borderTop: `1px solid ${G}`, borderRadius: "50%" }} />
                </div>
                <h2 className="fade-up" style={{ fontSize: "clamp(28px, 4vw, 48px)", fontWeight: "700", letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: "16px" }}>
                  Building your<br /><span style={{ color: G }}>campaign…</span>
                </h2>
              </>
            ) : submitError ? (
              <>
                <h2 className="fade-up" style={{ fontSize: "clamp(24px, 4vw, 40px)", fontWeight: "700", letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: "16px", color: "#F07B5D" }}>
                  Something went wrong.
                </h2>
                <p className="fade-up-delay" style={{ fontSize: "14px", color: "#555", marginBottom: "32px" }}>{submitError}</p>
                <button className="cta-btn" onClick={() => setStep((s) => s - 1)}>← Try again</button>
              </>
            ) : (
              <>
                <div className="fade-up" style={{ width: "52px", height: "52px", borderRadius: "50%", border: `1px solid ${G}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "36px" }}>
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <path d="M4 11.5L9 16.5L18 6" stroke={G} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h2 className="fade-up" style={{ fontSize: "clamp(36px, 6vw, 64px)", fontWeight: "800", letterSpacing: "-0.02em", lineHeight: 1.05, marginBottom: "20px" }}>
                  Campaign is<br /><span style={{ color: G }}>being built.</span>
                </h2>
                <p className="fade-up-delay" style={{ fontSize: "15px", color: "#555", lineHeight: 1.7, maxWidth: "380px", marginBottom: "28px" }}>
                  Your lead list is being generated. Updates will arrive at{" "}
                  <span style={{ color: "#aaa" }}>{(answers.email as string) || "your inbox"}</span>.
                </p>
                {confirmUrl && (
                  <div className="fade-up-delay-2">
                    <a href={confirmUrl} style={{ display: "inline-block", padding: "12px 28px", border: `1px solid ${G}`, color: G, textDecoration: "none", fontSize: "11px", fontFamily: "'Syne', sans-serif", fontWeight: "700", letterSpacing: "0.12em", textTransform: "uppercase", borderRadius: "2px" }}>
                      Track Campaign →
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── QUESTION STEPS ── */}
      {current.type !== "welcome" && current.type !== "confirm" && (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: "80px clamp(24px, 8vw, 120px)", maxWidth: "760px" }}>
          <div key={animKey}>

            <div className="fade-up" style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
              <div className="dot-blink" style={{ width: "7px", height: "7px", borderRadius: "50%", background: G }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: G, letterSpacing: "0.18em", textTransform: "uppercase" }}>
                Reach AI
              </span>
            </div>

            <div className="fade-up" style={{ marginBottom: "40px" }}>
              {current.label && (
                <p style={{ fontSize: "14px", color: MUTED, marginBottom: "10px" }}>{current.label}</p>
              )}
              <h2 style={{ fontSize: "clamp(24px, 4vw, 38px)", fontWeight: "700", letterSpacing: "-0.015em", lineHeight: 1.2 }}>
                {current.question}
              </h2>
            </div>

            {current.type === "text" && (
              <div className="fade-up-delay">
                {current.hint && (
                  <p style={{ fontSize: "12px", color: "#333", lineHeight: 1.7, marginBottom: "20px", maxWidth: "560px", fontStyle: "italic" }}>{current.hint}</p>
                )}
                <input
                  ref={inputRef}
                  className="intake-input"
                  type={current.inputType ?? "text"}
                  value={val}
                  onChange={(e) => setVal(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && canNext()) void saveAndNext(); }}
                  placeholder={current.placeholder}
                />
              </div>
            )}

            {current.type === "textarea" && (
              <div className="fade-up-delay">
                {current.hint && (
                  <p style={{ fontSize: "12px", color: "#333", lineHeight: 1.7, marginBottom: "20px", maxWidth: "560px", fontStyle: "italic" }}>{current.hint}</p>
                )}
                <textarea
                  ref={inputRef as unknown as React.RefObject<HTMLTextAreaElement>}
                  className="intake-textarea"
                  value={val}
                  onChange={(e) => setVal(e.target.value)}
                  placeholder={current.placeholder}
                  rows={current.id === "painPoint" ? 5 : 3}
                />
              </div>
            )}

            {(current.type === "chips" || current.type === "radio") && (
              <div className="fade-up-delay" style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {(current.options ?? []).map((o) => (
                  <button key={o} className={`chip-btn${chips.includes(o) ? " active" : ""}`} onClick={() => toggleChip(o)}>{o}</button>
                ))}
              </div>
            )}

            {current.type === "tags" && (
              <div className="fade-up-delay">
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "20px" }}>
                  {(current.suggestions ?? []).filter((s) => !tags.includes(s)).map((s) => (
                    <button key={s} className="sugg-pill" onClick={() => addTag(s)}>+ {s}</button>
                  ))}
                </div>
                {tags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
                    {tags.map((t) => (
                      <span key={t} className="tag-item">
                        {t}
                        <span className="tag-x" onClick={() => setTags((prev) => prev.filter((x) => x !== t))}>×</span>
                      </span>
                    ))}
                  </div>
                )}
                <input
                  ref={inputRef}
                  className="intake-input"
                  value={val}
                  onChange={(e) => setVal(e.target.value)}
                  placeholder={current.placeholder}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(val); setVal(""); } }}
                />
              </div>
            )}

            {current.type === "slider" && (
              <div className="fade-up-delay">
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "clamp(48px, 8vw, 80px)", fontWeight: "500", color: G, letterSpacing: "-0.03em", marginBottom: "28px", lineHeight: 1 }}>
                  {slider}
                  <span style={{ fontSize: "18px", color: "#333", marginLeft: "12px", fontWeight: "300" }}>leads</span>
                </div>
                <input type="range" min={current.min} max={current.max} step={current.step} value={slider} onChange={(e) => setSlider(Number(e.target.value))} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px" }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#2A2A2A" }}>{current.min}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#2A2A2A" }}>{current.max}</span>
                </div>
              </div>
            )}

            <div className="fade-up-delay-2" style={{ marginTop: "52px", display: "flex", alignItems: "center", gap: "24px" }}>
              <button className="cta-btn" onClick={saveAndNext} disabled={!canNext() || isLoading}>
                {isLoading ? "Submitting…" : "Continue →"}
              </button>
              {step > 1 && (
                <button className="back-btn" onClick={() => setStep((s) => s - 1)}>← Back</button>
              )}
            </div>

            <p style={{ marginTop: "40px", fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#222", letterSpacing: "0.1em" }}>
              {step} / {STEPS.length - 2}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
