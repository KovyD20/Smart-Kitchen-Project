// Fetches a user-supplied recipe page and reduces it to plain text for the model.
//
// The browser cannot do this itself (CORS), which is the only reason the download
// lives on the server -- and the moment the server fetches a URL the user typed,
// it is an SSRF surface. The guards below are part of the feature, not hardening
// to bolt on later.
//
// Why `https.request` and not `fetch`: the address actually connected to is what
// matters, and `fetch` gives no hook on it. Checking DNS up front and then handing
// the *hostname* to fetch leaves a DNS-rebinding window -- the name resolves to a
// public address for our check and to 169.254.169.254 a moment later, when the
// socket is opened. `http.request` accepts a `lookup` function that runs at
// connect time, so the IP we vet is the IP we talk to. Redirects are followed by
// hand for the same reason: every hop has to be vetted, not just the first.
const http = require("node:http");
const https = require("node:https");
const dns = require("node:dns");
const net = require("node:net");
const zlib = require("node:zlib");

// Big enough for a long recipe page with inline styles, small enough that a
// hostile or broken URL cannot stream gigabytes into memory.
const MAX_BYTES = 2 * 1024 * 1024;
// Compressed bodies are checked twice: the wire limit above, plus this one after
// inflation, so a zip bomb cannot expand into the heap.
const MAX_DECODED_BYTES = 8 * 1024 * 1024;
// Wall-clock budget for the whole operation, redirects included -- a per-request
// timeout would let three slow hops add up.
const FETCH_TIMEOUT_MS = Number(process.env.URL_FETCH_TIMEOUT_MS) || 10000;
const MAX_REDIRECTS = 3;

// Anything else (application/pdf, images, a JSON API) is not a recipe page we can
// read, and letting it through would just feed the model binary noise.
const ALLOWED_CONTENT_TYPES = ["text/html", "application/xhtml+xml"];

const PRIVATE_HOSTNAMES = /^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i;

// 0/8, 10/8, 127/8, 169.254/16 (cloud metadata lives here), 172.16/12, 192.168/16.
const PRIVATE_IPV4 =
  /^(0|10|127)\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\.|^192\.168\./;

function urlError(message, code, status = 400) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

function blockedAddressError() {
  return urlError("This address is not reachable", "URL_PRIVATE");
}

// True for any address the server must not be talked into contacting on a
// stranger's behalf. Takes a literal IP, never a hostname.
function isPrivateAddress(address) {
  const ip = String(address).replace(/^\[|\]$/g, "").toLowerCase();

  if (net.isIPv4(ip)) return PRIVATE_IPV4.test(ip);

  if (net.isIPv6(ip)) {
    if (ip === "::1" || ip === "::") return true;
    // Unique-local (fc00::/7) and link-local (fe80::/10).
    if (/^f[cd][0-9a-f]{2}:/.test(ip)) return true;
    if (/^fe[89ab][0-9a-f]:/.test(ip)) return true;
    // IPv4-mapped, in both the dotted ("::ffff:127.0.0.1") and the hex form
    // ("::ffff:7f00:1") that `new URL()` normalizes it to.
    const dotted = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (dotted) return PRIVATE_IPV4.test(dotted[1]);
    const hex = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
      const high = parseInt(hex[1], 16);
      const low = parseInt(hex[2], 16);
      return PRIVATE_IPV4.test([high >> 8, high & 255, low >> 8, low & 255].join("."));
    }
    return false;
  }

  return false;
}

// Loopback only -- the narrow slice the tests need. Everything else private
// (10/8, 192.168/16, and above all 169.254.169.254) stays blocked even when the
// escape hatch below is on, so a stray `allowLoopback: true` cannot become a
// route to the cloud metadata service.
function isLoopback(address) {
  const ip = String(address).replace(/^\[|\]$/g, "").toLowerCase();
  if (ip === "localhost") return true;
  if (net.isIPv4(ip)) return /^127\./.test(ip);
  if (ip === "::1") return true;
  const dotted = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return /^127\./.test(dotted[1]);
  const hex = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const high = parseInt(hex[1], 16);
    return (high >> 8) === 127;
  }
  return false;
}

