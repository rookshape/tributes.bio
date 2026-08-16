import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BioPageView } from "../components/BioPageView";
import { LiveSpinCard } from "../components/LiveSpinCard";
import { TributeForm } from "../components/TributeForm";
import { getCreatorByUsername } from "../lib/account";
import { trackCreatorLinkClick, trackProfileView } from "../lib/analytics";
import { getPublicCreatorLinks } from "../lib/bio";
import { getCreatorPaymentAvailability } from "../lib/payments";
import {
  getSpinConfig,
  spinSessionIsLive,
  subscribeSpinSession,
} from "../lib/spin";
import type {
  CreatorLink,
  CreatorProfile,
  SpinConfig,
  SpinSession,
} from "../lib/types";

export function PublicProfilePage() {
  const { username = "" } = useParams();
  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [links, setLinks] = useState<CreatorLink[]>([]);
  const [paymentsAvailable, setPaymentsAvailable] = useState(false);
  const [spinConfig, setSpinConfig] = useState<SpinConfig | null>(null);
  const [spinSession, setSpinSession] = useState<SpinSession | null>(null);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    getCreatorByUsername(username)
      .then(async (profile) => {
        if (
          !profile ||
          !profile.isPublished ||
          profile.moderationStatus !== "active"
        ) {
          return null;
        }

        const [publicLinks, paymentAvailability, spinConfig] = await Promise.all([
          getPublicCreatorLinks(profile.id),
          getCreatorPaymentAvailability(profile.id).catch(() => false),
          getSpinConfig(profile.id).catch(() => null),
        ]);
        return {
          profile,
          publicLinks,
          paymentAvailability,
          spinConfig,
        };
      })
      .then((page) => {
        if (active) {
          setCreator(page?.profile ?? null);
          setLinks(page?.publicLinks ?? []);
          setPaymentsAvailable(page?.paymentAvailability ?? false);
          setSpinConfig(page?.spinConfig ?? null);
        }
      })
      .catch(() => {
        if (active) {
          setCreator(null);
          setLinks([]);
          setPaymentsAvailable(false);
          setSpinConfig(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [username]);

  useEffect(() => {
    if (!creator) {
      setSpinSession(null);
      return;
    }

    return subscribeSpinSession(creator.id, setSpinSession);
  }, [creator]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!creator) {
      return;
    }

    const previousTitle = document.title;
    const description = creator.bio || `${creator.displayName} on Tributes`;
    document.title = `${creator.displayName} | Tributes`;
    trackProfileView(creator.id, creator.username);

    const metaValues = [
      ['meta[name="description"]', "name", "description", description],
      ['meta[property="og:title"]', "property", "og:title", document.title],
      [
        'meta[property="og:description"]',
        "property",
        "og:description",
        description,
      ],
      ['meta[property="og:type"]', "property", "og:type", "profile"],
      ['meta[property="og:url"]', "property", "og:url", window.location.href],
      ...(creator.photoURL
        ? [
            [
              'meta[property="og:image"]',
              "property",
              "og:image",
              creator.photoURL,
            ],
          ]
        : []),
    ] as const;

    const previousMeta = metaValues.map(
      ([selector, attribute, attributeValue, content]) => {
        let meta = document.querySelector<HTMLMetaElement>(selector);

        if (!meta) {
          meta = document.createElement("meta");
          meta.setAttribute(attribute, attributeValue);
          document.head.appendChild(meta);
        }

        const previousContent = meta.content;
        meta.content = content;
        return { meta, previousContent };
      },
    );

    return () => {
      document.title = previousTitle;
      previousMeta.forEach(({ meta, previousContent }) => {
        meta.content = previousContent;
      });
    };
  }, [creator]);

  if (loading) {
    return <div className="min-h-screen bg-paper" />;
  }

  if (!creator) {
    return (
      <main className="grid min-h-screen place-items-center bg-paper px-5 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Profile not found</h1>
          <Link className="mt-5 inline-block font-semibold text-tribute" to="/">
            Go home
          </Link>
        </div>
      </main>
    );
  }

  const spinAvailable = Boolean(
    paymentsAvailable &&
      spinConfig?.isEnabled &&
      spinSessionIsLive(spinSession, now),
  );

  return (
    <main className="min-h-screen">
      <BioPageView
        links={links}
        onLinkClick={(link) =>
          trackCreatorLinkClick(creator.id, creator.username, link.id)
        }
        profile={creator}
        topContent={
          paymentsAvailable || spinAvailable ? (
            <>
              {paymentsAvailable ? (
                <TributeForm
                  profile={creator}
                  result={
                    new URLSearchParams(window.location.search).get("payment") as
                      | "success"
                      | "canceled"
                      | null
                  }
                />
              ) : null}
              {spinAvailable ? (
                <LiveSpinCard config={spinConfig!} profile={creator} />
              ) : null}
            </>
          ) : null
        }
      />
    </main>
  );
}
