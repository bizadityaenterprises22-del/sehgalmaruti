import { useEffect, useRef, useState } from "react";
import { saveInteraction } from "@/app/api";
import { useUi } from "@/app/store";
import type { InteractionKind, SenseField } from "@/app/types";
import { useVisits } from "@/hooks/useQueries";
import { Badge, Button, Field, Note, Section, Select, TextArea, flash } from "@/components/ui";
import { VOCAB_VERSION, extract, suggestFollowUps, type SenseResult } from "@/lib/sense";
import { todayIst } from "@/lib/dates";

/*
  SEHGAL SENSE - consented conversation notes for a visit.

  start (consent) -> visible LISTENING bar -> speech to text -> keep only car sentences ->
  draft fields with confidence + the sentence they came from -> the employee reviews,
  removes, corrects -> saves to the visit -> follow-ups saved only if ticked.

  No raw audio is kept by this app. Speech-to-text uses the browser's speech service when
  the device has one (Chrome sends audio to Google to do it - said on screen); otherwise the
  phone keyboard's microphone fills the text box. Nothing runs when this screen is closed,
  the phone is locked, or the person presses Stop. No message, booking or price leaves here.
*/

type Rec = {
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
};

function makeRecognizer(): Rec | null {
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  const C = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return C ? new C() : null;
}

const KIND_BY_ROLE: Record<string, InteractionKind> = { sales: "note", sa: "service_note", technician: "tech_note" };

