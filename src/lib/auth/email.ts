export function isGmailDomain(domain: string): boolean {
  const value = (domain || "").trim().toLowerCase();
  return value === "gmail.com" || value === "googlemail.com";
}

export function normalizeEmail(input: string): string {
  const raw = (input || "").trim().toLowerCase();
  const atIndex = raw.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === raw.length - 1) {
    return raw;
  }
  let local = raw.slice(0, atIndex);
  let domain = raw.slice(atIndex + 1);
  if (!domain) {
    return raw;
  }
  if (isGmailDomain(domain)) {
    domain = "gmail.com";
    const plusIndex = local.indexOf("+");
    if (plusIndex >= 0) {
      local = local.slice(0, plusIndex);
    }
    local = local.replace(/\./g, "");
  }
  return `${local}@${domain}`;
}

