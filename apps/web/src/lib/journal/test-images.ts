import sharp from "sharp";

/**
 * A JPEG with EXIF orientation 6 (rotate 90 degrees), camera make and GPS
 * coordinates. EXIF tag names are numeric in the file, so the ASCII values
 * "SecretCam", "SecretOwner" and "SecretGpsDatum" are the markers tests search
 * for. "SecretGpsDatum" lives in the GPS IFD.
 */
export async function jpegWithGps(width = 3000, height = 1500): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: "#cc3333" } })
    .withExif({
      IFD0: { Make: "SecretCam", Copyright: "SecretOwner" },
      IFD3: {
        GPSMapDatum: "SecretGpsDatum",
        GPSLatitudeRef: "N",
        GPSLatitude: "59/1 54/1 0/1",
        GPSLongitudeRef: "E",
        GPSLongitude: "10/1 45/1 0/1",
      },
    })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
}

export function plainImage(format: "png" | "webp" | "jpeg", width = 64, height = 64) {
  return sharp({ create: { width, height, channels: 3, background: "#3366cc" } })
    [format]()
    .toBuffer();
}

/** The leading bytes of an HEIC file. It is not decodable, but the magic bytes match. */
export function fakeHeic(): Buffer {
  return Buffer.concat([
    Buffer.from([0, 0, 0, 24]),
    Buffer.from("ftypheic"),
    Buffer.alloc(32),
  ]);
}
