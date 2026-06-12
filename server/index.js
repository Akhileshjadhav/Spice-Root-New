import http from "node:http";
import { config } from "./src/config/env.js";
import { validateProductionEnvironment } from "./src/config/validateEnv.js";
import { handleRequest } from "./src/routes/router.js";

validateProductionEnvironment();

http.createServer(handleRequest).listen(config.port, () => {
  console.log(
    `Spice Root server running on http://localhost:${config.port} (${config.nodeEnv}, razorpay=${config.razorpay.mockMode ? "mock-test" : "razorpay-test"})`
  );
});
