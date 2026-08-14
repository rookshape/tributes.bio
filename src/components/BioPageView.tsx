import type { ReactNode } from "react";
import type { CreatorLink, CreatorProfile } from "../lib/types";

type BioPageViewProps = {
  profile: CreatorProfile;
  links: CreatorLink[];
  preview?: boolean;
  onLinkClick?: (link: CreatorLink) => void;
  topContent?: ReactNode;
};

export function BioPageView({
  profile,
  links,
  preview = false,
  onLinkClick,
  topContent,
}: BioPageViewProps) {
  const { appearance } = profile;
  const visibleLinks = links.filter((link) => link.isActive);
  const buttonStyle = {
    backgroundColor:
      appearance.buttonStyle === "solid"
        ? appearance.buttonColor
        : "transparent",
    borderColor: appearance.buttonColor,
    color:
      appearance.buttonStyle === "solid"
        ? appearance.buttonTextColor
        : appearance.buttonColor,
  };

  return (
    <div
      className="flex min-h-full w-full flex-col px-5 py-10"
      style={{
        backgroundColor: appearance.backgroundColor,
        color: appearance.textColor,
      }}
    >
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col text-center">
        {profile.photoURL ? (
          <img
            alt={profile.displayName}
            className="mx-auto h-20 w-20 rounded-full object-cover"
            src={profile.photoURL}
          />
        ) : (
          <div
            aria-hidden="true"
            className="mx-auto grid h-20 w-20 place-items-center rounded-full text-2xl font-semibold"
            style={{
              backgroundColor: appearance.buttonColor,
              color: appearance.buttonTextColor,
            }}
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
              className="flex min-h-12 items-center justify-center border-2 px-4 py-3 text-sm font-semibold transition-transform hover:-translate-y-0.5"
              href={preview ? undefined : link.url}
              key={link.id}
              onClick={
                preview
                  ? (event) => event.preventDefault()
                  : () => onLinkClick?.(link)
              }
              rel="noreferrer noopener"
              style={buttonStyle}
              target={preview ? undefined : "_blank"}
            >
              {link.title}
            </a>
          ))}
        </div>

        <a
          className="mt-auto pt-10 text-xs font-semibold opacity-55"
          href={preview ? undefined : "/"}
          onClick={preview ? (event) => event.preventDefault() : undefined}
        >
          tributes.bio
        </a>
      </div>
    </div>
  );
}
