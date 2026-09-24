import { FormStateProvider, MoisProvider, moisPreviewTheme } from "@mois/form-components";
import { ThemeProvider } from "@fluentui/react/lib/Theme";
import {
  CclClient,
  detectHostEnvironment,
  resolveChartContext,
  resolveSmartLaunchContext,
  type ChartId,
} from "@webforms/cerner-core";
import React, { useEffect, useMemo, useState } from "react";

import { TerraDemographicsBanner } from "./terra/TerraDemographicsBanner";
import { DemographicsBanner, TerraBase } from "@webforms/cerner-terra";

import { terraFluentTheme, TERRA_PAGE_BACKGROUND } from "./terra/terra-theme";
import "./terra/terra-tokens.scss";
import { DiscernActionsBar } from "./DiscernActionsBar";
import { FormHost, type FormIdentityLike } from "./FormHost";
import { MoisToastHost } from "./MoisToastHost";
import { TerraProbe } from "./terra/TerraProbe";
import { TerraFormView } from "./terra/TerraFormView";

const frameStyle: React.CSSProperties = {
  backgroundColor: "#fff",
  color: "#323130",
  fontFamily: '"Segoe UI", "Segoe UI Web (West European)", Arial, sans-serif',
  fontSize: 14,
  lineHeight: 1.3,
  minHeight: "100vh",
  padding: "12px 16px",
};

interface PersonAlias {
  alias?: string;
  aliasType?: string;
}

/**
 * Spelled-out titles for the abbreviated alias types the banner prints, keyed
 * by the uppercased type because `alias_type` is a site-configured code
 * display (nh_wf_entry.prg reads it through uar_get_code_display). Terra takes
 * these as `identifiersLongForm` and announces them in place of the
 * abbreviation; a type with no entry — or one that is already a word, like our
 * own "Encounter" — keeps its label as-is, which is Terra's own fallback.
 */
const IDENTIFIER_LONG_FORMS: Record<string, string> = {
  "FIN NBR": "Financial Number",
  MRN: "Medical Record Number",
  PHN: "Personal Health Number",
};

interface PersonRecord {
  age?: string;
  gender?: string;
  birthDtTm?: string;
  nameFirst?: string;
  aliases?: PersonAlias[];
}

interface LoadedForm {
  source: string;
  identity: FormIdentityLike;
}

declare global {
  interface Window {
    /** Baked into exported MPage bundles so the deployed page needs no query string. */
    WEBFORMS_PLAYER_CONFIG?: { formId?: string; theme?: string };
  }
}

/** Host element when running as a Workflow custom element; null full-page. */
export type PlayerHost = { getAttribute(name: string): string | null } | null;

function hostAttribute(host: PlayerHost, ...names: string[]): string | null {
  if (!host) return null;
  for (const name of names) {
    const value = host.getAttribute(name);
    if (value) return value;
  }
  return null;
}

function formBaseUrl(host: PlayerHost): string {
  const params = new URLSearchParams(window.location.search);
  const formId =
    params.get("formId") ||
    hostAttribute(host, "form-id", "form_id") ||
    window.WEBFORMS_PLAYER_CONFIG?.formId ||
    "demo";
  const explicit = params.get("formUrl");
  if (explicit) return explicit.replace(/\/$/, "");
  // Embedded in someone else's page, "./" resolves against the host page.
  // Cerner's component framework passes our deployed folder as `path`
  // (custom-components.js renders <tag title="..." path="{url}">), so that
  // name comes first; content-root is our own alias for other hosts.
  const contentRoot = hostAttribute(host, "path", "content-root", "content_root");
  const prefix = contentRoot ? contentRoot.replace(/\/$/, "") : ".";
  return prefix + "/forms/" + encodeURIComponent(formId);
}

async function loadForm(host: PlayerHost): Promise<LoadedForm> {
  const base = formBaseUrl(host);
  const sourceResponse = await fetch(base + "/index.jsx");
  if (!sourceResponse.ok) {
    throw new Error("Could not load " + base + "/index.jsx (" + sourceResponse.status + ")");
  }
  const source = await sourceResponse.text();
  let identity: FormIdentityLike = { name: "form", title: "Web Form" };
  const identityResponse = await fetch(base + "/Identity.json").catch(() => null);
  if (identityResponse?.ok) {
    identity = (await identityResponse.json()) as FormIdentityLike;
  }
  return { source, identity };
}

