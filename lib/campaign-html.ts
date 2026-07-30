import sanitizeHtml from "sanitize-html";
import juice from "juice";

const safeStyleValue =
  /^(?!.*(?:expression|javascript|vbscript|url\s*\())[\w\s#(),.%/"'!:+-]+$/i;

const emailTags = [
  "a",
  "abbr",
  "b",
  "blockquote",
  "br",
  "caption",
  "center",
  "code",
  "col",
  "colgroup",
  "div",
  "em",
  "font",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
];

const allowedAttributes = {
  "*": [
    "align",
    "bgcolor",
    "class",
    "height",
    "style",
    "title",
    "valign",
    "width",
  ],
  a: ["href", "name", "rel", "target"],
  img: ["alt", "border", "height", "src", "title", "width"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan", "scope"],
  table: ["border", "cellpadding", "cellspacing", "role"],
};

const allowedStyles = {
  "*": {
    "background": [safeStyleValue],
    "background-color": [safeStyleValue],
    "border": [safeStyleValue],
    "border-bottom": [safeStyleValue],
    "border-collapse": [safeStyleValue],
    "border-color": [safeStyleValue],
    "border-left": [safeStyleValue],
    "border-radius": [safeStyleValue],
    "border-right": [safeStyleValue],
    "border-spacing": [safeStyleValue],
    "border-style": [safeStyleValue],
    "border-top": [safeStyleValue],
    "border-width": [safeStyleValue],
    "box-sizing": [safeStyleValue],
    "color": [safeStyleValue],
    "display": [safeStyleValue],
    "font": [safeStyleValue],
    "font-family": [safeStyleValue],
    "font-size": [safeStyleValue],
    "font-style": [safeStyleValue],
    "font-weight": [safeStyleValue],
    "height": [safeStyleValue],
    "letter-spacing": [safeStyleValue],
    "line-height": [safeStyleValue],
    "margin": [safeStyleValue],
    "margin-bottom": [safeStyleValue],
    "margin-left": [safeStyleValue],
    "margin-right": [safeStyleValue],
    "margin-top": [safeStyleValue],
    "max-height": [safeStyleValue],
    "max-width": [safeStyleValue],
    "min-height": [safeStyleValue],
    "min-width": [safeStyleValue],
    "mso-hide": [safeStyleValue],
    "mso-line-height-rule": [safeStyleValue],
    "opacity": [safeStyleValue],
    "overflow": [safeStyleValue],
    "padding": [safeStyleValue],
    "padding-bottom": [safeStyleValue],
    "padding-left": [safeStyleValue],
    "padding-right": [safeStyleValue],
    "padding-top": [safeStyleValue],
    "table-layout": [safeStyleValue],
    "text-align": [safeStyleValue],
    "text-decoration": [safeStyleValue],
    "text-transform": [safeStyleValue],
    "vertical-align": [safeStyleValue],
    "white-space": [safeStyleValue],
    "word-break": [safeStyleValue],
    "word-spacing": [safeStyleValue],
    "width": [safeStyleValue],
  },
};

const commonSanitizeOptions = {
  allowedAttributes,
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: {
    img: ["http", "https"],
  },
  allowProtocolRelative: false,
  allowedStyles,
};

export function sanitizeCampaignHtml(value: string) {
  const safeWithCss = sanitizeHtml(value, {
    ...commonSanitizeOptions,
    allowedTags: [...emailTags, "style"],
    // This is an intermediate representation only. Juice consumes the CSS,
    // then the final sanitizer below removes every style element.
    allowVulnerableTags: true,
  });

  const inlined = juice(safeWithCss, {
    applyAttributesTableElements: true,
    applyHeightAttributes: true,
    applyStyleTags: true,
    applyWidthAttributes: true,
    preserveFontFaces: false,
    preserveMediaQueries: false,
    removeStyleTags: true,
    resolveCSSVariables: true,
  });

  return sanitizeHtml(inlined, {
    ...commonSanitizeOptions,
    allowedTags: emailTags,
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: "a",
        attribs: {
          ...attribs,
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
    },
  }).trim();
}

export function campaignHtmlToText(value: string) {
  return sanitizeHtml(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n\n"),
    { allowedTags: [], allowedAttributes: {} },
  )
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function personalizeCampaignHtml({
  html,
  name,
  email,
}: {
  html: string;
  name?: string | null;
  email: string;
}) {
  const escape = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  return html
    .replaceAll("{{name}}", escape(name?.trim() || "Değerli çalışma arkadaşımız"))
    .replaceAll("{{email}}", escape(email));
}
