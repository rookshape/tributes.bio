import { Check, SquareArrowOutUpRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { CreatorLink, CreatorProfile } from "../lib/types";
import { derivePageTheme, glassSurface } from "../lib/pageThemes";

type BioPageViewProps = {
  profile: CreatorProfile;
  links: CreatorLink[];
  preview?: boolean;
  onLinkClick?: (link: CreatorLink) => void;
  onReport?: () => void;
  topContent?: ReactNode;
};

export function BioPageView({
  profile,
  links,
  preview = false,
  onLinkClick,
  onReport,
  topContent,
}: BioPageViewProps) {
  const theme = derivePageTheme(profile.appearance);
  const visibleLinks = links.filter((link) => link.isActive);
  const linkStyle = glassSurface(theme);
  const [shared, setShared] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const pageUrl = `${window.location.origin}/${profile.username}`;

  /**
   * Share sheet where there is one, clipboard otherwise, and if both are
   * unavailable — blocked permissions, an embedded browser, a hung request —
   * the URL is revealed so it can be copied by hand. The clipboard promise is
   * raced against a timeout because a blocked one can hang indefinitely, which
   * would otherwise leave the button looking dead.
   */
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: profile.displayName, url: pageUrl });
        return;
      } catch {
        // Cancelled or unsupported — fall through to copying.
      }
    }

    try {
      await Promise.race([
        navigator.clipboard.writeText(pageUrl),
        new Promise((_, reject) => window.setTimeout(reject, 1500)),
      ]);
      setShared(true);
      window.setTimeout(() => setShared(false), 1800);
    } catch {
      setShowUrl(true);
    }
  };

  // flex-1 lets the themed background fill a flex parent (the public page);
  // min-h-full covers fixed-height parents (the dashboard preview window).
  return (
    <div
      className="relative flex min-h-full w-full flex-1 flex-col px-5 py-10 sm:px-6"
      style={{ background: theme.background, color: theme.text }}
    >
      {!preview ? (
        <div className="absolute right-4 top-4 z-10 flex flex-col items-end gap-2">
          <button
            aria-label="Share this page"
            className="grid h-10 w-10 place-items-center rounded-full border backdrop-blur-md"
            onClick={share}
            style={linkStyle}
            title="Share this page"
            type="button"
          >
            {shared ? <Check size={16} /> : <SquareArrowOutUpRight size={16} />}
          </button>
          {showUrl ? (
            <input
              aria-label="Your page link"
              className="w-56 rounded-full border px-3 py-1.5 text-center text-xs backdrop-blur-md"
              onFocus={(event) => event.target.select()}
              readOnly
              style={linkStyle}
              value={pageUrl}
            />
          ) : null}
        </div>
      ) : null}

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col text-center">
        {profile.photoURL ? (
          <img
            alt={profile.displayName}
            className="mx-auto h-20 w-20 rounded-full object-cover ring-4 ring-white/40"
            src={profile.photoURL}
          />
        ) : (
          <div
            aria-hidden="true"
            className="mx-auto grid h-20 w-20 place-items-center rounded-full border text-2xl font-semibold backdrop-blur-md"
            style={linkStyle}
          >
            {profile.displayName.charAt(0).toUpperCase() || "T"}
          </div>
        )}

        <h1 className="mt-5 text-2xl font-semibold">{profile.displayName}</h1>
        <p className="mt-1 text-sm opacity-65">@{profile.username}</p>
        {profile.bio ? (
          <p className="mx-auto mt-4 max-w-md whitespace-pre-wrap text-sm leading-6 opacity-85">
            {profile.bio}
          </p>
        ) : null}

        {topContent}

        <div className="mt-7 grid gap-3">
          {visibleLinks.map((link) => (
            <a
              className="flex min-h-12 items-center justify-center rounded-2xl border px-4 py-3 text-sm font-semibold backdrop-blur-md transition-transform duration-fast ease-standard hover:-translate-y-0.5"
              href={preview ? undefined : link.url}
              key={link.id}
              onClick={
                preview
                  ? (event) => event.preventDefault()
                  : () => onLinkClick?.(link)
              }
              rel="noreferrer noopener"
              style={linkStyle}
              target={preview ? undefined : "_blank"}
            >
              {link.title}
            </a>
          ))}
        </div>

        <div className="mt-auto flex flex-col items-center gap-3 pt-10">
          <a
            className="rounded-full border px-4 py-1.5 text-xs font-semibold backdrop-blur-md"
            href={preview ? undefined : "/"}
            style={linkStyle}
            onClick={preview ? (event) => event.preventDefault() : undefined}
          >
            tributes.bio
          </a>
          <div className="flex items-center gap-4 text-xs font-medium opacity-55">
            <a
              href={preview ? undefined : "/terms"}
              onClick={preview ? (event) => event.preventDefault() : undefined}
            >
              Terms of Service
            </a>
            {!preview && onReport ? (
              <button onClick={onReport} type="button">Report</button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
