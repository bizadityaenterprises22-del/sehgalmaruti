import { Link, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { signIn } from "@/app/api";
import { useUi } from "@/app/store";
import { downloadWindowsDesktopLauncher } from "@/components/SmreZeroTrainingBar";
import { Badge, Button, Field, Input, Note } from "@/components/ui";

declare const __APP_VERSION__: string;

/**
 * Login. The same identity as Sehgal Hero: a bare login code (CEO, GUARD1, an employee
 * number) and the password that goes with it. Nothing is typed twice, nothing is stored
 * here; Supabase Auth issues the session and Row Level Security decides the rows.
 */
export default function LoginPage({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  const navigate = useNavigate();
  const status = useUi((s) => s.status);
  const error = useUi((s) => s.error);
  const setStatus = useUi((s) => s.setStatus);
  const setMe = useUi((s) => s.setMe);
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [smreName, setSmreName] = useState("Sunita");
  const [slow, setSlow] = useState(false);
  const busy = status === "signing-in";

  function startZeroTrainingCalling(stream: "Insurance" | "Periodic Maintenance Services") {
    const clean = (smreName || "Sunita").trim();
    if (typeof window !== "undefined") {
      window.localStorage.setItem("sehgal_maruti_smre_name", clean);
    }
    setMe({
      profile_id: "smre-zero-training-session",
      login_code: "SMRE",
      display_name: clean,
      home_org_id: "sehgal-maruti",
      is_platform_admin: false,
      tenant: null,
      tenants: null,
      role: "ccm",
      rank: 50,
      designation: `SMRE Calling (${stream} · 100 Calls/Day)`,
      location_ids: null,
      can_manage_drivers: false,
      is_admin: false,
    });
    setStatus("signed-in");
    navigate(stream === "Insurance" ? "/g/insurance/ins-workbench?tab=workbench" : "/crm-pms?mode=smr&tab=workbench");
  }

  useEffect(() => {
    if (!busy) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), 3000);
    return () => clearTimeout(t);
  }, [busy]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setStatus("signing-in");
    try {
      await signIn(id, pw);
      await onSignedIn();
    } catch (err) {
      setStatus("signed-out", (err as Error).message);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-surface px-4 py-8 text-ink sm:px-6">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-5 text-center">
          <div className="mx-auto flex justify-center">
            <img
              src="/brand/sehgal-autoriders-logo.svg"
              alt="Sehgal Autoriders"
              className="h-16 w-auto object-contain dark:hidden"
            />
            <img
              src="/brand/sehgal-autoriders-logo-on-dark.svg"
              alt="Sehgal Autoriders"
              className="hidden h-16 w-auto object-contain dark:block"
            />
          </div>
          <div className="mt-3 flex justify-center">
            <Badge tone="brand">SEHGAL AUTORIDERS · MARUTI SUZUKI · HR &amp; CALLING</Badge>
          </div>
          <h1 className="mt-2 text-[25px] font-extrabold tracking-tight">Sehgal Maruti</h1>
          <p className="mt-0.5 text-[12.5px] text-muted">
            Workshop Operations · Sehgal HR (All-India Manpower &amp; Calling) · CRM (SMR · PSF) · Insurance
          </p>
        </div>

        {/* ZERO-TRAINING SMRE CALLING LAUNCHER (100 CALLS/DAY CAP · WINDOWS DESKTOP VERSION) */}
        <div className="mb-4 space-y-2.5 rounded-xl border-2 border-emerald-500/50 bg-emerald-500/10 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <Badge tone="ok">⚡ ZERO-TRAINING SMRE CALLING (100 CALLS / DAY)</Badge>
            <Badge tone="warn">📌 CUSTOMER STAMPED TO YOU</Badge>
          </div>
          <div className="text-[13px] font-bold text-ink">
            No Training Needed · Sit, Download Windows Version, Enter Your Name &amp; Start Calling Your 100 High-Conversion Customers
          </div>
          <Field label="Enter SMRE Caller Name">
            <Input
              value={smreName}
              onChange={(e) => setSmreName(e.target.value)}
              placeholder="e.g. Sunita, Sonali Markad, Kavita Jadhav, Pooja Kadam"
            />
          </Field>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button tone="primary" onClick={() => startZeroTrainingCalling("Insurance")}>
              🛡️ Start Maruti Insurance (100 Calls)
            </Button>
            <Button tone="ok" onClick={() => startZeroTrainingCalling("Periodic Maintenance Services")}>
              🔧 Start Periodic Maintenance (100 Calls)
            </Button>
          </div>
          <Button
            tone="secondary"
            full
            onClick={() => downloadWindowsDesktopLauncher(smreName, "Insurance", "ALL")}
          >
            💻 Download Windows Version (.bat Desktop App)
          </Button>
        </div>

        <form className="space-y-4 rounded-xl border border-line bg-raised p-5 shadow-sm" onSubmit={submit}>
          <Field label="Employee Login ID">
            <Input
              value={id}
              onChange={(e) => setId(e.target.value)}
              type="text"
              autoComplete="username"
              placeholder="CEO or Employee No."
              autoCapitalize="characters"
              required
            />
          </Field>
          <Field label="Password">
            <Input value={pw} onChange={(e) => setPw(e.target.value)} type="password" autoComplete="current-password" required />
          </Field>
          {error ? <Note tone="danger">{error}</Note> : null}
          <Button type="submit" full size="lg" busy={busy}>
            {busy ? (slow ? "Still checking…" : "Signing in…") : "Sign in to Sehgal Maruti"}
          </Button>
        </form>

        <div className="mt-4 flex flex-col gap-2 text-center">
          <p className="text-[12px] text-muted">
            Sign in with your Sehgal employee login ID and password.
          </p>
          <p className="text-[13px]">
            <Link to="/plan/wiring" className="font-bold text-accent underline-offset-2 hover:underline">
              See the plan of the whole app (no data) →
            </Link>
          </p>
          <p className="text-[11px] text-muted/70">Build {__APP_VERSION__}</p>
        </div>
      </div>
    </div>
  );
}
