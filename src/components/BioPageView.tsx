import type { ReactNode } from "react";
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

  // flex-1 lets the themed background fill a flex parent (the public page);
  // min-h-full covers fixed-height parents (the dashboard preview window).
  return (
    <div
      className="flex min-h-full w-full flex-1 flex-col px-5 py-10 sm:px-6"
      style={{ background: theme.background, color: theme.text }}
    >
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

        <div className="mt-auto flex items-center justify-center gap-4 pt-10 text-xs font-semibold opacity-55">
          <a
            href={preview ? undefined : "/"}
            onClick={preview ? (event) => event.preventDefault() : undefined}
          >
            tributes.bio
          </a>
          {!preview && onReport ? (
            <button onClick={onReport} type="button">Report</button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
