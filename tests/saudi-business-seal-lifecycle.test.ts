import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const lifecycleUrl = new URL(
  "../public/scripts/saudi-business-seal-lifecycle.js",
  import.meta.url,
);

type ObserverRecord = {
  callback: (mutations: Array<Record<string, unknown>>) => void;
  options: { attributeFilter?: string[]; attributes?: boolean; childList?: boolean; subtree?: boolean };
  target: FakeElement;
};

class FakeElement {
  readonly nodeType = 1;
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Array<() => void>>();
  readonly observers: ObserverRecord[] = [];
  readonly style: Record<string, string> = {};

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
    for (const observer of this.observers) {
      if (observer.options.attributes && observer.options.attributeFilter?.includes(name)) {
        observer.callback([{ attributeName: name }]);
      }
    }
  }

  removeAttribute(name: string) {
    this.attributes.delete(name);
  }

  addEventListener(name: string, listener: () => void) {
    const listeners = this.listeners.get(name) ?? [];
    listeners.push(listener);
    this.listeners.set(name, listeners);
  }

  dispatch(name: string) {
    this.listeners.get(name)?.forEach((listener) => listener());
  }

  querySelectorAll() {
    return [];
  }
}

class FakeIframe extends FakeElement {
  readonly contentWindow = {};

  matches(selector: string) {
    return selector === "iframe.sbc-seal-frame";
  }
}

async function createHarness() {
  const source = await readFile(lifecycleUrl, "utf8");
  const observers: ObserverRecord[] = [];
  const windowListeners = new Map<string, (event: Record<string, unknown>) => void>();
  const root = new FakeElement();
  root.setAttribute("lang", "ar");
  const container = new FakeElement();
  container.setAttribute("data-token", "isaudi-token");
  container.setAttribute("data-position", "bottom-left");
  const frames: FakeIframe[] = [];

  const document = {
    baseURI: "https://isaudi.ai/",
    documentElement: root,
    querySelectorAll(selector: string) {
      if (selector === ".sbc-verify-seal") return [container];
      if (selector === "iframe.sbc-seal-frame") return frames;
      return [];
    },
  };

  class FakeMutationObserver {
    constructor(readonly callback: ObserverRecord["callback"]) {}

    observe(target: FakeElement, options: ObserverRecord["options"]) {
      const record = { callback: this.callback, options, target };
      observers.push(record);
      target.observers.push(record);
    }
  }

  const context = vm.createContext({
    URL,
    Number,
    WeakSet,
    HTMLIFrameElement: FakeIframe,
    MutationObserver: FakeMutationObserver,
    Node: { ELEMENT_NODE: 1 },
    document,
    window: {
      addEventListener(name: string, listener: (event: Record<string, unknown>) => void) {
        windowListeners.set(name, listener);
      },
    },
  });
  vm.runInContext(source, context);

  function injectFrame(overrides: Partial<Record<"token" | "lang" | "pos" | "path" | "origin", string>> = {}) {
    const frame = new FakeIframe();
    const origin = overrides.origin ?? "https://eauthenticate.saudibusiness.gov.sa";
    const path = overrides.path ?? "/EAuthSealApi/seal";
    const query = new URLSearchParams({
      token: overrides.token ?? "isaudi-token",
      lang: overrides.lang ?? "ar",
      pos: overrides.pos ?? "bottom",
    });
    frame.setAttribute("src", `${origin}${path}?${query}`);
    frames.push(frame);
    const documentObserver = observers.find((observer) => observer.options.childList);
    documentObserver?.callback([{ addedNodes: [frame] }]);
    return frame;
  }

  function post(frame: FakeIframe, overrides: Record<string, unknown> = {}) {
    windowListeners.get("message")?.({
      origin: "https://eauthenticate.saudibusiness.gov.sa",
      source: frame.contentWindow,
      data: { sbcSeal: true, width: 120, height: 44 },
      ...overrides,
    });
  }

  return { container, injectFrame, post };
}

