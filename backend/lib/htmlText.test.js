import { describe, it, expect } from "vitest";
import { htmlToText, fieldToText } from "./htmlText.js";

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

describe("fieldToText", () => {
  // JSON-LD fields carry markup often enough that this is the normal case, not
  // an edge case -- and each one has to stay on a single line, because the prompt
  // is built as one item per line.
  it("flattens a marked-up field to one line", () => {
    expect(fieldToText("<p>Keverd össze.</p><p>Süsd meg.</p>")).toBe(
      "Keverd össze. Süsd meg.",
    );
  });

  it("decodes entities in a field", () => {
    expect(fieldToText("s&oacute; &amp; bors")).toBe("só & bors");
  });

  it("returns an empty string for anything that is not a string", () => {
    for (const value of [null, undefined, 42, {}, []]) {
      expect(fieldToText(value)).toBe("");
    }
  });
});
