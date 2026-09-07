import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import http from "node:http";
import zlib from "node:zlib";
import dns from "node:dns";
import {
  assertPublicUrl,
  isPrivateAddress,
  fetchPageHtml,
  htmlToText,
  MAX_REDIRECTS,
} from "./recipeUrl.js";

// The download path is tested against a real server on localhost rather than a
// mocked http.request: the parts worth testing (the connect-time lookup hook, the
// hand-rolled redirect loop, byte limits enforced mid-stream) all live below the
// API surface a mock would replace.
//
// Serving from localhost means the guard has to be told to allow it -- hence
// `allowLoopback`. The tests that verify the guard itself never pass it.
const ALLOW = { allowLoopback: true };

let server;
let base;
const routes = new Map();

function route(path, handler) {
  routes.set(path, handler);
  return `${base}${path}`;
}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const path = req.url;
    const handler = routes.get(path);
    if (!handler) {
      res.writeHead(404, { "content-type": "text/html" });
      return res.end("<body>not found</body>");
    }
    handler(req, res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

function html(body, headers = {}) {
  return (req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", ...headers });
    res.end(body);
  };
}

describe("isPrivateAddress", () => {
  it("recognizes every private IPv4 range", () => {
    for (const ip of [
      "0.0.0.0",
      "10.1.2.3",
      "127.0.0.1",
      "169.254.169.254", // cloud metadata
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it("leaves public IPv4 alone", () => {
    // 172.15/172.32 sit just outside 172.16/12 -- an off-by-one here would either
    // block real sites or open the private range.
    for (const ip of ["1.1.1.1", "8.8.8.8", "172.15.0.1", "172.32.0.1", "93.184.216.34"]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });

  it("recognizes private IPv6, including IPv4-mapped forms", () => {
    for (const ip of [
      "::1",
      "fd00::1",
      "fc00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "::ffff:7f00:1", // the same address, as `new URL()` normalizes it
      "::ffff:c0a8:101", // 192.168.1.1
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it("leaves public IPv6 alone", () => {
    for (const ip of ["2001:4860:4860::8888", "::ffff:8.8.8.8"]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });
});

describe("assertPublicUrl", () => {
  it("accepts ordinary http(s) recipe links", () => {
    expect(assertPublicUrl("https://receptek.hu/gulyas").hostname).toBe("receptek.hu");
    expect(assertPublicUrl("http://example.com/a?b=1").protocol).toBe("http:");
  });

  it("rejects non-http schemes", () => {
    // file: would read the server's own disk; data: skips the network entirely.
    for (const url of ["file:///etc/passwd", "data:text/html,<h1>x", "ftp://example.com"]) {
      expect(() => assertPublicUrl(url), url).toThrow(/http/i);
    }
  });

  it("rejects garbage that is not a URL at all", () => {
    expect(() => assertPublicUrl("not a url")).toThrow();
  });

  it("rejects literal private addresses and local names", () => {
    const blocked = [
      "http://localhost:3000/",
      "http://127.0.0.1/",
      "http://10.0.0.5/",
      "http://172.16.4.4/",
      "http://192.168.1.1/",
      "http://169.254.169.254/latest/meta-data/",
      "http://[::1]/",
      "http://[fd00::1]/",
      "http://[::ffff:127.0.0.1]/",
      "http://db.internal/",
      "http://printer.local/",
    ];
    for (const url of blocked) {
      let thrown;
      try {
        assertPublicUrl(url);
      } catch (err) {
        thrown = err;
      }
      expect(thrown, url).toBeDefined();
      expect(["URL_PRIVATE", "URL_INVALID"]).toContain(thrown.code);
    }
  });
});

describe("fetchPageHtml — DNS guard", () => {
  // The reason this endpoint uses http.request over fetch: the address is vetted
  // at connect time, so a name that resolves to a private IP cannot slip through
  // between the check and the socket (DNS rebinding).
  it("refuses a public-looking hostname that resolves to a private address", async () => {
    const lookup = vi.spyOn(dns, "lookup").mockImplementation((hostname, options, cb) => {
      const callback = typeof options === "function" ? options : cb;
      callback(null, [{ address: "169.254.169.254", family: 4 }]);
    });

    await expect(fetchPageHtml("http://totally-innocent.example/")).rejects.toMatchObject({
      code: "URL_PRIVATE",
      status: 400,
    });

    lookup.mockRestore();
  });

  it("refuses when only one of several records is private", async () => {
    // Picking the public record would hand the attacker the choice of which
    // answer we honour.
    const lookup = vi.spyOn(dns, "lookup").mockImplementation((hostname, options, cb) => {
      const callback = typeof options === "function" ? options : cb;
      callback(null, [
        { address: "93.184.216.34", family: 4 },
        { address: "127.0.0.1", family: 4 },
      ]);
    });

    await expect(fetchPageHtml("http://mixed-records.example/")).rejects.toMatchObject({
      code: "URL_PRIVATE",
    });

    lookup.mockRestore();
  });

  it("does not connect at all when the address is blocked", async () => {
    const lookup = vi.spyOn(dns, "lookup");
    await expect(fetchPageHtml("http://169.254.169.254/")).rejects.toMatchObject({
      code: "URL_PRIVATE",
    });
    // Rejected by the synchronous check, before DNS was even consulted.
    expect(lookup).not.toHaveBeenCalled();
    lookup.mockRestore();
  });
});

describe("fetchPageHtml — redirects", () => {
  it("follows a redirect and returns the final page", async () => {
    route("/moved", (req, res) => {
      res.writeHead(302, { location: "/final" });
      res.end();
    });
    route("/final", html("<body>gulyás</body>"));

    await expect(fetchPageHtml(`${base}/moved`, ALLOW)).resolves.toContain("gulyás");
  });

  it("re-checks every hop, so a redirect into a private address is blocked", async () => {
    // The textbook SSRF bypass: a page that passes the check, then bounces the
    // server somewhere only the server can reach.
    route("/bounce", (req, res) => {
      res.writeHead(302, { location: "http://169.254.169.254/latest/meta-data/" });
      res.end();
    });

    await expect(fetchPageHtml(`${base}/bounce`, ALLOW)).rejects.toMatchObject({
      code: "URL_PRIVATE",
    });
  });

  it("blocks a redirect that changes scheme to file:", async () => {
    route("/to-file", (req, res) => {
      res.writeHead(302, { location: "file:///etc/passwd" });
      res.end();
    });

    await expect(fetchPageHtml(`${base}/to-file`, ALLOW)).rejects.toMatchObject({
      code: "URL_INVALID",
    });
  });

  it("gives up after the redirect limit instead of looping forever", async () => {
    route("/loop", (req, res) => {
      res.writeHead(302, { location: "/loop" });
      res.end();
    });

    await expect(fetchPageHtml(`${base}/loop`, ALLOW)).rejects.toMatchObject({
      code: "URL_TOO_MANY_REDIRECTS",
    });
  });

  it("allows exactly MAX_REDIRECTS hops", async () => {
    for (let i = 0; i < MAX_REDIRECTS; i++) {
      route(`/hop${i}`, (req, res) => {
        res.writeHead(302, { location: `/hop${i + 1}` });
        res.end();
      });
    }
    route(`/hop${MAX_REDIRECTS}`, html("<body>megérkeztünk</body>"));

    await expect(fetchPageHtml(`${base}/hop0`, ALLOW)).resolves.toContain("megérkeztünk");
  });
});

describe("fetchPageHtml — responses", () => {
  it("returns the page body on success", async () => {
    route("/ok", html("<html><body>ok</body></html>"));
    await expect(fetchPageHtml(`${base}/ok`, ALLOW)).resolves.toContain("ok");
  });

  // Sites behind a bot check are not a bug we can fix, and must never be worked
  // around -- they get a code of their own so the UI can say so plainly.
  it("reports a bot check as URL_BLOCKED", async () => {
    route("/forbidden", (req, res) => {
      res.writeHead(403, { "content-type": "text/html" });
      res.end("<body>nope</body>");
    });
    await expect(fetchPageHtml(`${base}/forbidden`, ALLOW)).rejects.toMatchObject({
      code: "URL_BLOCKED",
      status: 502,
    });
  });

  it("reports other HTTP failures as URL_FETCH_FAILED", async () => {
    route("/boom", (req, res) => {
      res.writeHead(500, { "content-type": "text/html" });
      res.end("<body>boom</body>");
    });
    await expect(fetchPageHtml(`${base}/boom`, ALLOW)).rejects.toMatchObject({
      code: "URL_FETCH_FAILED",
    });
  });

  it("refuses non-HTML content", async () => {
    route("/doc.pdf", (req, res) => {
      res.writeHead(200, { "content-type": "application/pdf" });
      res.end("%PDF-1.4");
    });
    await expect(fetchPageHtml(`${base}/doc.pdf`, ALLOW)).rejects.toMatchObject({
      code: "URL_NOT_HTML",
      status: 415,
    });
  });

  it("reports an unreachable host as URL_FETCH_FAILED", async () => {
    // Nothing listens on this port; the connection is refused.
    await expect(fetchPageHtml("http://127.0.0.1:1/", ALLOW)).rejects.toMatchObject({
      code: "URL_FETCH_FAILED",
      status: 502,
    });
  });

  it("stops a body that exceeds the size limit", async () => {
    route("/huge", (req, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      // Written in chunks so the limit is hit mid-stream, which is the point:
      // nothing is buffered past the cap.
      const chunk = "x".repeat(256 * 1024);
      let sent = 0;
      const write = () => {
        while (sent < 4 * 1024 * 1024) {
          sent += chunk.length;
          if (!res.write(chunk)) return res.once("drain", write);
        }
        res.end();
      };
      write();
    });

    await expect(fetchPageHtml(`${base}/huge`, ALLOW)).rejects.toMatchObject({
      code: "URL_TOO_LARGE",
      status: 413,
    });
  });

  it("times out on a server that never finishes the body", async () => {
    process.env.URL_FETCH_TIMEOUT_MS = "300";
    vi.resetModules();
    const { fetchPageHtml: withShortTimeout } = await import("./recipeUrl.js?timeout");

    route("/hang", (req, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      res.write("<body>waiting");
      // Never ends.
    });

    await expect(withShortTimeout(`${base}/hang`, ALLOW)).rejects.toMatchObject({
      code: "URL_TIMEOUT",
      status: 504,
    });

    delete process.env.URL_FETCH_TIMEOUT_MS;
  });

  it("inflates a gzipped page", async () => {
    route("/gz", (req, res) => {
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "content-encoding": "gzip",
      });
      res.end(zlib.gzipSync(Buffer.from("<body>tejföl</body>", "utf8")));
    });

    await expect(fetchPageHtml(`${base}/gz`, ALLOW)).resolves.toContain("tejföl");
  });

  // Hungarian recipe sites are not uniformly UTF-8, and latin-2 decoded as UTF-8
  // destroys exactly the letters that matter.
  it("decodes a latin-2 page using the declared charset", async () => {
    route("/latin2", (req, res) => {
      res.writeHead(200, { "content-type": "text/html; charset=iso-8859-2" });
      // "sűrű főzelék" in ISO-8859-2.
      res.end(Buffer.from([0x73, 0xfb, 0x72, 0xfb, 0x20, 0x66, 0xf5, 0x7a, 0x65, 0x6c, 0xe9, 0x6b]));
    });

    await expect(fetchPageHtml(`${base}/latin2`, ALLOW)).resolves.toContain("sűrű főzelék");
  });

  it("does not impersonate a browser", async () => {
    let seen;
    route("/ua", (req, res) => {
      seen = req.headers["user-agent"];
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<body>ok</body>");
    });

    await fetchPageHtml(`${base}/ua`, ALLOW);
    expect(seen).toMatch(/SmartKitchen/);
    expect(seen).not.toMatch(/Mozilla|Chrome|Safari/);
  });
});

describe("htmlToText", () => {
  it("drops scripts, styles and markup", () => {
    const text = htmlToText(
      "<html><body><script>var a = 'hozzávaló';</script><style>p{color:red}</style><p>Gulyás</p></body></html>",
    );
    expect(text).toBe("Gulyás");
  });

  it("keeps list items on separate lines", () => {
    const text = htmlToText("<body><ul><li>2 db hagyma</li><li>50 dkg marha</li></ul></body>");
    expect(text.split("\n")).toEqual(["2 db hagyma", "50 dkg marha"]);
  });

  it("decodes entities", () => {
    expect(
      htmlToText("<body><p>s&oacute;&nbsp;&amp; bors &#233;s &#x66;&#x6f;</p></body>"),
    ).toContain("& bors és fo");
  });

  it("ignores everything outside <body>", () => {
    const text = htmlToText("<html><head><title>Nem ez</title></head><body><p>Ez</p></body></html>");
    expect(text).toBe("Ez");
  });
});