test("Saudi Business seal stays fail-closed until authenticated provider readiness", async () => {
  const source = await readFile(lifecycleUrl, "utf8");

  assert.match(source, /event\.origin !== PROVIDER_ORIGIN/);
  assert.match(source, /event\.data\.sbcSeal !== true/);
  assert.match(source, /event\.source !== frame\.contentWindow/);
  assert.match(source, /url\.origin !== PROVIDER_ORIGIN/);
  assert.match(source, /url\.pathname !== PROVIDER_PATH/);
  assert.match(source, /url\.searchParams\.get\("token"\) === token/);
  assert.match(source, /url\.searchParams\.get\("lang"\) === currentLanguage\(\)/);
  assert.match(source, /url\.searchParams\.get\("pos"\) === configuredPosition\(container\)/);
  assert.doesNotMatch(source, /addEventListener\("load"/);
});

test("Saudi Business seal lifecycle covers dynamic, error, and source-change states", async () => {
  const source = await readFile(lifecycleUrl, "utf8");

  assert.match(source, /new MutationObserver/);
  assert.match(source, /mutation\.addedNodes/);
  assert.match(source, /attributeFilter: \["src"\]/);
  assert.match(source, /frame\.addEventListener\("error"/);
  assert.match(source, /hideFrame\(frame\)/);
  assert.match(source, /frame\.setAttribute\("data-seal-ready", "true"\)/);
  assert.match(source, /container\.setAttribute\("data-seal-ready", "true"\)/);
  assert.match(source, /frame\.setAttribute\("allowtransparency", "true"\)/);
  assert.match(source, /applyTransparentFrameShape\(frame, event\.data\.width, event\.data\.height\)/);
});

test("only the exact official iSaudi frame is revealed", async () => {
  const scenarios = [
    { name: "evil origin", event: { origin: "https://evil.example" } },
    { name: "wrong source", event: { source: {} } },
    { name: "false readiness", event: { data: { sbcSeal: false } } },
  ];

  for (const scenario of scenarios) {
    const harness = await createHarness();
    const frame = harness.injectFrame();
    harness.post(frame, scenario.event);
    assert.equal(frame.getAttribute("data-seal-ready"), null, scenario.name);
  }

  for (const invalidUrl of [
    { token: "wrong" },
    { lang: "en" },
    { pos: "top" },
    { path: "/wrong" },
    { origin: "https://evil.example" },
  ]) {
    const harness = await createHarness();
    const frame = harness.injectFrame(invalidUrl);
    harness.post(frame);
    assert.equal(frame.getAttribute("data-seal-ready"), null, JSON.stringify(invalidUrl));
  }

  const harness = await createHarness();
  const frame = harness.injectFrame();
  harness.post(frame);
  assert.equal(frame.getAttribute("data-seal-ready"), "true");
  assert.equal(harness.container.getAttribute("data-seal-ready"), "true");
  assert.equal(frame.getAttribute("data-seal-shape"), "badge");
  assert.match(frame.style.clipPath, /^path\("M /);
});

test("expanded seal clips only the official card and badge surfaces", async () => {
  const harness = await createHarness();
  const frame = harness.injectFrame();

  harness.post(frame);
  harness.post(frame, {
    data: { sbcSeal: true, width: 288, height: 519 },
  });

  assert.equal(frame.getAttribute("allowtransparency"), "true");
  assert.equal(frame.getAttribute("data-seal-shape"), "expanded");
  assert.equal(frame.getAttribute("data-seal-badge-width"), "120");
  assert.equal(frame.getAttribute("data-seal-badge-height"), "44");
  assert.equal((frame.style.clipPath.match(/ M /g) ?? []).length, 1);
  assert.match(frame.style.clipPath, /A 16 16/);
  assert.match(frame.style.clipPath, /A 21 21/);
});

test("error and src mutation return the exact frame to hidden state", async () => {
  const harness = await createHarness();
  const frame = harness.injectFrame();
  harness.post(frame);
  assert.equal(frame.getAttribute("data-seal-ready"), "true");

  frame.dispatch("error");
  assert.equal(frame.getAttribute("data-seal-ready"), null);

  harness.post(frame);
  frame.setAttribute("src", frame.getAttribute("src") + "&changed=1");
  assert.equal(frame.getAttribute("data-seal-ready"), null);
});

test("layout loads local lifecycle before the official provider and CSS hides empty UI", async () => {
  const [layout, styles, footer] = await Promise.all([
    readFile(new URL("../src/app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../src/components/layout/footer.tsx", import.meta.url), "utf8"),
  ]);

  const lifecycleIndex = layout.indexOf("/scripts/saudi-business-seal-lifecycle.js");
  const providerIndex = layout.indexOf("https://eauthenticate.saudibusiness.gov.sa/EAuthSealApi/seal.js");
  assert.ok(lifecycleIndex >= 0 && lifecycleIndex < providerIndex);
  assert.match(layout, /saudi-business-seal-lifecycle[\s\S]*strategy="beforeInteractive"/);
  assert.match(styles, /\.sbc-verify-seal:not\(\[data-seal-ready="true"\]\)/);
  assert.match(styles, /iframe\.sbc-seal-frame:not\(\[data-seal-ready="true"\]\)/);
  assert.match(styles, /width: 0;[\s\S]*height: 0;[\s\S]*background: transparent/);
  assert.match(footer, /data-token="ZWJ0OUh5RlMyRGJCZHVWQUlJeFZmZz09"/);
  assert.match(footer, /data-position="bottom-left"/);
});