// Whether this address must be refused, given the test escape hatch.
function isBlockedAddress(address, allowLoopback) {
  if (allowLoopback && isLoopback(address)) return false;
  return isPrivateAddress(address);
}

function isBlockedHost(hostname, allowLoopback) {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (allowLoopback && isLoopback(host)) return false;
  if (PRIVATE_HOSTNAMES.test(host)) return true;
  return isPrivateAddress(host);
}

// Throws unless `raw` is an http(s) URL pointing at something plausibly public.
// This is the cheap, synchronous half: scheme, plus literal addresses and local
// names that need no DNS. The authoritative check is the lookup hook below, at
// connect time. Returns the parsed URL so callers fetch exactly what was checked.
//
// `allowLoopback` exists for the tests, which serve pages from 127.0.0.1. It
// widens nothing else -- see isLoopback. Nothing in routes/ passes it.
function assertPublicUrl(raw, { allowLoopback = false } = {}) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw urlError("Invalid URL", "URL_INVALID");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw urlError("Only http and https URLs are supported", "URL_INVALID");
  }

  if (isBlockedHost(url.hostname, allowLoopback)) {
    throw blockedAddressError();
  }

  return url;
}

// A `dns.lookup` drop-in for http.request. Resolves every record for the name and
// refuses the connection if *any* of them is private -- picking whichever record
// happens to be public would hand the attacker the choice.
function makeGuardedLookup(allowLoopback) {
  return function guardedLookup(hostname, options, callback) {
    dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err);

      const list = Array.isArray(addresses) ? addresses : [addresses];
      if (!list.length) return callback(blockedAddressError());

      for (const entry of list) {
        if (isBlockedAddress(entry.address, allowLoopback)) {
          return callback(blockedAddressError());
        }
      }

      if (options.all) return callback(null, list);
      return callback(null, list[0].address, list[0].family);
    });
  };
}

const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);

// One hop. Resolves with the live response stream; the caller decides whether to
// read it or follow it.
function requestOnce(url, deadline, allowLoopback) {
  const transport = url.protocol === "https:" ? https : http;
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    return Promise.reject(
      urlError("The page took too long to load", "URL_TIMEOUT", 504),
    );
  }

  return new Promise((resolve, reject) => {
    const req = transport.request(
      url,
      {
        method: "GET",
        lookup: makeGuardedLookup(allowLoopback),
        headers: {
          // Honest identification. Do NOT swap this for a browser user-agent to
          // get past a bot check: sites that block us have said no.
          "User-Agent": "SmartKitchen/1.0 (recipe import; +https://github.com/)",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "hu,en;q=0.8",
          "Accept-Encoding": "gzip, deflate, br",
        },
      },
      resolve,
    );

    req.setTimeout(remaining, () => {
      req.destroy(urlError("The page took too long to load", "URL_TIMEOUT", 504));
    });

    req.on("error", (err) => {
      // A blocked address surfaces here, thrown by the lookup hook -- keep its
      // code instead of flattening it into a generic network failure.
      if (err?.code === "URL_PRIVATE" || err?.code === "URL_TIMEOUT") {
        return reject(err);
      }
      reject(urlError("Could not reach the page", "URL_FETCH_FAILED", 502));
    });

    req.end();
  });
}

function decompressStream(response) {
  const encoding = (response.headers["content-encoding"] || "").toLowerCase();
  // Bounded on the way out as well: `maxOutputLength` makes zlib itself abort a
  // body that inflates past the limit, rather than after the fact.
  const options = { maxOutputLength: MAX_DECODED_BYTES };
  if (encoding === "gzip") return response.pipe(zlib.createGunzip(options));
  if (encoding === "deflate") return response.pipe(zlib.createInflate(options));
  if (encoding === "br") return response.pipe(zlib.createBrotliDecompress(options));
  return response;
}

