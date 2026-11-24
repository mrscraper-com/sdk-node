import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const reference = JSON.parse(
  readFileSync(
    new URL("../docs/service-reference.json", import.meta.url),
    "utf8",
  ),
);
const source = readFileSync(new URL("../src/api.ts", import.meta.url), "utf8");
const camel = (name) =>
  name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
const blocks = new Map(
  [
    ...source.matchAll(
      /\/\*\*((?:(?!\/\*\*|\*\/)[\s\S])*)\*\/\s*export async function (\w+)/g,
    ),
  ].map((match) => [match[2], match[1]]),
);
const groups = {
  status: ["StatusOptions"],
  "scrape-html": ["PageOptions", "LoadingOptions", "HtmlOptions"],
  "scrape-markdown": ["PageOptions", "LoadingOptions", "MarkdownOptions"],
  "get-screenshot": ["PageOptions", "ScreenshotOptions"],
  "scrape-brand": ["BrandOptions"],
  "scrape-json": ["PageOptions", "LoadingOptions", "JsonOptions"],
  "web-search": ["WebSearchOptions"],
};
for (const service of reference.services) {
  test(`standard descriptions: ${service.name}`, () => {
    const block = blocks.get(camel(service.name));
    assert.equal(block.split("\n")[0].trim(), service.description);
    const fields = new Map();
    for (const group of groups[service.name]) {
      const body = source.match(
        new RegExp(`export interface ${group}[^\\{]*\\{([\\s\\S]*?)\\n\\}`),
      )[1];
      for (const entry of body.matchAll(/\/\*\*\s*([\s\S]*?)\*\/\s*(\w+)\?:/g))
        fields.set(entry[2], entry[1].trim());
    }
    for (const key of service.parameters) {
      const parameter = reference.parameters[key];
      if (["url", "query"].includes(parameter.name))
        assert.ok(
          block.includes(`@param ${parameter.name} ${parameter.description}`),
        );
      else
        assert.equal(
          fields.get(parameter.name),
          parameter.description,
          parameter.name,
        );
    }
    assert.equal(fields.get("token"), reference.parameters.token.description);
    // Options interfaces declare exactly the documented service parameters.
    assert.deepEqual(
      [...fields.keys()].filter((name) => name !== "token").sort(),
      service.parameters
        .map((key) => reference.parameters[key].name)
        .filter((name) => !["url", "query"].includes(name))
        .sort(),
    );
  });
}
