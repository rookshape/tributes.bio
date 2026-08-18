import { Flag, LoaderCircle, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { submitContentReport, type ReportCategory } from "../lib/reports";
import type { CreatorLink, CreatorProfile } from "../lib/types";

type ReportDialogProps = {
  links: CreatorLink[];
  onClose: () => void;
  profile: CreatorProfile;
};

const fieldClass =
  "field py-2.5";

export function ReportDialog({ links, onClose, profile }: ReportDialogProps) {
  const [target, setTarget] = useState("profile");
  const [category, setCategory] = useState<ReportCategory>("spam");
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const isProfile = target === "profile";
    try {
      await submitContentReport({
        creatorId: profile.id,
        targetType: isProfile ? "profile" : "link",
        targetId: isProfile ? null : target,
        category,
        details,
        reporterEmail: email,
      });
      setSubmitted(true);
    } catch {
      setError("Could not submit this report.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/25 px-4 backdrop-blur-md" role="presentation">
      <section aria-labelledby="report-title" aria-modal="true" className="glass-panel w-full max-w-md p-5 text-left text-ink" role="dialog">
        <div className="flex items-center justify-between gap-4 border-b border-sky/60 pb-4">
          <h2 className="flex items-center gap-2 font-semibold" id="report-title"><Flag size={17} /> Report content</h2>
          <button aria-label="Close report" className="icon-button h-9 w-9" onClick={onClose} title="Close" type="button"><X size={18} /></button>
        </div>

        {submitted ? (
          <div className="py-8">
            <p className="font-semibold">Report submitted</p>
            <button className="primary-button mt-5" onClick={onClose} type="button">Done</button>
          </div>
        ) : (
          <form className="mt-5 grid gap-4" onSubmit={submit}>
            <label className="grid gap-1.5 text-sm font-medium">
              Content
              <select className={fieldClass} onChange={(event) => setTarget(event.target.value)} value={target}>
                <option value="profile">Profile</option>
                {links.map((link) => <option key={link.id} value={link.id}>{link.title}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Reason
              <select className={fieldClass} onChange={(event) => setCategory(event.target.value as ReportCategory)} value={category}>
                <option value="spam">Spam</option>
                <option value="scam">Scam or fraud</option>
                <option value="impersonation">Impersonation</option>
                <option value="harassment">Harassment</option>
                <option value="prohibited_content">Prohibited content</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Details
              <textarea className={`${fieldClass} min-h-24 resize-y`} maxLength={500} onChange={(event) => setDetails(event.target.value)} value={details} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Email <span className="font-normal text-zinc-500">Optional</span>
              <input className={fieldClass} onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
            </label>
            {error ? <p className="status-error">{error}</p> : null}
            <button className="primary-button w-full" disabled={submitting} type="submit">
              {submitting ? <LoaderCircle className="animate-spin" size={17} /> : <Flag size={17} />}
              Submit report
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
