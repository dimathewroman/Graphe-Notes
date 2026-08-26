import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  setAccessToken,
  setVaultProof,
} from "@workspace/api-client-react/custom-fetch";
import { downloadPersistedAttachment } from "@/components/editor/attachment-download";

describe("persisted attachment downloads", () => {
  const createObjectUrl = vi.fn(() => "blob:attachment-download");
  const revokeObjectUrl = vi.fn();
  const click = vi.fn();

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_ORIGIN", "https://api.example.test/");
    setAccessToken("access-token");
    setVaultProof("vault-proof");
    vi.stubGlobal("fetch", vi.fn());
    class DownloadUrl extends URL {
      static createObjectURL = createObjectUrl;
      static revokeObjectURL = revokeObjectUrl;
    }
    vi.stubGlobal("URL", DownloadUrl);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(click);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    setAccessToken(null);
    setVaultProof(null);
  });

  it.each([
    [
      "attachment ID",
      {
        attachmentId: "attachment/a",
        src: "https://project.supabase.co/object/sign/ignored",
      },
      "https://api.example.test/api/attachments/download?id=attachment%2Fa",
    ],
    [
      "legacy storage path",
      {
        attachmentId: null,
        src: "https://project.supabase.co/storage/v1/object/sign/note-attachments/notes/a.png?token=secret",
      },
      "https://api.example.test/api/attachments/download?path=note-attachments%2Fnotes%2Fa.png",
    ],
  ])(
    "uses the trusted authenticated boundary for %s",
    async (_kind, target, url) => {
      const fetchSpy = vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response(new Blob(["image"]), {
          status: 200,
          headers: {
            "content-disposition": 'attachment; filename="original.png"',
          },
        }),
      );

      await expect(
        downloadPersistedAttachment(target, "fallback.png"),
      ).resolves.toBe(true);

      expect(fetchSpy).toHaveBeenCalledWith(
        url,
        expect.objectContaining({ headers: expect.any(Headers) }),
      );
      const [, init] = fetchSpy.mock.calls[0] ?? [];
      const headers = new Headers((init as RequestInit).headers);
      expect(headers.get("authorization")).toBe("Bearer access-token");
      expect(headers.get("x-vault-proof")).toBe("vault-proof");
      expect(createObjectUrl).toHaveBeenCalledOnce();
      expect(click).toHaveBeenCalledOnce();
      expect(revokeObjectUrl).not.toHaveBeenCalled();

      await new Promise((resolve) => window.setTimeout(resolve, 0));
      expect(revokeObjectUrl).toHaveBeenCalledWith("blob:attachment-download");
    },
  );

  it("does not build headers or start a request for an unresolved legacy source", async () => {
    const fetchSpy = vi.mocked(globalThis.fetch);

    await expect(
      downloadPersistedAttachment(
        { attachmentId: null, src: "https://example.test/image.png" },
        "image.png",
      ),
    ).resolves.toBe(false);

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