const StatusBar: React.FC<{ inPowerChart: boolean; mock: boolean; chart: ChartId | null }> = ({
  inPowerChart,
  mock,
  chart,
}) => (
  <div
    style={{
      background: inPowerChart ? "#e8f1e8" : "#fdf3e7",
      border: "1px solid " + (inPowerChart ? "#9bc19b" : "#e8b873"),
      borderRadius: 2,
      fontSize: 12,
      marginBottom: 12,
      padding: "6px 10px",
    }}
  >
    {inPowerChart
      ? mock
        ? "Simulated PowerChart bridge (mock XMLCclRequest)"
        : "Running inside PowerChart"
      : "Standalone browser mode (no CCL bridge)"}
    {chart?.nameFullFormatted
      ? " — chart: " + chart.nameFullFormatted + " (person " + chart.personId + ", encounter " + chart.encntrId + ")"
      : ""}
  </div>
);

export const App: React.FC<{ host?: PlayerHost }> = ({ host = null }) => {
  const [form, setForm] = useState<LoadedForm | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chart, setChart] = useState<ChartId | null>(null);
  const [mock, setMock] = useState(false);
  const [client, setClient] = useState<CclClient | null>(null);
  const [person, setPerson] = useState<PersonRecord | null>(null);

  const environment = useMemo(() => detectHostEnvironment(window), []);
  const context = useMemo(
    () =>
      resolveChartContext({
        search: window.location.search,
        element: host ?? undefined,
      }),
    [host],
  );
  /**
   * SMART's `need_patient_banner`, read from the same launch URL and host
   * element the chart ids come from. This page has no token response — it is
   * the MPage/component target, not the SMART one — but it is embedded in
   * exactly the situation the flag describes: a Workflow page or a chart tab
   * that already draws PowerChart's banner bar above us. A registration that
   * says `need-patient-banner="false"` (or `?needPatientBanner=0`) gets one
   * banner instead of two; saying nothing keeps ours, as it always has.
   *
   * `smart_style_url` is not read here on purpose: it names a document we go
   * and fetch, so it is only trusted from the authenticated token response,
   * which reaches the SMART page (src/smart/app.tsx) and not this one.
   */
  const launch = useMemo(
    () =>
      resolveSmartLaunchContext({
        search: window.location.search,
        element: host ?? undefined,
      }),
    [host],
  );

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      let simulated = false;
      if (!environment.inPowerChart) {
        const params = new URLSearchParams(window.location.search);
        const wantsMock =
          params.get("mock") === "1" ||
          window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1";
        if (wantsMock) {
          const { installMockPowerChart } = await import("./dev/mock-powerchart");
          installMockPowerChart();
          simulated = true;
        }
      }
      if (cancelled) return;
      setMock(simulated);

      if (environment.inPowerChart || simulated) {
        const cclClient = new CclClient({
          scriptName: "nh_wf_entry:group1",
          personId: context.personId,
          encntrId: context.encntrId,
          windowRef: window,
        });
        setClient(cclClient);
        cclClient
          .execute({
            patientSource: [{ personId: context.personId, encntrId: context.encntrId }],
            person: { aliases: true },
            encounter: { aliases: true },
          })
          .then((reply) => {
            if (cancelled) return;
            if (reply.chartId) setChart(reply.chartId);
            const person = (reply.persons as PersonRecord[] | undefined)?.[0];
            if (person) setPerson(person);
          })
          .catch((e) => console.warn("CCL chart load failed:", e));
      }

      loadForm(host).then(
        (loaded) => {
          if (!cancelled) setForm(loaded);
        },
        (e) => {
          if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
        },
      );
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [environment, context, host]);

  const terraTarget = useMemo(
    () => new URLSearchParams(window.location.search).get("render") === "terra",
    [],
  );

  const cernerLook = useMemo(() => {
    const fromQuery = new URLSearchParams(window.location.search).get("theme");
    return (
      (fromQuery || hostAttribute(host, "theme") || window.WEBFORMS_PLAYER_CONFIG?.theme) ===
      "cerner"
    );
  }, [host]);

  // Validation errors from the generated form's dispatch surface as toasts.
  // SourceData has no errorDispatch member in its type, but MoisProvider
  // spreads custom sourceData into the context the form reads.
  const moisSourceData = useMemo(
    () =>
      ({
        errorDispatch: (event: { message?: string }) => {
          window.dispatchEvent(
            new CustomEvent("mois-toast", {
              detail: event?.message ?? "Something went wrong",
            }),
          );
        },
      }) as never,
    [],
  );

  // Terra's own DemographicsBanner in the Terra target; the Fluent-era
  // reproduction stays on the MOIS path, which has no terra-base to size it.
  const BannerComponent = terraTarget ? DemographicsBanner : TerraDemographicsBanner;
  const encounterId = chart?.encntrId;
  const banner = useMemo(() => {
    const entries: Array<[string, string]> = (person?.aliases ?? [])
      .filter((alias) => alias.alias)
      .map((alias) => [alias.aliasType ?? "ID", String(alias.alias)]);
    if (encounterId) entries.push(["Encounter", String(encounterId)]);
    const longForm: Record<string, string> = {};
    for (const [label] of entries) {
      const spelled = IDENTIFIER_LONG_FORMS[label.toUpperCase()];
      if (spelled) longForm[label] = spelled;
    }
    return { identifiers: Object.fromEntries(entries), identifiersLongForm: longForm };
  }, [person?.aliases, encounterId]);

  const shell = (
    <ThemeProvider theme={cernerLook ? terraFluentTheme : moisPreviewTheme} applyTo="none">
      <div
        className={cernerLook ? "terra-root" : undefined}
        style={
          cernerLook
            ? {
                ...frameStyle,
                // In Terra mode <TerraBase> paints the document per terra-base
                // (#fff, as on Terra's own docs site); only the Fluent/MOIS
                // path wants the PowerChart chrome grey.
                backgroundColor: terraTarget ? undefined : TERRA_PAGE_BACKGROUND,
                fontFamily: undefined,
                fontSize: undefined,
              }
            : frameStyle
        }
      >
        {cernerLook ? (
          launch.needPatientBanner ? (
            <div style={{ margin: "-12px -16px 12px" }}>
              <BannerComponent
                personName={chart?.nameFullFormatted ?? "No patient in context"}
                age={person?.age}
                gender={person?.gender}
                dateOfBirth={person?.birthDtTm ? person.birthDtTm.substring(0, 10) : undefined}
                identifiers={banner.identifiers}
                identifiersLongForm={banner.identifiersLongForm}
              />
            </div>
          ) : null
        ) : (
          // Not a patient banner: the dev-mode strip that names which bridge
          // is live. It renders only outside the Cerner look.
          <StatusBar
            inPowerChart={environment.inPowerChart || mock}
            mock={mock}
            chart={chart}
          />
        )}
        {new URLSearchParams(window.location.search).get("terraProbe") === "1" ? (
          <TerraProbe />
        ) : null}
        {terraTarget ? (
          <TerraFormView
            documentUrl={
              new URLSearchParams(window.location.search).get("documentUrl") ??
              "./forms/hcc-ltc.workspace.json"
            }
            fromParent={new URLSearchParams(window.location.search).get("documentSource") === "parent"}
          />
        ) : loadError ? (
          <div style={{ color: "#a4262c" }}>Failed to load form: {loadError}</div>
        ) : !form ? (
          <div>Loading form…</div>
        ) : (
          <MoisProvider sourceData={moisSourceData}>
          <FormStateProvider>
            <FormHost source={form.source} identity={form.identity} />
            {client ? (
              <DiscernActionsBar
                client={client}
                context={{
                  personId: chart?.personId ?? context.personId,
                  encntrId: chart?.encntrId ?? context.encntrId,
                  prsnlId: context.prsnlId,
                }}
                formTitle={String(form.identity.title ?? form.identity.name ?? "Web Form")}
                formId={typeof form.identity.name === "string" ? form.identity.name : undefined}
              />
            ) : null}
          </FormStateProvider>
          </MoisProvider>
        )}
        <MoisToastHost />
      </div>
    </ThemeProvider>
  );

  // terra-base has to reach the document, so it wraps the shell rather than
  // sitting inside it. It is reference-counted, so TerraFormView keeping its
  // own <TerraBase> — which it needs to stand alone — is harmless.
  return terraTarget ? <TerraBase>{shell}</TerraBase> : shell;
};
