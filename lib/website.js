// A web address has no space: "www. acme .com" -> "www.acme.com".
export function compactWebsite(website) {
  return website.replace(/\s+/g, "");
}

// Target of the link: "www.acme.com" has no scheme, which would make it a relative link.
export function websiteHref(website) {
  return /^[a-z][a-z\d+.-]*:\/\//i.test(website) ? website : `https://${website}`;
}
