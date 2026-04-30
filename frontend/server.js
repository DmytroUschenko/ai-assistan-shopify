import { createRequestHandler } from "@remix-run/express";
import { installGlobals } from "@remix-run/node";
import compression from "compression";
import express from "express";
import morgan from "morgan";
console.log("Starting Express server...");
installGlobals();

const app = express();

app.use(compression());

// http://expressjs.com/en/advanced/best-practice-security.html#at-a-minimum-disable-x-powered-by-header
app.disable("x-powered-by");

// Remix fingerprints its assets so we can cache forever.
app.use(
  "/build",
  express.static("public/build", { immutable: true, maxAge: "1y" })
);

// Everything else (like favicon.ico) is cached for an hour.
app.use(express.static("public", { maxAge: "1h" }));

app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

const BUILD_DIR = new URL("./build/index.js", import.meta.url).href;

app.all("*", async (req, res, next) => {
  try {
    const build = await import(BUILD_DIR);
    return createRequestHandler({
      build,
      mode: process.env.NODE_ENV,
    })(req, res, next);
  } catch (error) {
    next(error);
  }
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Express server listening at http://localhost:${port}`);
});