export default function SensePage() {
  const me = useUi((s) => s.me)!;
  const locationId = useUi((s) => s.locationId);
  const { data: visits = [] } = useVisits(me.rank >= 50 ? { locationId, day: todayIst() } : { assignedTo: me.profile_id, open: true });
  const [visitId, setVisitId] = useState("");
  const [consent, setConsent] = useState(false);
  const [lang, setLang] = useState("hi-IN");
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const [result, setResult] = useState<SenseResult | null>(null);
  const [fields, setFields] = useState<SenseField[]>([]);
  const [follow, setFollow] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const rec = useRef<Rec | null>(null);
  const supported = typeof window !== "undefined" && !!makeRecognizer();

  // a hidden or locked screen stops listening - no background capture
  useEffect(() => {
    const off = () => {
      if (document.visibilityState === "hidden") rec.current?.stop();
    };
    document.addEventListener("visibilitychange", off);
    return () => {
      document.removeEventListener("visibilitychange", off);
      rec.current?.stop();
    };
  }, []);

  function start() {
    if (!consent) return flash("Ask the customer first and tick consent.", "warn");
    const r = makeRecognizer();
    if (!r) return flash("This device has no speech service here. Use the keyboard microphone in the box below.", "warn");
    r.continuous = true;
    r.interimResults = false;
    r.lang = lang;
    r.onresult = (e) => {
      let add = "";
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) add += e.results[i][0].transcript + ". ";
      if (add) setText((t) => (t + " " + add).trim());
    };
    r.onerror = (e) => {
      flash(e.error === "not-allowed" ? "Microphone permission refused - nothing was recorded." : `Speech: ${e.error}`, "warn");
      setListening(false);
    };
    r.onend = () => setListening(false);
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch (e) {
      flash((e as Error).message, "danger");
    }
  }

  function stop() {
    rec.current?.stop();
    setListening(false);
  }

  function analyse() {
    const r = extract(text);
    setResult(r);
    setFields(r.fields);
    setFollow(Object.fromEntries(suggestFollowUps(r).map((s) => [s, false])));
  }

  function discard() {
    stop();
    setText("");
    setResult(null);
    setFields([]);
    setFollow({});
    flash("Discarded - nothing saved.");
  }

  async function save() {
    const v = visits.find((x) => x.id === visitId);
    if (!v) return flash("Choose the visit this conversation belongs to.", "warn");
    if (!result) return;
    setBusy(true);
    try {
      const kind = KIND_BY_ROLE[me.role ?? ""] ?? "note";
      await saveInteraction({
        visit_id: v.id,
        customer_id: v.customer_id,
        location_id: v.location_id,
        kind,
        body: result.relevant.join(" "),
        fields: { items: fields, unclear: result.unclear, vocab: VOCAB_VERSION },
        source: "sense",
        consent: true,
        confirmed: true,
        is_test: v.is_test,
      });
      const due = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      for (const [s, on] of Object.entries(follow)) {
        if (on) await saveInteraction({ visit_id: v.id, customer_id: v.customer_id, location_id: v.location_id, kind: "follow_up", body: s, due_at: due, is_test: v.is_test });
      }
      flash("Saved to the visit (reviewed by you)");
      setText("");
      setResult(null);
      setFields([]);
      setFollow({});
    } catch (e) {
      flash((e as Error).message, "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1000px] space-y-4 p-4">
      {listening ? (
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-xl bg-danger px-4 py-3 font-extrabold text-white shadow-lg">
          <span className="animate-pulse">● LISTENING - the customer has agreed</span>
          <Button tone="secondary" size="sm" onClick={stop}>
            Stop
          </Button>
        </div>
      ) : null}
      <Section title="Conversation notes" sub={`Vocabulary ${VOCAB_VERSION}. Keeps only car-related sentences; you review before anything is saved.`}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Visit">
            <Select value={visitId} onChange={(e) => setVisitId(e.target.value)}>
              <option value="">— choose —</option>
              {visits.map((v) => (
                <option key={v.id} value={v.id}>
                  #{v.visit_no} · {v.visitor_name ?? "visitor"} · {v.purpose}
                  {v.is_test ? " · TEST" : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Language heard">
            <Select value={lang} onChange={(e) => setLang(e.target.value)}>
              <option value="hi-IN">Hindi / mixed</option>
              <option value="en-IN">English (India)</option>
              <option value="mr-IN">Marathi</option>
            </Select>
          </Field>
          <label className="flex items-end gap-2 pb-2 text-[13px] font-bold">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> Customer agreed to notes being taken
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {!listening ? (
            <Button tone="danger" onClick={start} disabled={!supported}>
              🎙 Start listening
            </Button>
          ) : (
            <Button tone="secondary" onClick={stop}>
              ■ Stop
            </Button>
          )}
          <Button tone="secondary" onClick={analyse} disabled={!text.trim()}>
            Make draft notes
          </Button>
          <Button tone="ghost" onClick={discard}>
            Discard everything
          </Button>
        </div>
        <TextArea
          rows={5}
          className="mt-3"
          placeholder={supported ? "The words appear here. You can also type, or use the keyboard microphone." : "Use the keyboard microphone or type here."}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Note>
          {supported
            ? "Speech-to-text here uses this browser's speech service; in Chrome that service is Google's and the audio goes to Google to be turned into words. This app keeps no audio."
            : "This device offers no speech service inside the app. Use the microphone on your keyboard; we keep only the text you approve."}{" "}
          A word list cannot make a microphone hear only car words - we first turn speech into text, then keep only the car sentences.
        </Note>
      </Section>

      {result ? (
        <Section title="Review the draft" sub={`${result.relevant.length} sentences kept · ${result.dropped} dropped as unrelated. Remove anything wrong before saving.`}>
          {fields.length === 0 ? <p className="text-sm text-muted">No car-related details found.</p> : null}
          <div className="space-y-2">
            {fields.map((f, i) => (
              <div key={`${f.key}-${i}`} className="flex flex-wrap items-start gap-2 rounded-lg border border-line bg-surface p-2 text-[13px]">
                <Badge tone={f.confidence >= 0.75 ? "ok" : "warn"}>{f.key.replace(/_/g, " ")}</Badge>
                <input
                  className="w-40 rounded border border-line bg-raised px-2 py-0.5 font-bold"
                  value={f.value}
                  onChange={(e) => setFields(fields.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                />
                <span className="text-[11px] text-muted">{Math.round(f.confidence * 100)}%</span>
                <span className="flex-1 text-[12px] italic text-muted">“{f.excerpt}”</span>
                <button type="button" className="text-[12px] font-bold text-danger" onClick={() => setFields(fields.filter((_, j) => j !== i))}>
                  remove
                </button>
              </div>
            ))}
          </div>
          {result.unclear.length ? (
            <Note tone="warn">Unclear (not saved as fields): {result.unclear.join(" · ")}</Note>
          ) : null}
          {Object.keys(follow).length ? (
            <div className="mt-3 space-y-1">
              <div className="text-[12px] font-bold uppercase text-muted">Suggested follow-ups (saved only if ticked, for you, due tomorrow)</div>
              {Object.keys(follow).map((s) => (
                <label key={s} className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={follow[s]} onChange={(e) => setFollow({ ...follow, [s]: e.target.checked })} /> {s}
                </label>
              ))}
            </div>
          ) : null}
          <div className="mt-3 flex justify-end">
            <Button busy={busy} onClick={() => void save()} disabled={!visitId}>
              I have checked it - save to the visit
            </Button>
          </div>
        </Section>
      ) : null}
    </div>
  );
}
