/**
 * Manual smoke-test of the SEO bootstrap. Reads env, calls the bootstrap
 * orchestrator, prints per-step results.
 *
 *   npx tsx --env-file=.env.local scripts/seo-bootstrap-test.mjs
 */
import { runSeoBootstrap } from "../lib/seo/bootstrap";

runSeoBootstrap()
  .then((r) => {
    console.log(JSON.stringify(r, null, 2));
    const errors = r.steps.filter((s) => s.status === "error");
    if (errors.length > 0) process.exit(1);
  })
  .catch((err) => {
    console.error("Unhandled:", err);
    process.exit(2);
  });
