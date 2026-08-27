// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// jsdom has no 2d context and no image decoder, so both are stubbed. What the
// tests can still check is everything around the pixels: the resize maths, the
// quality ladder, the object path, and the error codes the UI branches on.
const storageMock = {
  ref: vi.fn((_storage, path) => ({ path })),
  uploadBytes: vi.fn(async () => ({})),
  getDownloadURL: vi.fn(async (r) => `https://example/${r.path}`),
  deleteObject: vi.fn(async () => {}),
};

vi.mock("../firebase", () => ({ storage: {} }));
vi.mock("firebase/storage", () => storageMock);

const {
  deleteRecipeImage,
  fitWithin,
  IMAGE_ERROR,
  ImageUploadError,
  MAX_EDGE,
  MAX_SOURCE_BYTES,
  MAX_UPLOAD_BYTES,
  recipeImagePath,
  shrinkToWebp,
  uploadRecipeImage,
  validateImageFile,
} = await import("./imageUpload.js");

const fakeFile = (over = {}) => ({ type: "image/jpeg", size: 1024, ...over });

// Sizes the encoder "produces", consumed one per toBlob call.
let blobSizes = [];
let drawn = [];

beforeEach(() => {
  blobSizes = [10 * 1024];
  drawn = [];

  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({
    width: 4000,
    height: 3000,
    close: vi.fn(),
  })));

  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    drawImage: (_bitmap, _x, _y, w, h) => drawn.push([w, h]),
  }));
  HTMLCanvasElement.prototype.toBlob = function (cb, type, quality) {
    const size = blobSizes.shift();
    cb(size === null ? null : { size, type, quality });
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
  Object.values(storageMock).forEach((fn) => fn.mockClear());
});

describe("validateImageFile", () => {
  it("accepts a normal photo", () => {
    expect(validateImageFile(fakeFile({ size: 4 * 1024 * 1024 }))).toBeNull();
  });

  it("rejects a missing file", () => {
    expect(validateImageFile(null)).toBe(IMAGE_ERROR.MISSING);
    expect(validateImageFile(undefined)).toBe(IMAGE_ERROR.MISSING);
  });

  it("rejects a non-image", () => {
    expect(validateImageFile(fakeFile({ type: "application/pdf" }))).toBe(
      IMAGE_ERROR.TYPE,
    );
    expect(validateImageFile(fakeFile({ type: "" }))).toBe(IMAGE_ERROR.TYPE);
  });

  it("rejects an absurdly large source, but not a phone-sized one", () => {
    expect(validateImageFile(fakeFile({ size: MAX_SOURCE_BYTES + 1 }))).toBe(
      IMAGE_ERROR.SIZE,
    );
    expect(validateImageFile(fakeFile({ size: MAX_SOURCE_BYTES }))).toBeNull();
  });
});

describe("fitWithin", () => {
  it("scales the longer edge down to the cap, keeping the ratio", () => {
    expect(fitWithin(4000, 3000, 1200)).toEqual({ width: 1200, height: 900 });
    expect(fitWithin(3000, 4000, 1200)).toEqual({ width: 900, height: 1200 });
  });

  it("never upscales", () => {
    expect(fitWithin(800, 600, 1200)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1200, 1200, 1200)).toEqual({ width: 1200, height: 1200 });
  });

  it("keeps an extreme panorama at least one pixel tall", () => {
    expect(fitWithin(12000, 3, 1200)).toEqual({ width: 1200, height: 1 });
  });

  it("returns zeroes for nonsense input", () => {
    expect(fitWithin(0, 100)).toEqual({ width: 0, height: 0 });
    expect(fitWithin(NaN, 100)).toEqual({ width: 0, height: 0 });
    expect(fitWithin(-10, 100)).toEqual({ width: 0, height: 0 });
  });

  it("defaults to MAX_EDGE", () => {
    expect(fitWithin(2400, 2400)).toEqual({ width: MAX_EDGE, height: MAX_EDGE });
  });
});

describe("recipeImagePath", () => {
  it("is uid- and recipe-scoped, and timestamped", () => {
    expect(recipeImagePath("u1", "r1", 1234)).toBe("recipes/u1/r1/1234.webp");
  });
});

describe("shrinkToWebp", () => {
  it("draws at the fitted size, not the original", async () => {
    await shrinkToWebp(fakeFile());
    expect(drawn).toEqual([[1200, 900]]);
  });

  it("stops at the first quality that fits the upload cap", async () => {
    const blob = await shrinkToWebp(fakeFile());
    expect(blob.quality).toBe(0.82);
    expect(blob.type).toBe("image/webp");
  });

  it("steps the quality down until the blob fits", async () => {
    blobSizes = [MAX_UPLOAD_BYTES + 1, MAX_UPLOAD_BYTES + 1, 900 * 1024];
    const blob = await shrinkToWebp(fakeFile());
    expect(blob.quality).toBe(0.55);
  });

  it("gives up with a distinct code when even the lowest quality is too big", async () => {
    blobSizes = [9e9, 9e9, 9e9];
    await expect(shrinkToWebp(fakeFile())).rejects.toMatchObject({
      code: IMAGE_ERROR.TOO_BIG_ENCODED,
    });
  });

  it("reports a decode failure (e.g. HEIC) as such", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => {
      throw new Error("unsupported");
    }));
    await expect(shrinkToWebp(fakeFile({ type: "image/heic" }))).rejects.toMatchObject({
      code: IMAGE_ERROR.DECODE,
    });
  });

  it("treats a browser with no WebP encoder as a decode failure", async () => {
    blobSizes = [null];
    await expect(shrinkToWebp(fakeFile())).rejects.toBeInstanceOf(ImageUploadError);
  });
});

describe("uploadRecipeImage", () => {
  it("uploads the shrunk blob to the scoped path and returns its URL", async () => {
    const url = await uploadRecipeImage({
      uid: "u1",
      recipeId: "r1",
      file: fakeFile(),
      now: () => 555,
    });

    expect(storageMock.uploadBytes).toHaveBeenCalledTimes(1);
    const [refArg, blobArg, metaArg] = storageMock.uploadBytes.mock.calls[0];
    expect(refArg.path).toBe("recipes/u1/r1/555.webp");
    expect(blobArg.type).toBe("image/webp");
    expect(metaArg).toEqual({ contentType: "image/webp" });
    expect(url).toBe("https://example/recipes/u1/r1/555.webp");
  });

  it("refuses an invalid file without touching Storage", async () => {
    await expect(
      uploadRecipeImage({ uid: "u1", recipeId: "r1", file: fakeFile({ type: "text/csv" }) }),
    ).rejects.toMatchObject({ code: IMAGE_ERROR.TYPE });
    expect(storageMock.uploadBytes).not.toHaveBeenCalled();
  });
});

describe("deleteRecipeImage", () => {
  it("deletes the object behind a URL", async () => {
    await deleteRecipeImage("https://example/recipes/u1/r1/1.webp");
    expect(storageMock.deleteObject).toHaveBeenCalledTimes(1);
  });

  it("does nothing without a URL", async () => {
    await deleteRecipeImage(null);
    await deleteRecipeImage("");
    expect(storageMock.deleteObject).not.toHaveBeenCalled();
  });

  it("stays silent when the object is already gone", async () => {
    storageMock.deleteObject.mockRejectedValueOnce({ code: "storage/object-not-found" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(deleteRecipeImage("https://example/x.webp")).resolves.toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("warns but never throws on any other failure", async () => {
    storageMock.deleteObject.mockRejectedValueOnce({ code: "storage/unauthorized" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(deleteRecipeImage("https://example/x.webp")).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
