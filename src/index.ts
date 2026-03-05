import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.js";

async function main() {
  const server = new McpServer({
    name: "mrscraper-mcp",
    version: "0.1.0",
  });

  registerTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("mrscraper-mcp: connected via stdio");
}

main().catch((err) => {
  console.error("mrscraper-mcp: failed to start:", err);
  process.exit(1);
});
