// Pure-logic tests for the affiliate landing-page theme: locked-field enforcement,
// override sanitization, and merge-field rendering safety (no HTML/script/Liquid).
// Run: npx tsx scripts/test-folp.ts
import { defaultFolp, mergeFolp, sanitizeOverrides, renderMerge, videoEmbed } from "../lib/folp";

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean) => { (cond ? pass++ : fail++); console.log(`${cond ? "✅" : "❌"} ${name}`); };

const brand = defaultFolp(); // locks visibility.showLogo by default

// ---- locked fields ----
{
  const merged = mergeFolp(brand, { visibility: { showLogo: false }, styles: { primaryColor: "#000000" } });
  ok("locked field (showLogo) ignores affiliate override", merged.visibility.showLogo === true);
  ok("unlocked field (primaryColor) takes affiliate override", merged.styles.primaryColor === "#000000");
}

// ---- sanitize drops locked + validates ----
{
  const clean: any = sanitizeOverrides(
    { visibility: { showLogo: false }, styles: { primaryColor: "not-a-hex", accentColor: "#12ab34" }, layout: "hacker", content: { headline: "x".repeat(999) } },
    brand,
  );
  ok("sanitize drops locked showLogo", clean.visibility?.showLogo === undefined);
  ok("sanitize rejects bad hex", clean.styles?.primaryColor === undefined);
  ok("sanitize keeps valid hex", clean.styles?.accentColor === "#12ab34");
  ok("sanitize rejects unknown layout", clean.layout === undefined);
  ok("sanitize caps long text", (clean.content?.headline?.length ?? 0) <= 200);
}

// ---- merge-field rendering is injection-proof ----
{
  const vars = { first_name: "Jo", shop_name: "Syruvia", code: "JO10", offer: "10% off" };
  ok("substitutes whitelisted var", renderMerge("Hi {{first_name}}", vars) === "Hi Jo");
  ok("drops unknown var", renderMerge("x {{secret}} y", vars) === "x  y");
  ok("escapes raw HTML", renderMerge("<script>alert(1)</script>", vars) === "&lt;script&gt;alert(1)&lt;/script&gt;");
  // Liquid TAGS are removed (no execution); any literal text between them stays as safe escaped text.
  ok("strips liquid tags (no execution)", renderMerge("{% if true %}X{% endif %}ok", vars) === "Xok");
  ok("liquid output tag with unknown var is dropped", renderMerge("{{ product.price }}", vars) === "");
  ok("escapes injected value too", !renderMerge("{{shop_name}}", { ...vars, shop_name: "<b>x</b>" }).includes("<b>"));
}

// ---- repeaters + numbers sanitize ----
{
  const clean: any = sanitizeOverrides(
    { content: { products: Array.from({ length: 50 }, () => ({ name: "x", image: "javascript:alert(1)", price: "$1", salePrice: "" })) }, styles: { cardRadius: 999, overlayOpacity: -5 } },
    brand,
  );
  ok("caps product repeater length (max 12)", clean.content?.products?.length === 12);
  ok("clamps cardRadius to <= 28", clean.styles?.cardRadius === 28);
  ok("clamps overlayOpacity to >= 0", clean.styles?.overlayOpacity === 0);
}

// ---- video embed host allow-list ----
{
  ok("youtube watch → embed", videoEmbed("https://www.youtube.com/watch?v=abc123") === "https://www.youtube.com/embed/abc123");
  ok("youtu.be → embed", videoEmbed("https://youtu.be/xyz789") === "https://www.youtube.com/embed/xyz789");
  ok("vimeo → player", videoEmbed("https://vimeo.com/12345") === "https://player.vimeo.com/video/12345");
  ok("rejects arbitrary host", videoEmbed("https://evil.com/x") === null);
  ok("rejects javascript: url", videoEmbed("javascript:alert(1)") === null);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
