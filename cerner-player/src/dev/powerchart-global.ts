import { DEMO_CHART, installMockPowerChart } from "./mock-powerchart";

/**
 * Classic-script entry the dev server bundles and serves as
 * /mock-powerchart-global.js. It is injected first in <head> of every example
 * MPage under /cerner-examples (and component-host.html), so the bridge
 * exists before the page's own scripts run — as PowerChart arranges it.
 *
 * Everything a page probes for is installed: window.external.XMLCclRequest
 * and the global constructor, DiscernObjectFactory, MPAGES_EVENT, APPLINK,
 * CCLLINK, MPAGES_SVC_EVENT, and simulated Discern Web Services. CCL is
 * answered by @webforms/cerner-sim.
 */
installMockPowerChart(DEMO_CHART, (line) => console.info("[mock-powerchart]", line), { globals: true });
