import { toBuffer } from "bwip-js/node";

// Server-rendered PNG barcode. We render to a data URL on the server so the
// page is print-ready without any client JS. Using Code 128 — it encodes the
// same alphabet the techs see on legitimate equipment labels.
export async function Barcode({
  text,
  height = 18,
  scale = 2,
}: {
  text: string;
  height?: number;
  scale?: number;
}) {
  let dataUrl: string | null = null;
  try {
    const png = await toBuffer({
      bcid: "code128",
      text,
      scale,
      height,
      includetext: false,
      paddingwidth: 4,
      paddingheight: 4,
    });
    dataUrl = `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    // bwip-js rejects on inputs that won't fit in code128. We just hide the
    // image and the caller still shows the text underneath.
  }

  if (!dataUrl) {
    return (
      <div className="text-xs text-red-600">
        Couldn&rsquo;t encode this value as Code 128.
      </div>
    );
  }

  // Plain <img> by intent — Next/Image would force a network roundtrip for an
  // inline data URL.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={dataUrl} alt={`Barcode: ${text}`} className="max-w-full" />;
}
