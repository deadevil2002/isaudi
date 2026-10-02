(function () {
  "use strict";

  var PROVIDER_ORIGIN = "https://eauthenticate.saudibusiness.gov.sa";
  var PROVIDER_PATH = "/EAuthSealApi/seal";
  var FRAME_SELECTOR = "iframe.sbc-seal-frame";
  var CONTAINER_SELECTOR = ".sbc-verify-seal";
  var FRAME_PADDING = 2;
  var CARD_BADGE_GAP = 8;
  var EXPANDED_HEIGHT_THRESHOLD = 100;
  var observedFrames = new WeakSet();

  function currentLanguage() {
    var language = (document.documentElement.getAttribute("lang") || "ar")
      .slice(0, 2)
      .toLowerCase();
    return language === "en" ? "en" : "ar";
  }

  function configuredPosition(container) {
    var position = (container.getAttribute("data-position") || "").toLowerCase();
    return position.indexOf("bottom") >= 0 ? "bottom" : "top";
  }

  function frameUrl(frame) {
    try {
      return new URL(frame.getAttribute("src") || "", document.baseURI);
    } catch {
      return null;
    }
  }

  function matchingContainer(frame) {
    var url = frameUrl(frame);
    if (!url || url.origin !== PROVIDER_ORIGIN || url.pathname !== PROVIDER_PATH) {
      return null;
    }

    var containers = document.querySelectorAll(CONTAINER_SELECTOR);
    for (var index = 0; index < containers.length; index += 1) {
      var container = containers[index];
      var token = container.getAttribute("data-token") || "";
      if (
        token &&
        url.searchParams.get("token") === token &&
        url.searchParams.get("lang") === currentLanguage() &&
        url.searchParams.get("pos") === configuredPosition(container)
      ) {
        return container;
      }
    }

    return null;
  }

  function hideFrame(frame) {
    frame.removeAttribute("data-seal-ready");
    document.querySelectorAll(CONTAINER_SELECTOR).forEach(function (container) {
      container.removeAttribute("data-seal-ready");
    });
  }

  function roundedRectPath(left, top, width, height, radius) {
    var right = left + width;
    var bottom = top + height;
    var safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));

    return [
      "M", left + safeRadius, top,
      "H", right - safeRadius,
      "A", safeRadius, safeRadius, 0, 0, 1, right, top + safeRadius,
      "V", bottom - safeRadius,
      "A", safeRadius, safeRadius, 0, 0, 1, right - safeRadius, bottom,
      "H", left + safeRadius,
      "A", safeRadius, safeRadius, 0, 0, 1, left, bottom - safeRadius,
      "V", top + safeRadius,
      "A", safeRadius, safeRadius, 0, 0, 1, left + safeRadius, top,
      "Z",
    ].join(" ");
  }

  function applyTransparentFrameShape(frame, width, height) {
    var frameWidth = Number(width);
    var frameHeight = Number(height);
    if (!Number.isFinite(frameWidth) || !Number.isFinite(frameHeight)) {
      return;
    }

    // The official seal content is right-aligned in both provider responses.
    var contentLeft = FRAME_PADDING;
    var contentWidth = Math.max(1, frameWidth - FRAME_PADDING);
    var path;

    if (frameHeight <= EXPANDED_HEIGHT_THRESHOLD) {
      var badgeHeight = Math.max(1, frameHeight - FRAME_PADDING);
      frame.setAttribute("data-seal-badge-width", String(frameWidth));
      frame.setAttribute("data-seal-badge-height", String(frameHeight));
      frame.setAttribute("data-seal-shape", "badge");
      path = roundedRectPath(
        contentLeft,
        0,
        contentWidth,
        badgeHeight,
        badgeHeight / 2,
      );
    } else {
      var storedBadgeFrameWidth = Number(frame.getAttribute("data-seal-badge-width")) || 120;
      var storedBadgeFrameHeight = Number(frame.getAttribute("data-seal-badge-height")) || 44;
      var badgeWidth = Math.min(contentWidth, Math.max(1, storedBadgeFrameWidth - FRAME_PADDING));
      var badgeHeight = Math.max(1, storedBadgeFrameHeight - FRAME_PADDING);
      var cardHeight = Math.max(
        1,
        frameHeight - FRAME_PADDING - CARD_BADGE_GAP - badgeHeight,
      );
      var badgeLeft = contentLeft + (contentWidth - badgeWidth) / 2;
      var badgeTop = cardHeight + CARD_BADGE_GAP;

      frame.setAttribute("data-seal-shape", "expanded");
      path = [
        roundedRectPath(contentLeft, 0, contentWidth, cardHeight, 16),
        roundedRectPath(badgeLeft, badgeTop, badgeWidth, badgeHeight, badgeHeight / 2),
      ].join(" ");
    }

    frame.style.clipPath = 'path("' + path + '")';
    frame.style.webkitClipPath = 'path("' + path + '")';
  }

  function observeFrame(frame) {
    if (!(frame instanceof HTMLIFrameElement) || observedFrames.has(frame)) {
      return;
    }

    observedFrames.add(frame);
    hideFrame(frame);
    frame.setAttribute("allowtransparency", "true");
    frame.addEventListener("error", function () {
      hideFrame(frame);
    });

    new MutationObserver(function (mutations) {
      if (mutations.some(function (mutation) { return mutation.attributeName === "src"; })) {
        hideFrame(frame);
      }
    }).observe(frame, { attributes: true, attributeFilter: ["src"] });
  }

  function discoverFrames(root) {
    if (root instanceof HTMLIFrameElement && root.matches(FRAME_SELECTOR)) {
      observeFrame(root);
    }
    if (root.querySelectorAll) {
      root.querySelectorAll(FRAME_SELECTOR).forEach(observeFrame);
    }
  }

  function refreshFrameLanguage() {
    document.querySelectorAll(FRAME_SELECTOR).forEach(function (frame) {
      hideFrame(frame);
      var url = frameUrl(frame);
      if (url && url.origin === PROVIDER_ORIGIN && url.pathname === PROVIDER_PATH) {
        var language = currentLanguage();
        if (url.searchParams.get("lang") !== language) {
          url.searchParams.set("lang", language);
          frame.setAttribute("src", url.toString());
        }
      }
    });
  }

  window.addEventListener("message", function (event) {
    if (
      event.origin !== PROVIDER_ORIGIN ||
      !event.data ||
      event.data.sbcSeal !== true
    ) {
      return;
    }

    document.querySelectorAll(FRAME_SELECTOR).forEach(function (frame) {
      if (event.source !== frame.contentWindow) {
        return;
      }

      var container = matchingContainer(frame);
      if (!container) {
        hideFrame(frame);
        return;
      }

      applyTransparentFrameShape(frame, event.data.width, event.data.height);
      frame.setAttribute("data-seal-ready", "true");
      container.setAttribute("data-seal-ready", "true");
    });
  });

  var documentObserver = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          discoverFrames(node);
        }
      });
    });
  });

  documentObserver.observe(document.documentElement, { childList: true, subtree: true });
  new MutationObserver(refreshFrameLanguage).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"],
  });
  discoverFrames(document);
})();
