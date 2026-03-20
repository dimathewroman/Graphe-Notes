import "./load-env"; // must be first — sets process.env before app.ts reads it
import app from "./app";

const rawPort = process.env["PORT"] ?? process.env["API_PORT"] ?? "3001";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
