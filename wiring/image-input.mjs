import { openPdf } from "./pdf.bundle.js";
async function openDrawing(file) {
  if (file.size > 4e7) throw Error("図面は40MB以下にしてください");
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) return openPdf(file);
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw Error("PDF・PNG・JPEG・WebPを選択してください");
  const bitmap = await createImageBitmap(file);
  if (bitmap.width * bitmap.height > 6e7) {
    bitmap.close();
    throw Error("画像は6000万画素以下にしてください");
  }
  const scale = Math.min(1, 4e3 / Math.max(bitmap.width, bitmap.height)), canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const jpeg = new Uint8Array(await (await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.97))).arrayBuffer());
  const w = 842, h = w * canvas.height / canvas.width, enc = new TextEncoder(), parts = [], offsets = [0];
  let length = 0;
  const add = (x) => {
    const b = typeof x === "string" ? enc.encode(x) : x;
    parts.push(b);
    length += b.length;
  };
  add("%PDF-1.4\n");
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Image 4 0 R >> >> /Contents 5 0 R >>`];
  for (let i = 0; i < 3; i++) {
    offsets.push(length);
    add(`${i + 1} 0 obj
${objects[i]}
endobj
`);
  }
  offsets.push(length);
  add(`4 0 obj
<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>
stream
`);
  add(jpeg);
  add("\nendstream\nendobj\n");
  const content = `q ${w} 0 0 ${h} 0 0 cm /Image Do Q`;
  offsets.push(length);
  add(`5 0 obj
<< /Length ${content.length} >>
stream
${content}
endstream
endobj
`);
  const start = length;
  add("xref\n0 6\n0000000000 65535 f \n" + offsets.slice(1).map((n) => String(n).padStart(10, "0") + " 00000 n \n").join("") + `trailer
<< /Size 6 /Root 1 0 R >>
startxref
${start}
%%EOF`);
  return openPdf(new File(parts, file.name + ".pdf", { type: "application/pdf" }));
}
export {
  openDrawing
};
