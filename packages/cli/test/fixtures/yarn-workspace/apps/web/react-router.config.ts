import type { Config } from "@react-router/dev/config";
import path from "node:path";

export default {
    appDirectory: path.join(import.meta.dirname, "app"),
    ssr: true,
} satisfies Config;
