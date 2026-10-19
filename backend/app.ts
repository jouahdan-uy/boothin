
import { createApp } from "./src/app.js";

const { app, sessions } = createApp();

sessions.startCleanup();

export default app;
