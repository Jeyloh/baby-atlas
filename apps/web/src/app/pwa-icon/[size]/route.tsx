import { renderIcon } from "@/lib/pwa/icon-image";

export const dynamic = "force-static";

const SIZES = [192, 512] as const;

export function generateStaticParams() {
  return SIZES.map((size) => ({ size: String(size) }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> }
) {
  const { size } = await params;
  const px = SIZES.find((value) => String(value) === size);
  if (!px) return new Response("Not found", { status: 404 });
  return renderIcon(px);
}