// Hungarian recipe sites are not uniformly UTF-8; a latin-2 page decoded as UTF-8
// loses exactly the characters that matter (ő, ű) to replacement chars.
function decodeBody(buffer, contentType) {
  const charset = /charset=["']?([\w-]+)/i.exec(contentType || "")?.[1];
  if (charset && !/^utf-?8$/i.test(charset)) {
    try {
      return new TextDecoder(charset).decode(buffer);
    } catch {
      // Unknown label -- fall through to UTF-8 rather than fail the import.
    }
  }
  return buffer.toString("utf8");
}

// Reads the body, enforcing the wire limit as bytes arrive rather than after.
function readBounded(response, deadline) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let wireBytes = 0;
    let decodedBytes = 0;
    let settled = false;

    const stream = decompressStream(response);

    const fail = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      response.destroy();
      if (stream !== response) stream.destroy();
      reject(err);
    };

    const timer = setTimeout(
      () => fail(urlError("The page took too long to load", "URL_TIMEOUT", 504)),
      Math.max(deadline - Date.now(), 1),
    );

    response.on("data", (chunk) => {
      wireBytes += chunk.length;
      if (wireBytes > MAX_BYTES) {
        fail(urlError("Page is too large to read", "URL_TOO_LARGE", 413));
      }
    });

    stream.on("data", (chunk) => {
      decodedBytes += chunk.length;
      if (decodedBytes > MAX_DECODED_BYTES) {
        return fail(urlError("Page is too large to read", "URL_TOO_LARGE", 413));
      }
      chunks.push(chunk);
    });

    stream.on("end", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(decodeBody(Buffer.concat(chunks), response.headers["content-type"]));
    });

    // A truncated or corrupt body, including zlib's own maxOutputLength abort.
    const onError = () => fail(urlError("The page could not be read", "URL_FETCH_FAILED", 502));
    stream.on("error", onError);
    response.on("error", onError);
  });
}

// Downloads the page, following redirects by hand so each hop is vetted. Rejects
// with a coded error for every failure the user can be told something useful about.
async function fetchPageHtml(rawUrl, { allowLoopback = false } = {}) {
  const deadline = Date.now() + FETCH_TIMEOUT_MS;
  let url = assertPublicUrl(rawUrl, { allowLoopback });

  for (let hop = 0; ; hop++) {
    const response = await requestOnce(url, deadline, allowLoopback);
    const status = response.statusCode;

    if (REDIRECT_STATUS.has(status)) {
      response.resume(); // drain, so the socket closes cleanly
      if (hop >= MAX_REDIRECTS) {
        throw urlError(
          "The page redirected too many times",
          "URL_TOO_MANY_REDIRECTS",
          502,
        );
      }
      const location = response.headers.location;
      if (!location) {
        throw urlError("The page could not be loaded", "URL_FETCH_FAILED", 502);
      }
      // Re-validated from scratch: a public page redirecting to 127.0.0.1 or to
      // file:// is the textbook SSRF bypass.
      url = assertPublicUrl(new URL(location, url).href, { allowLoopback });
      continue;
    }

    if (status < 200 || status >= 300) {
      response.resume();
      // 401/403/429 is overwhelmingly a bot check (Cloudflare and friends). It is
      // not a bug and cannot be fixed from our side, so it gets its own code.
      const blocked = [401, 403, 429].includes(status);
      throw urlError(
        blocked ? "The site refused the request" : "The page could not be loaded",
        blocked ? "URL_BLOCKED" : "URL_FETCH_FAILED",
        502,
      );
    }

    const contentType = (response.headers["content-type"] || "").toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.some((type) => contentType.startsWith(type))) {
      response.resume();
      throw urlError("This link is not a web page", "URL_NOT_HTML", 415);
    }

    return readBounded(response, deadline);
  }
}

module.exports = {
  assertPublicUrl,
  isPrivateAddress,
  fetchPageHtml,
  MAX_BYTES,
  MAX_REDIRECTS,
};
